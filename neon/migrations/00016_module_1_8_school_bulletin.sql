-- ============================================================================
-- S.I.G.A. — Módulo 1.8: La Cartelera Bellista (Anuncios, Contingencias y Eventos)
-- Migración puramente DDL (cero INSERT/UPDATE/DELETE de datos)
-- Motor: Neon Serverless PostgreSQL 17+ | Código DEA: OD01340701
-- ============================================================================

-- 1. TABLA PRINCIPAL: ANUNCIOS OFICIALES DE LA CARTELERA BELLISTA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 4 AND 140),
  short_note TEXT NOT NULL CHECK (char_length(trim(short_note)) BETWEEN 2 AND 48),
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 10 AND 4000),
  category TEXT NOT NULL CHECK (
    category IN ('urgente', 'evento', 'academico', 'mencion', 'cultura_deporte')
  ),
  target_mencion_id UUID REFERENCES public.menciones(id) ON DELETE RESTRICT,
  target_grade_year SMALLINT CHECK (
    target_grade_year IS NULL OR target_grade_year BETWEEN 1 AND 6
  ),
  event_date TIMESTAMPTZ,
  location_label TEXT CHECK (
    location_label IS NULL OR char_length(trim(location_label)) <= 120
  ),
  cover_webp_url TEXT CHECK (
    cover_webp_url IS NULL
    OR (
      char_length(cover_webp_url) <= 1024
      AND cover_webp_url ~ '^https://'
    )
  ),
  theme_palette JSONB,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_school_announcements_expires_after_published CHECK (
    expires_at IS NULL OR expires_at > published_at
  )
);

CREATE INDEX IF NOT EXISTS idx_school_announcements_active_feed
  ON public.school_announcements (is_pinned DESC, published_at DESC)
  WHERE deleted_at IS NULL AND is_published = true;

CREATE INDEX IF NOT EXISTS idx_school_announcements_category_scope
  ON public.school_announcements (category, target_mencion_id, target_grade_year)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_school_announcements_event_date
  ON public.school_announcements (event_date ASC)
  WHERE deleted_at IS NULL AND is_published = true AND event_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_school_announcements_created_by
  ON public.school_announcements (created_by);

DROP TRIGGER IF EXISTS trg_school_announcements_updated_at ON public.school_announcements;
CREATE TRIGGER trg_school_announcements_updated_at
  BEFORE UPDATE ON public.school_announcements
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

-- 2. TABLA DE CONFIRMACIONES DE LECTURA ("ENTERADO")
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  announcement_id UUID NOT NULL REFERENCES public.school_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_read_at
  ON public.announcement_reads (user_id, read_at DESC);

-- 3. HELPER INTERNO: RESOLVER MENCIÓN DE COORDINADOR ACTIVO
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION siga_internal.current_coord_mencion_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT ur.mencion_id
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
   WHERE ur.user_id = (SELECT siga_internal.current_user_id())
     AND ur.is_active = true
     AND r.is_active = true
     AND r.code = 'coordinador_mencion'
     AND ur.mencion_id IS NOT NULL
     AND ur.valid_from <= CURRENT_DATE
     AND (ur.valid_until IS NULL OR ur.valid_until >= CURRENT_DATE)
     AND (SELECT siga_internal.is_verified_workspace())
   ORDER BY ur.created_at ASC
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION siga_internal.current_coord_mencion_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION siga_internal.current_coord_mencion_id() TO authenticated, service_role;

