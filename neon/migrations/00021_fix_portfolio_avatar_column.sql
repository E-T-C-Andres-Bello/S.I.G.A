-- ============================================================================
-- S.I.G.A. — Módulo 1.14 (Ajuste DDL): usar columna real u.avatar_webp_url
-- Migración puramente DDL (cero INSERT/UPDATE/DELETE de datos)
-- ============================================================================

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
         u.avatar_webp_url,
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
      'avatar_url', CASE WHEN v_show_photo THEN v_row.avatar_webp_url ELSE NULL END,
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
