-- ============================================================================
-- S.I.G.A. — Módulo 1.8B: Estudio Editorial Tipo Word, Pared Anti-Conflictos
-- y Habilitación de Coordinación de Pasantías (5.º y 6.º año)
-- Migración puramente DDL (cero INSERT/UPDATE/DELETE de datos)
-- Motor: Neon Serverless PostgreSQL 17+ | Código DEA: OD01340701
-- ============================================================================

-- 1. COLUMNAS EDITORIALES DE AUDITORÍA Y SELLO DE DEPARTAMENTO EMISOR
-- ----------------------------------------------------------------------------
ALTER TABLE public.school_announcements
  ADD COLUMN IF NOT EXISTS author_department TEXT NOT NULL DEFAULT 'Dirección',
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_school_announcements_drafts_by_author
  ON public.school_announcements (created_by, updated_at DESC)
  WHERE deleted_at IS NULL AND is_published = false;

-- 2. HELPER DE PARED ANTI-CONFLICTOS (JERARQUÍA + AUTORÍA)
-- ----------------------------------------------------------------------------
-- Reglas:
--   - `direccion`: puede editar/archivar cualquier comunicado institucional.
--   - `control_estudios`: solo edita/archiva comunicados propios (`created_by = actor`).
--   - `coordinador_mencion`: solo edita/archiva comunicados propios de su mención.
--   - `coordinador_pasantias`: solo edita/archiva comunicados propios de 5.º o 6.º año.
CREATE OR REPLACE FUNCTION siga_internal.can_manage_school_announcement(
  p_created_by UUID,
  p_target_mencion_id UUID,
  p_target_grade_year SMALLINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN false;
  END IF;

  -- Dirección supervisa y modera toda la cartelera escolar
  IF siga_internal.has_any_role(ARRAY['direccion']) THEN
    RETURN true;
  END IF;

  -- El resto de los roles editoriales solo pueden modificar sus propios anuncios
  IF p_created_by IS DISTINCT FROM v_actor_id THEN
    RETURN false;
  END IF;

  IF siga_internal.has_any_role(ARRAY['control_estudios']) THEN
    RETURN true;
  END IF;

  IF p_target_mencion_id IS NOT NULL
     AND siga_internal.is_coord_of_mencion(p_target_mencion_id) THEN
    RETURN true;
  END IF;

  IF siga_internal.has_any_role(ARRAY['coordinador_pasantias'])
     AND p_target_grade_year IN (5, 6) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION siga_internal.can_manage_school_announcement(UUID, UUID, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION siga_internal.can_manage_school_announcement(UUID, UUID, SMALLINT) TO authenticated, service_role;

-- Helper interno: determinar etiqueta del departamento emisor según rol activo
CREATE OR REPLACE FUNCTION siga_internal.resolve_bulletin_department_label()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_coord_mencion_id UUID;
  v_mencion_name TEXT;
BEGIN
  IF siga_internal.has_any_role(ARRAY['direccion']) THEN
    RETURN 'Dirección';
  END IF;

  IF siga_internal.has_any_role(ARRAY['control_estudios']) THEN
    RETURN 'Control de Estudios';
  END IF;

  v_coord_mencion_id := siga_internal.current_coord_mencion_id();
  IF v_coord_mencion_id IS NOT NULL THEN
    SELECT m.name INTO v_mencion_name
      FROM public.menciones m
     WHERE m.id = v_coord_mencion_id
     LIMIT 1;
    RETURN 'Coord. ' || COALESCE(v_mencion_name, 'Mención');
  END IF;

  IF siga_internal.has_any_role(ARRAY['coordinador_pasantias']) THEN
    RETURN 'Coord. Pasantías';
  END IF;

  RETURN 'E.T.C. "Andrés Bello"';
END;
$$;

REVOKE ALL ON FUNCTION siga_internal.resolve_bulletin_department_label() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION siga_internal.resolve_bulletin_department_label() TO authenticated, service_role;

-- Helper de visibilidad con soporte para borradores propios + Dirección
CREATE OR REPLACE FUNCTION siga_internal.can_view_school_announcement_with_author(
  p_created_by UUID,
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
BEGIN
  IF v_actor_id IS NULL OR p_deleted_at IS NOT NULL THEN
    RETURN false;
  END IF;

  -- Dirección ve todo (publicados, borradores y expirados)
  IF siga_internal.has_any_role(ARRAY['direccion']) THEN
    RETURN true;
  END IF;

  -- El autor siempre puede ver sus propios borradores y anuncios
  IF p_created_by = v_actor_id
     AND (
       siga_internal.has_any_role(ARRAY['control_estudios', 'coordinador_pasantias'])
       OR siga_internal.current_coord_mencion_id() IS NOT NULL
     ) THEN
    RETURN true;
  END IF;

  -- Para cualquier otro anuncio, exigir publicación y vigencia
  IF p_is_published IS DISTINCT FROM true THEN
    RETURN false;
  END IF;

  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RETURN false;
  END IF;

  RETURN siga_internal.can_view_school_announcement(
    p_target_mencion_id,
    p_target_grade_year,
    p_is_published,
    p_expires_at,
    p_deleted_at
  );
END;
$$;

REVOKE ALL ON FUNCTION siga_internal.can_view_school_announcement_with_author(UUID, UUID, SMALLINT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION siga_internal.can_view_school_announcement_with_author(UUID, UUID, SMALLINT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

-- 3. ACTUALIZAR POLÍTICAS RLS EN `public.school_announcements`
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pol_school_announcements_select ON public.school_announcements;
CREATE POLICY pol_school_announcements_select
  ON public.school_announcements
  FOR SELECT
  TO authenticated
  USING (
    siga_internal.can_view_school_announcement_with_author(
      created_by,
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
      OR (
        (SELECT siga_internal.has_any_role(ARRAY['coordinador_pasantias']))
        AND target_grade_year IN (5, 6)
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
    AND siga_internal.can_manage_school_announcement(
      created_by,
      target_mencion_id,
      target_grade_year
    )
  )
  WITH CHECK (
    siga_internal.can_manage_school_announcement(
      created_by,
      target_mencion_id,
      target_grade_year
    )
  );

-- 4. ACTUALIZAR RPC `siga_get_school_announcements` (RETORNA `author_department` Y `can_edit`)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.siga_get_school_announcements(BOOLEAN, INTEGER);

CREATE OR REPLACE FUNCTION public.siga_get_school_announcements(
  p_include_editorial BOOLEAN DEFAULT false,
  p_limit INTEGER DEFAULT 50
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
  author_department TEXT,
  can_edit BOOLEAN,
  read_count INTEGER,
  has_read BOOLEAN,
  read_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_safe_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_is_editor BOOLEAN := false;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  v_is_editor :=
    siga_internal.has_any_role(
      ARRAY['direccion', 'control_estudios', 'coordinador_mencion', 'coordinador_pasantias']
    );

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
    sa.author_department,
    siga_internal.can_manage_school_announcement(
      sa.created_by,
      sa.target_mencion_id,
      sa.target_grade_year
    ) AS can_edit,
    COALESCE(rc.total_reads, 0)::INTEGER AS read_count,
    (ar_me.user_id IS NOT NULL) AS has_read,
    ar_me.read_at,
    sa.updated_at
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
    AND siga_internal.can_view_school_announcement_with_author(
      sa.created_by,
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
    sa.is_published DESC,
    sa.is_pinned DESC,
    CASE WHEN sa.category = 'urgente' THEN 0 ELSE 1 END ASC,
    sa.published_at DESC
  LIMIT v_safe_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_get_school_announcements(BOOLEAN, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_get_school_announcements(BOOLEAN, INTEGER) TO authenticated, service_role;

-- 5. ACTUALIZAR RPC `siga_upsert_school_announcement` CON PARED + PASANTÍAS + BORRADORES
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
  v_is_direccion BOOLEAN := false;
  v_is_control BOOLEAN := false;
  v_is_pasantias BOOLEAN := false;
  v_coord_mencion_id UUID := NULL;
  v_final_mencion_id UUID := p_target_mencion_id;
  v_final_grade_year SMALLINT := p_target_grade_year;
  v_final_published BOOLEAN := COALESCE(p_is_published, true);
  v_final_pinned BOOLEAN := CASE WHEN COALESCE(p_is_published, true) THEN COALESCE(p_is_pinned, false) ELSE false END;
  v_department_label TEXT;
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

  v_is_direccion := siga_internal.has_any_role(ARRAY['direccion']);
  v_is_control := siga_internal.has_any_role(ARRAY['control_estudios']);
  v_coord_mencion_id := siga_internal.current_coord_mencion_id();
  v_is_pasantias := siga_internal.has_any_role(ARRAY['coordinador_pasantias']);

  IF NOT v_is_direccion
     AND NOT v_is_control
     AND v_coord_mencion_id IS NULL
     AND NOT v_is_pasantias THEN
    RAISE EXCEPTION 'No tienes permisos editoriales para gestionar la cartelera escolar'
      USING ERRCODE = '42501';
  END IF;

  -- Aplicar límites de destinatarios según rol editorial (si no es Dirección ni Control de Estudios)
  IF NOT v_is_direccion AND NOT v_is_control THEN
    IF v_coord_mencion_id IS NOT NULL AND NOT v_is_pasantias THEN
      IF v_final_mencion_id IS NOT NULL AND NOT siga_internal.is_coord_of_mencion(v_final_mencion_id) THEN
        RAISE EXCEPTION 'Solo puedes publicar comunicados dirigidos a tu mención asignada'
          USING ERRCODE = '42501';
      END IF;
      v_final_mencion_id := COALESCE(v_final_mencion_id, v_coord_mencion_id);
    ELSIF v_is_pasantias AND v_coord_mencion_id IS NULL THEN
      v_final_grade_year := COALESCE(v_final_grade_year, 6);
      IF v_final_grade_year NOT IN (5, 6) THEN
        RAISE EXCEPTION 'Coordinación de Pasantías solo puede publicar para 5.º o 6.º año'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      -- Usuario multi-rol (coord. mención + coord. pasantías): al menos una de las dos restricciones debe cumplirse
      IF NOT (
        (v_final_mencion_id IS NOT NULL AND siga_internal.is_coord_of_mencion(v_final_mencion_id))
        OR v_final_grade_year IN (5, 6)
      ) THEN
        RAISE EXCEPTION 'Selecciona tu mención asignada o 5.º/6.º año de pasantías'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  IF char_length(v_clean_title) < 4 OR char_length(v_clean_title) > 140 THEN
    RAISE EXCEPTION 'El título debe tener entre 4 y 140 caracteres' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_clean_note) < 2 OR char_length(v_clean_note) > 48 THEN
    RAISE EXCEPTION 'La etiqueta corta debe tener entre 2 y 48 caracteres' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_clean_body) < 10 OR char_length(v_clean_body) > 4000 THEN
    RAISE EXCEPTION 'El contenido del comunicado debe tener entre 10 y 4000 caracteres' USING ERRCODE = '22023';
  END IF;

  IF p_category NOT IN ('urgente', 'evento', 'academico', 'mencion', 'cultura_deporte') THEN
    RAISE EXCEPTION 'Categoría de comunicado no válida' USING ERRCODE = '22023';
  END IF;

  IF v_final_grade_year IS NOT NULL AND (v_final_grade_year < 1 OR v_final_grade_year > 6) THEN
    RAISE EXCEPTION 'El año escolar destino debe estar entre 1.º y 6.º año' USING ERRCODE = '22023';
  END IF;

  IF v_clean_cover IS NOT NULL AND v_clean_cover !~ '^https://' THEN
    RAISE EXCEPTION 'La imagen de portada debe usar una conexión segura HTTPS' USING ERRCODE = '22023';
  END IF;

  IF v_final_published = true AND p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'La fecha de vigencia debe ser posterior a la hora actual' USING ERRCODE = '22023';
  END IF;

  v_department_label := siga_internal.resolve_bulletin_department_label();

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
      created_by,
      author_department,
      updated_by
    )
    VALUES (
      v_clean_title,
      v_clean_note,
      v_clean_body,
      p_category,
      v_final_mencion_id,
      v_final_grade_year,
      p_event_date,
      v_clean_location,
      v_clean_cover,
      p_theme_palette,
      v_final_pinned,
      v_final_published,
      now(),
      p_expires_at,
      v_actor_id,
      v_department_label,
      v_actor_id
    )
    RETURNING id INTO v_saved_id;
  ELSE
    SELECT id, created_by, target_mencion_id, target_grade_year, is_published, published_at, deleted_at
      INTO v_existing
      FROM public.school_announcements
     WHERE id = p_announcement_id;

    IF NOT FOUND OR v_existing.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'El comunicado que intentas editar no existe' USING ERRCODE = 'P0002';
    END IF;

    -- Pared anti-conflictos: Dirección edita todo; los demás solo sus propios anuncios
    IF NOT siga_internal.can_manage_school_announcement(
      v_existing.created_by,
      v_existing.target_mencion_id,
      v_existing.target_grade_year
    ) THEN
      RAISE EXCEPTION 'Solo el autor original o Dirección pueden editar este comunicado'
        USING ERRCODE = '42501';
    END IF;

    UPDATE public.school_announcements
       SET title = v_clean_title,
           short_note = v_clean_note,
           body = v_clean_body,
           category = p_category,
           target_mencion_id = v_final_mencion_id,
           target_grade_year = v_final_grade_year,
           event_date = p_event_date,
           location_label = v_clean_location,
           cover_webp_url = v_clean_cover,
           theme_palette = p_theme_palette,
           is_pinned = v_final_pinned,
           is_published = v_final_published,
           published_at = CASE
             WHEN v_existing.is_published = false AND v_final_published = true THEN now()
             ELSE v_existing.published_at
           END,
           expires_at = p_expires_at,
           updated_by = v_actor_id
     WHERE id = p_announcement_id
     RETURNING id INTO v_saved_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_saved_id,
    'is_published', v_final_published
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_upsert_school_announcement(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, SMALLINT, TIMESTAMPTZ, TEXT, TEXT, JSONB, BOOLEAN, BOOLEAN, TIMESTAMPTZ
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_upsert_school_announcement(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, SMALLINT, TIMESTAMPTZ, TEXT, TEXT, JSONB, BOOLEAN, BOOLEAN, TIMESTAMPTZ
) TO authenticated, service_role;

-- 6. ACTUALIZAR RPC `siga_archive_school_announcement` CON LA MISMA PARED ANTI-CONFLICTOS
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
  v_existing RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  IF p_announcement_id IS NULL THEN
    RAISE EXCEPTION 'Identificador de comunicado requerido' USING ERRCODE = '22023';
  END IF;

  SELECT id, created_by, target_mencion_id, target_grade_year, deleted_at
    INTO v_existing
    FROM public.school_announcements
   WHERE id = p_announcement_id;

  IF NOT FOUND OR v_existing.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'El comunicado ya no se encuentra activo' USING ERRCODE = 'P0002';
  END IF;

  IF NOT siga_internal.can_manage_school_announcement(
    v_existing.created_by,
    v_existing.target_mencion_id,
    v_existing.target_grade_year
  ) THEN
    RAISE EXCEPTION 'Solo el autor original o Dirección pueden archivar este comunicado'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.school_announcements
     SET deleted_at = now(),
         is_published = false,
         is_pinned = false,
         updated_by = v_actor_id
   WHERE id = p_announcement_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', p_announcement_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_archive_school_announcement(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_archive_school_announcement(UUID) TO authenticated, service_role;