-- Helper interno: visibilidad de un anuncio para el actor actual (incluye provisional_cedula)
CREATE OR REPLACE FUNCTION siga_internal.can_view_school_announcement(
  p_target_mencion_id UUID,
  p_target_grade_year SMALLINT,
  p_is_published BOOLEAN,
  p_expires_at TIMESTAMPTZ,
  p_deleted_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_student_mencion_id UUID;
  v_student_grade_year SMALLINT;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_deleted_at IS NOT NULL THEN
    RETURN false;
  END IF;

  -- Dirección y Control de Estudios ven toda la cartelera (incluyendo borradores/expirados)
  IF siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']) THEN
    RETURN true;
  END IF;

  -- Coordinación de mención ve globales y todo lo de su mención
  IF siga_internal.has_any_role(ARRAY['coordinador_mencion']) THEN
    IF p_target_mencion_id IS NULL THEN
      RETURN p_is_published = true AND (p_expires_at IS NULL OR p_expires_at > now());
    END IF;
    IF siga_internal.is_coord_of_mencion(p_target_mencion_id) THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  -- Resto de la comunidad escolar: solo publicados y vigentes
  IF p_is_published IS DISTINCT FROM true THEN
    RETURN false;
  END IF;

  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RETURN false;
  END IF;

  -- Personal docente/orientación/pasantías/biblioteca puede leer la cartelera publicada
  IF siga_internal.has_any_role(ARRAY['docente', 'orientacion', 'coordinador_pasantias', 'biblioteca']) THEN
    RETURN true;
  END IF;

  -- Estudiantes (verified_workspace y provisional_cedula): globales o de su mención/año
  IF p_target_mencion_id IS NULL AND p_target_grade_year IS NULL THEN
    RETURN true;
  END IF;

  SELECT e.mencion_id, e.grade_year
    INTO v_student_mencion_id, v_student_grade_year
    FROM public.enrollments e
    JOIN public.school_years sy ON sy.id = e.school_year_id
   WHERE e.student_user_id = v_actor_id
     AND e.deleted_at IS NULL
     AND e.enrollment_status IN ('active', 'pre_enrolled')
   ORDER BY sy.is_current DESC, e.created_at DESC
   LIMIT 1;

  IF v_student_mencion_id IS NULL THEN
    RETURN p_target_mencion_id IS NULL AND p_target_grade_year IS NULL;
  END IF;

  IF p_target_mencion_id IS NOT NULL AND p_target_mencion_id <> v_student_mencion_id THEN
    RETURN false;
  END IF;

  IF p_target_grade_year IS NOT NULL AND p_target_grade_year <> v_student_grade_year THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION siga_internal.can_view_school_announcement(UUID, SMALLINT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION siga_internal.can_view_school_announcement(UUID, SMALLINT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

-- 4. ROW LEVEL SECURITY (RLS) + PRIVILEGIOS EXPLÍCITOS
-- ----------------------------------------------------------------------------
ALTER TABLE public.school_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.school_announcements FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_announcements TO authenticated, service_role;

REVOKE ALL ON public.announcement_reads FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.announcement_reads TO authenticated, service_role;

DROP POLICY IF EXISTS pol_school_announcements_select ON public.school_announcements;
CREATE POLICY pol_school_announcements_select
  ON public.school_announcements
  FOR SELECT
  TO authenticated
  USING (
    siga_internal.can_view_school_announcement(
      target_mencion_id,
      target_grade_year,
      is_published,
      expires_at,
      deleted_at
    )
  );

DROP POLICY IF EXISTS pol_school_announcements_insert ON public.school_announcements;
CREATE POLICY pol_school_announcements_insert
  ON public.school_announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT siga_internal.current_user_id())
    AND (
      (SELECT siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
      OR (
        target_mencion_id IS NOT NULL
        AND siga_internal.is_coord_of_mencion(target_mencion_id)
      )
    )
  );

DROP POLICY IF EXISTS pol_school_announcements_update ON public.school_announcements;
CREATE POLICY pol_school_announcements_update
  ON public.school_announcements
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      (SELECT siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
      OR (
        target_mencion_id IS NOT NULL
        AND siga_internal.is_coord_of_mencion(target_mencion_id)
      )
    )
  )
  WITH CHECK (
    (SELECT siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
    OR (
      target_mencion_id IS NOT NULL
      AND siga_internal.is_coord_of_mencion(target_mencion_id)
    )
  );

DROP POLICY IF EXISTS pol_announcement_reads_select_own ON public.announcement_reads;
CREATE POLICY pol_announcement_reads_select_own
  ON public.announcement_reads
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT siga_internal.current_user_id()));

