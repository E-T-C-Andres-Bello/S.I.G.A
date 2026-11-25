-- ============================================================================
-- S.I.G.A. — Módulo 1.14: Portafolio Técnico y Hoja de Vida Verificada (PDF + QR)
-- Migración puramente DDL (cero INSERT/UPDATE/DELETE de datos)
-- Motor: Neon Serverless PostgreSQL 17+ | Código DEA: OD01340701
-- Seguridad: RLS estricto por dueño + cuota horaria OWASP LLM10 + QR sin PII
-- ============================================================================

-- 1. TABLA PRINCIPAL DE PORTAFOLIOS ESTUDIANTILES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  verification_code TEXT NOT NULL UNIQUE CHECK (
    verification_code ~ '^SIGA-CV-[A-Z0-9]{8,16}$'
  ),
  public_slug TEXT UNIQUE CHECK (
    public_slug IS NULL
    OR public_slug ~ '^[a-z0-9][a-z0-9-]{2,46}[a-z0-9]$'
  ),
  is_public BOOLEAN NOT NULL DEFAULT false,
  privacy_settings JSONB NOT NULL DEFAULT '{
    "show_photo": true,
    "show_email": false,
    "show_phone": false,
    "show_average": false,
    "show_medals": true
  }'::jsonb,
  template_id TEXT NOT NULL DEFAULT 'tecnico-moderno' CHECK (
    template_id IN (
      'clasico-ejecutivo',
      'tecnico-moderno',
      'editorial-minimalista',
      'creativo-bellista',
      'ats-compacto',
      'ingenieria-telematica',
      'comercio-aduanas',
      'hospitalidad-turismo',
      'timeline-academico',
      'dos-columnas-ejecutivo',
      'custom'
    )
  ),
  design_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  headline TEXT NOT NULL DEFAULT '' CHECK (char_length(headline) <= 140),
  about_summary TEXT NOT NULL DEFAULT '' CHECK (char_length(about_summary) <= 1200),
  contact_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  projects JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience JSONB NOT NULL DEFAULT '[]'::jsonb,
  certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  completeness_score SMALLINT NOT NULL DEFAULT 0 CHECK (completeness_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_portfolios_public_slug_active
  ON public.student_portfolios (public_slug)
  WHERE public_slug IS NOT NULL AND is_public = true;

CREATE INDEX IF NOT EXISTS idx_student_portfolios_updated_at
  ON public.student_portfolios (updated_at DESC);

-- 2. TABLA DE CONTROL DE CUOTA HORARIA DEL COACH IA (SIN PROMPTS NI PII)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_mode TEXT NOT NULL DEFAULT 'coach' CHECK (
    request_mode IN ('coach', 'import_pdf')
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'completed', 'failed', 'timeout')
  ),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR (latency_ms >= 0 AND latency_ms <= 120000)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_portfolio_ai_usage_user_created
  ON public.portfolio_ai_usage_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_ai_usage_pending_lookup
  ON public.portfolio_ai_usage_logs (id)
  WHERE status = 'pending';

-- 3. ROW LEVEL SECURITY + PRIVILEGIOS MÍNIMOS
-- ----------------------------------------------------------------------------
ALTER TABLE public.student_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_ai_usage_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.student_portfolios FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_portfolios TO authenticated;
GRANT ALL ON public.student_portfolios TO service_role;

REVOKE ALL ON public.portfolio_ai_usage_logs FROM PUBLIC, anon;
GRANT SELECT ON public.portfolio_ai_usage_logs TO authenticated;
GRANT ALL ON public.portfolio_ai_usage_logs TO service_role;

DROP POLICY IF EXISTS pol_student_portfolios_select ON public.student_portfolios;
CREATE POLICY pol_student_portfolios_select
  ON public.student_portfolios
  FOR SELECT
  TO authenticated
  USING (
    student_user_id = (SELECT siga_internal.current_user_id())
    OR (SELECT siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion']))
  );

DROP POLICY IF EXISTS pol_student_portfolios_insert ON public.student_portfolios;
CREATE POLICY pol_student_portfolios_insert
  ON public.student_portfolios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_user_id = (SELECT siga_internal.current_user_id())
  );

DROP POLICY IF EXISTS pol_student_portfolios_update ON public.student_portfolios;
CREATE POLICY pol_student_portfolios_update
  ON public.student_portfolios
  FOR UPDATE
  TO authenticated
  USING (
    student_user_id = (SELECT siga_internal.current_user_id())
  )
  WITH CHECK (
    student_user_id = (SELECT siga_internal.current_user_id())
  );

DROP POLICY IF EXISTS pol_student_portfolios_delete ON public.student_portfolios;
CREATE POLICY pol_student_portfolios_delete
  ON public.student_portfolios
  FOR DELETE
  TO authenticated
  USING (
    student_user_id = (SELECT siga_internal.current_user_id())
  );

DROP POLICY IF EXISTS pol_portfolio_ai_usage_select ON public.portfolio_ai_usage_logs;
CREATE POLICY pol_portfolio_ai_usage_select
  ON public.portfolio_ai_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT siga_internal.current_user_id())
    OR (SELECT siga_internal.has_any_role(ARRAY['direccion']))
  );

-- 4. RPC 1: GUARDAR PORTAFOLIO ESTUDIANTIL (ATÓMICO + CÓDIGO QR ÚNICO)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_guardar_portafolio_estudiante(
  p_template_id TEXT,
  p_design_config JSONB,
  p_headline TEXT,
  p_about_summary TEXT,
  p_contact_meta JSONB,
  p_skills JSONB,
  p_languages JSONB,
  p_projects JSONB,
  p_experience JSONB,
  p_certifications JSONB,
  p_custom_sections JSONB,
  p_completeness_score SMALLINT,
  p_is_public BOOLEAN DEFAULT false,
  p_public_slug TEXT DEFAULT NULL,
  p_privacy_settings JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_access_tier TEXT;
  v_is_student BOOLEAN := false;
  v_clean_slug TEXT;
  v_safe_template TEXT := COALESCE(NULLIF(trim(p_template_id), ''), 'tecnico-moderno');
  v_safe_score SMALLINT := LEAST(GREATEST(COALESCE(p_completeness_score, 0), 0), 100);
  v_safe_privacy JSONB := COALESCE(
    p_privacy_settings,
    '{"show_photo":true,"show_email":false,"show_phone":false,"show_average":false,"show_medals":true}'::jsonb
  );
  v_new_code TEXT;
  v_saved RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  SELECT u.access_tier::text
    INTO v_access_tier
    FROM public.users u
   WHERE u.id = v_actor_id
     AND u.is_active = true
     AND u.deleted_at IS NULL
   LIMIT 1;

  IF v_access_tier IS DISTINCT FROM 'verified_workspace' THEN
    RAISE EXCEPTION 'Debes vincular tu cuenta institucional para guardar tu portafolio técnico'
      USING ERRCODE = '42501';
  END IF;

  v_is_student := siga_internal.has_any_role(ARRAY['estudiante', 'direccion']);
  IF NOT v_is_student THEN
    RAISE EXCEPTION 'Solo estudiantes pueden editar su portafolio técnico'
      USING ERRCODE = '42501';
  END IF;

  IF v_safe_template NOT IN (
    'clasico-ejecutivo',
    'tecnico-moderno',
    'editorial-minimalista',
    'creativo-bellista',
    'ats-compacto',
    'ingenieria-telematica',
    'comercio-aduanas',
    'hospitalidad-turismo',
    'timeline-academico',
    'dos-columnas-ejecutivo',
    'custom'
  ) THEN
    v_safe_template := 'tecnico-moderno';
  END IF;

  v_clean_slug := NULLIF(lower(regexp_replace(trim(COALESCE(p_public_slug, '')), '[^a-z0-9-]+', '-', 'g')), '');
  IF v_clean_slug IS NOT NULL THEN
    v_clean_slug := trim(BOTH '-' FROM v_clean_slug);
    IF v_clean_slug = '' THEN
      v_clean_slug := NULL;
    ELSIF v_clean_slug !~ '^[a-z0-9][a-z0-9-]{2,46}[a-z0-9]$' THEN
      RAISE EXCEPTION 'El enlace público debe tener entre 4 y 48 caracteres usando solo letras minúsculas, números y guiones'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF COALESCE(p_is_public, false) = true AND v_clean_slug IS NULL THEN
    RAISE EXCEPTION 'Define un nombre corto para tu enlace antes de activar el portafolio público'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('student_portfolio:' || v_actor_id::text));

  IF v_clean_slug IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('student_portfolio_slug:' || v_clean_slug));
    IF EXISTS (
      SELECT 1
        FROM public.student_portfolios sp
       WHERE sp.public_slug = v_clean_slug
         AND sp.student_user_id <> v_actor_id
    ) THEN
      RAISE EXCEPTION 'Ese enlace público ya está en uso por otro estudiante. Prueba agregando tus iniciales o tu promoción.'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  v_new_code := 'SIGA-CV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.student_portfolios (
    student_user_id,
    verification_code,
    public_slug,
    is_public,
    privacy_settings,
    template_id,
    design_config,
    headline,
    about_summary,
    contact_meta,
    skills,
    languages,
    projects,
    experience,
    certifications,
    custom_sections,
    completeness_score,
    updated_at
  )
  VALUES (
    v_actor_id,
    v_new_code,
    v_clean_slug,
    COALESCE(p_is_public, false),
    v_safe_privacy,
    v_safe_template,
    COALESCE(p_design_config, '{}'::jsonb),
    left(trim(COALESCE(p_headline, '')), 140),
    left(trim(COALESCE(p_about_summary, '')), 1200),
    COALESCE(p_contact_meta, '{}'::jsonb),
    COALESCE(p_skills, '[]'::jsonb),
    COALESCE(p_languages, '[]'::jsonb),
    COALESCE(p_projects, '[]'::jsonb),
    COALESCE(p_experience, '[]'::jsonb),
    COALESCE(p_certifications, '[]'::jsonb),
    COALESCE(p_custom_sections, '[]'::jsonb),
    v_safe_score,
    now()
  )
  ON CONFLICT (student_user_id) DO UPDATE
    SET public_slug = EXCLUDED.public_slug,
        is_public = EXCLUDED.is_public,
        privacy_settings = EXCLUDED.privacy_settings,
        template_id = EXCLUDED.template_id,
        design_config = EXCLUDED.design_config,
        headline = EXCLUDED.headline,
        about_summary = EXCLUDED.about_summary,
        contact_meta = EXCLUDED.contact_meta,
        skills = EXCLUDED.skills,
        languages = EXCLUDED.languages,
        projects = EXCLUDED.projects,
        experience = EXCLUDED.experience,
        certifications = EXCLUDED.certifications,
        custom_sections = EXCLUDED.custom_sections,
        completeness_score = EXCLUDED.completeness_score,
        updated_at = now()
  RETURNING id, verification_code, public_slug, is_public, completeness_score, updated_at
    INTO v_saved;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_saved.id,
    'verification_code', v_saved.verification_code,
    'public_slug', v_saved.public_slug,
    'is_public', v_saved.is_public,
    'completeness_score', v_saved.completeness_score,
    'updated_at', v_saved.updated_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_guardar_portafolio_estudiante(
  TEXT, JSONB, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, SMALLINT, BOOLEAN, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_guardar_portafolio_estudiante(
  TEXT, JSONB, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, SMALLINT, BOOLEAN, TEXT, JSONB
) TO authenticated, service_role;

-- 5. RPC 2: CONSUMIR CUOTA HORARIA DEL COACH IA (20 REQ/HORA POR ESTUDIANTE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_consume_portfolio_ai_quota(
  p_request_mode TEXT DEFAULT 'coach'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_access_tier TEXT;
  v_safe_mode TEXT := CASE
    WHEN p_request_mode IN ('coach', 'import_pdf') THEN p_request_mode
    ELSE 'coach'
  END;
  v_limit CONSTANT INTEGER := 20;
  v_used INTEGER := 0;
  v_oldest TIMESTAMPTZ;
  v_retry_after INTEGER := 60;
  v_usage_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  SELECT u.access_tier::text
    INTO v_access_tier
    FROM public.users u
   WHERE u.id = v_actor_id
     AND u.is_active = true
     AND u.deleted_at IS NULL
   LIMIT 1;

  IF v_access_tier IS DISTINCT FROM 'verified_workspace' THEN
    RAISE EXCEPTION 'Necesitas tu cuenta institucional activa para usar el Coach de Portafolio'
      USING ERRCODE = '42501';
  END IF;

  IF NOT siga_internal.has_any_role(ARRAY['estudiante', 'direccion']) THEN
    RAISE EXCEPTION 'Solo estudiantes pueden usar el Coach de Portafolio'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('portfolio_ai_quota:' || v_actor_id::text));

  SELECT count(*)::INTEGER, min(l.created_at)
    INTO v_used, v_oldest
    FROM public.portfolio_ai_usage_logs l
   WHERE l.user_id = v_actor_id
     AND l.created_at >= now() - interval '1 hour'
     AND l.status IN ('pending', 'completed');

  IF v_used >= v_limit THEN
    IF v_oldest IS NOT NULL THEN
      v_retry_after := GREATEST(
        60,
        CEIL(EXTRACT(EPOCH FROM ((v_oldest + interval '1 hour') - now())))::INTEGER
      );
    END IF;

    RETURN jsonb_build_object(
      'allowed', false,
      'used_last_hour', v_used,
      'limit_per_hour', v_limit,
      'remaining', 0,
      'retry_after_seconds', v_retry_after
    );
  END IF;

  INSERT INTO public.portfolio_ai_usage_logs (
    user_id,
    request_mode,
    status
  )
  VALUES (
    v_actor_id,
    v_safe_mode,
    'pending'
  )
  RETURNING id INTO v_usage_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'usage_log_id', v_usage_id,
    'used_last_hour', v_used + 1,
    'limit_per_hour', v_limit,
    'remaining', GREATEST(0, v_limit - (v_used + 1))
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_consume_portfolio_ai_quota(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_consume_portfolio_ai_quota(TEXT) TO authenticated, service_role;

-- 6. RPC 3: VERIFICAR TICKET PENDIENTE DESDE NEON FUNCTION (`service_role`)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_service_verify_portfolio_ai_ticket(
  p_usage_log_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  IF current_user NOT IN ('service_role', 'neondb_owner', 'postgres')
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Operación exclusiva del servicio interno' USING ERRCODE = '42501';
  END IF;

  IF p_usage_log_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'missing_ticket');
  END IF;

  SELECT id, request_mode, status, created_at
    INTO v_row
    FROM public.portfolio_ai_usage_logs
   WHERE id = p_usage_log_id
     AND status = 'pending'
     AND created_at >= now() - interval '3 minutes'
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_or_expired_ticket');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'usage_log_id', v_row.id,
    'request_mode', v_row.request_mode
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_service_verify_portfolio_ai_ticket(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.siga_service_verify_portfolio_ai_ticket(UUID) TO service_role;

-- 7. RPC 4: CERRAR REGISTRO DE USO DEL COACH IA
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_finish_portfolio_ai_usage(
  p_usage_log_id UUID,
  p_status TEXT,
  p_latency_ms INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_is_service BOOLEAN :=
    current_user IN ('service_role', 'neondb_owner', 'postgres')
    OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role';
  v_safe_status TEXT := CASE
    WHEN p_status IN ('completed', 'failed', 'timeout') THEN p_status
    ELSE 'failed'
  END;
  v_safe_latency INTEGER := CASE
    WHEN p_latency_ms IS NULL THEN NULL
    ELSE LEAST(GREATEST(p_latency_ms, 0), 120000)
  END;
BEGIN
  IF p_usage_log_id IS NULL THEN
    RAISE EXCEPTION 'Identificador de uso requerido' USING ERRCODE = '22023';
  END IF;

  IF NOT v_is_service AND v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  UPDATE public.portfolio_ai_usage_logs
     SET status = v_safe_status,
         latency_ms = v_safe_latency,
         completed_at = now()
   WHERE id = p_usage_log_id
     AND status = 'pending'
     AND (v_is_service OR user_id = v_actor_id);

  RETURN jsonb_build_object(
    'success', true,
    'usage_log_id', p_usage_log_id,
    'status', v_safe_status
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_finish_portfolio_ai_usage(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_finish_portfolio_ai_usage(UUID, TEXT, INTEGER) TO authenticated, service_role;

-- 8. RPC PÚBLICO 1: VERIFICAR CÓDIGO QR DE PORTAFOLIO (CERO PII SENSIBLE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_public_verificar_portafolio(
  p_verification_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_code TEXT := upper(trim(COALESCE(p_verification_code, '')));
  v_row RECORD;
BEGIN
  IF v_code !~ '^SIGA-CV-[A-Z0-9]{8,16}$' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'status', 'not_found',
      'verification_code', v_code
    );
  END IF;

  SELECT sp.verification_code,
         sp.updated_at,
         sp.is_public,
         sp.public_slug,
         sp.completeness_score,
         trim(concat_ws(' ', u.first_name, u.last_name)) AS full_name,
         e.grade_year,
         e.enrollment_status::text AS enrollment_status,
         m.name AS mencion_name,
         m.specialty AS mencion_specialty,
         sy.name AS school_year_name
    INTO v_row
    FROM public.student_portfolios sp
    JOIN public.users u ON u.id = sp.student_user_id
    LEFT JOIN LATERAL (
      SELECT en.grade_year, en.mencion_id, en.school_year_id, en.enrollment_status
        FROM public.enrollments en
        JOIN public.school_years syear ON syear.id = en.school_year_id
       WHERE en.student_user_id = u.id
         AND en.deleted_at IS NULL
       ORDER BY syear.is_current DESC, syear.start_date DESC
       LIMIT 1
    ) e ON true
    LEFT JOIN public.menciones m ON m.id = e.mencion_id
    LEFT JOIN public.school_years sy ON sy.id = e.school_year_id
   WHERE sp.verification_code = v_code
     AND u.is_active = true
     AND u.deleted_at IS NULL
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'status', 'not_found',
      'verification_code', v_code
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'status', 'valid',
    'verification_code', v_row.verification_code,
    'document_type', 'portafolio_tecnico',
    'issued_at', v_row.updated_at,
    'revoked_at', NULL,
    'metadata', jsonb_strip_nulls(jsonb_build_object(
      'Estudiante', v_row.full_name,
      'Institucion', 'E.T.C. "Andrés Bello" (Unare II, Puerto Ordaz)',
      'Codigo_DEA', 'OD01340701',
      'Mencion', COALESCE(v_row.mencion_name, 'Educación Media Técnica'),
      'Especialidad', v_row.mencion_specialty,
      'Anio_Cursante', CASE WHEN v_row.grade_year IS NOT NULL THEN v_row.grade_year::text || '.º Año' ELSE NULL END,
      'Periodo_Escolar', v_row.school_year_name,
      'Condicion', CASE
        WHEN v_row.enrollment_status = 'graduated' THEN 'Egresado Técnico Medio'
        WHEN v_row.enrollment_status = 'active' THEN 'Estudiante Regular Activo'
        ELSE 'Estudiante Registrado'
      END,
      'Portafolio_Web', CASE WHEN v_row.is_public AND v_row.public_slug IS NOT NULL THEN 'Disponible públicamente' ELSE 'Solo verificación QR' END
    ))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.siga_public_verificar_portafolio(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.siga_public_verificar_portafolio(TEXT) TO anon, authenticated, service_role;

-- 9. RPC PÚBLICO 2: OBTENER PORTAFOLIO WEB PÚBLICO (RESPETANDO PRIVACIDAD K12)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_public_get_portfolio_by_slug(
  p_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_clean_slug TEXT := lower(trim(COALESCE(p_slug, '')));
  v_row RECORD;
  v_show_photo BOOLEAN;
  v_show_email BOOLEAN;
  v_show_phone BOOLEAN;
  v_show_average BOOLEAN;
  v_show_medals BOOLEAN;
  v_avg_grade NUMERIC;
BEGIN
  IF v_clean_slug !~ '^[a-z0-9][a-z0-9-]{2,46}[a-z0-9]$' THEN
    RETURN NULL;
  END IF;

  SELECT sp.id,
         sp.student_user_id,
         sp.verification_code,
         sp.public_slug,
         sp.privacy_settings,
         sp.template_id,
         sp.design_config,
         sp.headline,
         sp.about_summary,
         sp.contact_meta,
         sp.skills,
         sp.languages,
         sp.projects,
         sp.experience,
         sp.certifications,
         sp.custom_sections,
         sp.completeness_score,
         sp.updated_at,
         trim(concat_ws(' ', u.first_name, u.last_name)) AS full_name,
         u.institutional_email,
         u.phone,
         u.avatar_url,
         e.id AS enrollment_id,
         e.grade_year,
         e.enrollment_status::text AS enrollment_status,
         sec.section_letter,
         m.code AS mencion_code,
         m.name AS mencion_name,
         m.specialty AS mencion_specialty,
         sy.name AS school_year_name
    INTO v_row
    FROM public.student_portfolios sp
    JOIN public.users u ON u.id = sp.student_user_id
    LEFT JOIN LATERAL (
      SELECT en.id, en.grade_year, en.mencion_id, en.section_id, en.school_year_id, en.enrollment_status
        FROM public.enrollments en
        JOIN public.school_years syear ON syear.id = en.school_year_id
       WHERE en.student_user_id = u.id
         AND en.deleted_at IS NULL
       ORDER BY syear.is_current DESC, syear.start_date DESC
       LIMIT 1
    ) e ON true
    LEFT JOIN public.sections sec ON sec.id = e.section_id
    LEFT JOIN public.menciones m ON m.id = e.mencion_id
    LEFT JOIN public.school_years sy ON sy.id = e.school_year_id
   WHERE sp.public_slug = v_clean_slug
     AND sp.is_public = true
     AND u.is_active = true
     AND u.deleted_at IS NULL
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_show_photo := COALESCE((v_row.privacy_settings->>'show_photo')::boolean, true);
  v_show_email := COALESCE((v_row.privacy_settings->>'show_email')::boolean, false);
  v_show_phone := COALESCE((v_row.privacy_settings->>'show_phone')::boolean, false);
  v_show_average := COALESCE((v_row.privacy_settings->>'show_average')::boolean, false);
  v_show_medals := COALESCE((v_row.privacy_settings->>'show_medals')::boolean, true);

  IF v_show_average AND v_row.enrollment_id IS NOT NULL THEN
    SELECT ROUND(AVG(mfg.final_numeric_grade)::numeric, 2)
      INTO v_avg_grade
      FROM public.moment_final_grades mfg
     WHERE mfg.enrollment_id = v_row.enrollment_id
       AND mfg.final_numeric_grade IS NOT NULL;
  END IF;

  RETURN jsonb_build_object(
    'verification_code', v_row.verification_code,
    'public_slug', v_row.public_slug,
    'template_id', v_row.template_id,
    'design_config', v_row.design_config,
    'headline', v_row.headline,
    'about_summary', v_row.about_summary,
    'contact_meta', v_row.contact_meta,
    'skills', v_row.skills,
    'languages', v_row.languages,
    'projects', v_row.projects,
    'experience', v_row.experience,
    'certifications', v_row.certifications,
    'custom_sections', v_row.custom_sections,
    'completeness_score', v_row.completeness_score,
    'updated_at', v_row.updated_at,
    'privacy', jsonb_build_object(
      'show_photo', v_show_photo,
      'show_email', v_show_email,
      'show_phone', v_show_phone,
      'show_average', v_show_average,
      'show_medals', v_show_medals
    ),
    'verified_profile', jsonb_build_object(
      'full_name', v_row.full_name,
      'avatar_url', CASE WHEN v_show_photo THEN v_row.avatar_url ELSE NULL END,
      'institutional_email', CASE WHEN v_show_email THEN v_row.institutional_email ELSE NULL END,
      'phone', CASE WHEN v_show_phone THEN v_row.phone ELSE NULL END,
      'mencion_code', v_row.mencion_code,
      'mencion_name', v_row.mencion_name,
      'mencion_specialty', v_row.mencion_specialty,
      'grade_year', v_row.grade_year,
      'section_letter', v_row.section_letter,
      'school_year_name', v_row.school_year_name,
      'enrollment_status', v_row.enrollment_status,
      'average_grade', CASE WHEN v_show_average THEN v_avg_grade ELSE NULL END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.siga_public_get_portfolio_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.siga_public_get_portfolio_by_slug(TEXT) TO anon, authenticated, service_role;