DROP POLICY IF EXISTS pol_announcement_reads_insert_own ON public.announcement_reads;
CREATE POLICY pol_announcement_reads_insert_own
  ON public.announcement_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT siga_internal.current_user_id())
    AND EXISTS (
      SELECT 1
        FROM public.school_announcements sa
       WHERE sa.id = announcement_id
         AND siga_internal.can_view_school_announcement(
           sa.target_mencion_id,
           sa.target_grade_year,
           sa.is_published,
           sa.expires_at,
           sa.deleted_at
         )
    )
  );

-- 5. RPC 1: CONSULTAR FEED DE LA CARTELERA BELLISTA (CON CONTEO AGREGADO)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_get_school_announcements(
  p_include_editorial BOOLEAN DEFAULT false,
  p_limit INTEGER DEFAULT 40
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  short_note TEXT,
  body TEXT,
  category TEXT,
  target_mencion_id UUID,
  target_mencion_code TEXT,
  target_mencion_name TEXT,
  target_grade_year SMALLINT,
  event_date TIMESTAMPTZ,
  location_label TEXT,
  cover_webp_url TEXT,
  theme_palette JSONB,
  is_pinned BOOLEAN,
  is_published BOOLEAN,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  author_name TEXT,
  read_count INTEGER,
  has_read BOOLEAN,
  read_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_safe_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
  v_is_editor BOOLEAN := false;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  v_is_editor :=
    siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'coordinador_mencion']);

  RETURN QUERY
  SELECT
    sa.id,
    sa.title,
    sa.short_note,
    sa.body,
    sa.category,
    sa.target_mencion_id,
    m.code AS target_mencion_code,
    m.name AS target_mencion_name,
    sa.target_grade_year,
    sa.event_date,
    sa.location_label,
    sa.cover_webp_url,
    sa.theme_palette,
    sa.is_pinned,
    sa.is_published,
    sa.published_at,
    sa.expires_at,
    sa.created_by,
    trim(concat_ws(' ', u.first_name, u.last_name)) AS author_name,
    COALESCE(rc.total_reads, 0)::INTEGER AS read_count,
    (ar_me.user_id IS NOT NULL) AS has_read,
    ar_me.read_at
  FROM public.school_announcements sa
  LEFT JOIN public.menciones m ON m.id = sa.target_mencion_id
  LEFT JOIN public.users u ON u.id = sa.created_by
  LEFT JOIN LATERAL (
    SELECT count(*)::INTEGER AS total_reads
      FROM public.announcement_reads ar_all
     WHERE ar_all.announcement_id = sa.id
  ) rc ON true
  LEFT JOIN public.announcement_reads ar_me
    ON ar_me.announcement_id = sa.id
   AND ar_me.user_id = v_actor_id
  WHERE sa.deleted_at IS NULL
    AND siga_internal.can_view_school_announcement(
      sa.target_mencion_id,
      sa.target_grade_year,
      sa.is_published,
      sa.expires_at,
      sa.deleted_at
    )
    AND (
      (p_include_editorial = true AND v_is_editor = true)
      OR (
        sa.is_published = true
        AND (sa.expires_at IS NULL OR sa.expires_at > now())
      )
    )
  ORDER BY
    sa.is_pinned DESC,
    CASE WHEN sa.category = 'urgente' THEN 0 ELSE 1 END ASC,
    sa.published_at DESC
  LIMIT v_safe_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_get_school_announcements(BOOLEAN, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_get_school_announcements(BOOLEAN, INTEGER) TO authenticated, service_role;

-- 6. RPC 2: CONFIRMAR LECTURA ("ENTERADO") DE FORMA 100 % IDEMPOTENTE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_confirm_announcement_read(
  p_announcement_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_announcement RECORD;
  v_inserted_id UUID;
  v_read_count INTEGER := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  IF p_announcement_id IS NULL THEN
    RAISE EXCEPTION 'Debes seleccionar un comunicado válido' USING ERRCODE = '22023';
  END IF;

  SELECT
    sa.id,
    sa.target_mencion_id,
    sa.target_grade_year,
    sa.is_published,
    sa.expires_at,
    sa.deleted_at
    INTO v_announcement
    FROM public.school_announcements sa
   WHERE sa.id = p_announcement_id;

  IF NOT FOUND
     OR NOT siga_internal.can_view_school_announcement(
       v_announcement.target_mencion_id,
       v_announcement.target_grade_year,
       v_announcement.is_published,
       v_announcement.expires_at,
       v_announcement.deleted_at
     ) THEN
    RAISE EXCEPTION 'El comunicado solicitado no está disponible para tu perfil'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.announcement_reads (announcement_id, user_id, read_at)
  VALUES (p_announcement_id, v_actor_id, now())
  ON CONFLICT (announcement_id, user_id) DO NOTHING
  RETURNING announcement_id INTO v_inserted_id;

  SELECT count(*)::INTEGER
    INTO v_read_count
    FROM public.announcement_reads ar
   WHERE ar.announcement_id = p_announcement_id;

  RETURN jsonb_build_object(
    'success', true,
    'announcement_id', p_announcement_id,
    'already_confirmed', (v_inserted_id IS NULL),
    'read_count', v_read_count,
    'read_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_confirm_announcement_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_confirm_announcement_read(UUID) TO authenticated, service_role;

-- 7. RPC 3: CREAR O ACTUALIZAR ANUNCIO (ROLES EDITORIALES)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_upsert_school_announcement(
  p_announcement_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_short_note TEXT DEFAULT NULL,
  p_body TEXT DEFAULT NULL,
  p_category TEXT DEFAULT 'evento',
  p_target_mencion_id UUID DEFAULT NULL,
  p_target_grade_year SMALLINT DEFAULT NULL,
  p_event_date TIMESTAMPTZ DEFAULT NULL,
  p_location_label TEXT DEFAULT NULL,
  p_cover_webp_url TEXT DEFAULT NULL,
  p_theme_palette JSONB DEFAULT NULL,
  p_is_pinned BOOLEAN DEFAULT false,
  p_is_published BOOLEAN DEFAULT true,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_is_global_editor BOOLEAN := false;
  v_coord_mencion_id UUID := NULL;
  v_final_mencion_id UUID := p_target_mencion_id;
  v_final_pinned BOOLEAN := COALESCE(p_is_pinned, false);
  v_clean_title TEXT := trim(COALESCE(p_title, ''));
  v_clean_note TEXT := trim(COALESCE(p_short_note, ''));
  v_clean_body TEXT := trim(COALESCE(p_body, ''));
  v_clean_location TEXT := NULLIF(trim(COALESCE(p_location_label, '')), '');
  v_clean_cover TEXT := NULLIF(trim(COALESCE(p_cover_webp_url, '')), '');
  v_existing RECORD;
  v_saved_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  v_is_global_editor := siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']);
  v_coord_mencion_id := siga_internal.current_coord_mencion_id();

  IF NOT v_is_global_editor AND v_coord_mencion_id IS NULL THEN
    RAISE EXCEPTION 'No tienes permisos editoriales para gestionar la cartelera escolar'
      USING ERRCODE = '42501';
  END IF;

  -- Si es Coordinación de Mención (sin rol global), siempre se acota a su mención
  IF NOT v_is_global_editor THEN
    IF v_final_mencion_id IS NOT NULL AND NOT siga_internal.is_coord_of_mencion(v_final_mencion_id) THEN
      RAISE EXCEPTION 'Solo puedes publicar comunicados dirigidos a tu mención asignada'
        USING ERRCODE = '42501';
    END IF;
    v_final_mencion_id := COALESCE(v_final_mencion_id, v_coord_mencion_id);
  END IF;

  IF char_length(v_clean_title) < 4 OR char_length(v_clean_title) > 140 THEN
    RAISE EXCEPTION 'El título debe tener entre 4 y 140 caracteres' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_clean_note) < 2 OR char_length(v_clean_note) > 48 THEN
    RAISE EXCEPTION 'La nota corta debe tener entre 2 y 48 caracteres' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_clean_body) < 10 OR char_length(v_clean_body) > 4000 THEN
    RAISE EXCEPTION 'El cuerpo del comunicado debe tener entre 10 y 4000 caracteres' USING ERRCODE = '22023';
  END IF;

  IF p_category NOT IN ('urgente', 'evento', 'academico', 'mencion', 'cultura_deporte') THEN
    RAISE EXCEPTION 'Categoría de comunicado no válida' USING ERRCODE = '22023';
  END IF;

  IF p_target_grade_year IS NOT NULL AND (p_target_grade_year < 1 OR p_target_grade_year > 6) THEN
    RAISE EXCEPTION 'El año escolar destino debe estar entre 1.º y 6.º año' USING ERRCODE = '22023';
  END IF;

  IF v_clean_cover IS NOT NULL AND v_clean_cover !~ '^https://' THEN
    RAISE EXCEPTION 'La dirección de la imagen de portada debe usar HTTPS' USING ERRCODE = '22023';
  END IF;

  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'La fecha de vigencia debe ser posterior a la hora actual' USING ERRCODE = '22023';
  END IF;

  IF p_announcement_id IS NULL THEN
    INSERT INTO public.school_announcements (
      title,
      short_note,
      body,
      category,
      target_mencion_id,
      target_grade_year,
      event_date,
      location_label,
      cover_webp_url,
      theme_palette,
      is_pinned,
      is_published,
      published_at,
      expires_at,
      created_by
    )
    VALUES (
      v_clean_title,
      v_clean_note,
      v_clean_body,
      p_category,
      v_final_mencion_id,
      p_target_grade_year,
      p_event_date,
      v_clean_location,
      v_clean_cover,
      p_theme_palette,
      v_final_pinned,
      COALESCE(p_is_published, true),
      now(),
      p_expires_at,
      v_actor_id
    )
    RETURNING id INTO v_saved_id;
  ELSE
    SELECT id, target_mencion_id, deleted_at
      INTO v_existing
      FROM public.school_announcements
     WHERE id = p_announcement_id;

    IF NOT FOUND OR v_existing.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'El comunicado que intentas editar no existe' USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_is_global_editor
       AND (v_existing.target_mencion_id IS NULL OR NOT siga_internal.is_coord_of_mencion(v_existing.target_mencion_id)) THEN
      RAISE EXCEPTION 'No puedes editar comunicados fuera de tu mención asignada' USING ERRCODE = '42501';
    END IF;

    UPDATE public.school_announcements
       SET title = v_clean_title,
           short_note = v_clean_note,
           body = v_clean_body,
           category = p_category,
           target_mencion_id = v_final_mencion_id,
           target_grade_year = p_target_grade_year,
           event_date = p_event_date,
           location_label = v_clean_location,
           cover_webp_url = v_clean_cover,
           theme_palette = p_theme_palette,
           is_pinned = v_final_pinned,
           is_published = COALESCE(p_is_published, true),
           expires_at = p_expires_at
     WHERE id = p_announcement_id
     RETURNING id INTO v_saved_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_saved_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_upsert_school_announcement(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, SMALLINT, TIMESTAMPTZ, TEXT, TEXT, JSONB, BOOLEAN, BOOLEAN, TIMESTAMPTZ
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_upsert_school_announcement(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, SMALLINT, TIMESTAMPTZ, TEXT, TEXT, JSONB, BOOLEAN, BOOLEAN, TIMESTAMPTZ
) TO authenticated, service_role;

-- 8. RPC 4: ARCHIVAR (SOFT-DELETE) ANUNCIO EDITORIAL
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_archive_school_announcement(
  p_announcement_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_is_global_editor BOOLEAN := false;
  v_existing RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  IF p_announcement_id IS NULL THEN
    RAISE EXCEPTION 'Identificador de comunicado requerido' USING ERRCODE = '22023';
  END IF;

  v_is_global_editor := siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']);

  SELECT id, target_mencion_id, deleted_at
    INTO v_existing
    FROM public.school_announcements
   WHERE id = p_announcement_id;

  IF NOT FOUND OR v_existing.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'El comunicado ya no se encuentra activo' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_is_global_editor
     AND (v_existing.target_mencion_id IS NULL OR NOT siga_internal.is_coord_of_mencion(v_existing.target_mencion_id)) THEN
    RAISE EXCEPTION 'No tienes permisos para archivar este comunicado' USING ERRCODE = '42501';
  END IF;

  UPDATE public.school_announcements
     SET deleted_at = now(),
         is_published = false,
         is_pinned = false
   WHERE id = p_announcement_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', p_announcement_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_archive_school_announcement(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_archive_school_announcement(UUID) TO authenticated, service_role;
