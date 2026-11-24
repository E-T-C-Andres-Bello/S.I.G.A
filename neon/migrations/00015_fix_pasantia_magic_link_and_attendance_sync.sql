-- ============================================================================
-- S.I.G.A. — Migración 00015: Corrección de Magic Link Pasantías y Upsert de
-- Asistencia Docente en `siga_sync_attendance_batch` (100 % DDL pura)
-- ============================================================================

-- 1. PASANTÍAS (6.º AÑO): USAR `ic.business_name` (COLUMNA REAL DE `internship_companies`)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_public_validar_magic_link_pasantia(
  p_raw_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_clean TEXT := trim(coalesce(p_raw_token, ''));
  v_hash TEXT;
  v_row RECORD;
BEGIN
  IF length(v_clean) < 24 OR length(v_clean) > 256 THEN
    RETURN jsonb_build_object('valid', false, 'status', 'invalid_token');
  END IF;

  v_hash := encode(
    extensions.digest(convert_to(v_clean, 'UTF8'), 'sha256'),
    'hex'
  );

  SELECT ml.id AS magic_link_id,
         ml.placement_id,
         ml.expires_at,
         ml.used_at,
         ip.status AS placement_status,
         ic.business_name AS company_name,
         u.first_name,
         u.last_name,
         m.name AS mencion_name
    INTO v_row
    FROM public.internship_magic_links ml
    JOIN public.internship_placements ip ON ip.id = ml.placement_id
    JOIN public.internship_companies ic ON ic.id = ip.company_id
    JOIN public.enrollments e ON e.id = ip.enrollment_id
    JOIN public.users u ON u.id = e.student_user_id
    JOIN public.menciones m ON m.id = e.mencion_id
   WHERE ml.token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END IF;

  IF v_row.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'status', 'already_used');
  END IF;

  IF v_row.expires_at <= now() THEN
    RETURN jsonb_build_object('valid', false, 'status', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'status', 'active',
    'placement_id', v_row.placement_id,
    'company_name', v_row.company_name,
    'student_display_name', trim(v_row.first_name || ' ' || left(v_row.last_name, 1) || '.'),
    'mencion_name', v_row.mencion_name,
    'expires_at', v_row.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.siga_public_validar_magic_link_pasantia(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.siga_public_validar_magic_link_pasantia(TEXT) TO anon, authenticated, service_role;

-- 2. ASISTENCIA DOCENTE: SOPORTAR IDEMPOTENCIA POR `client_mutation_id` Y RE-GUARDADO DE SESIÓN
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_sync_attendance_batch(
  p_teacher_assignment_id UUID,
  p_momento_id UUID,
  p_session_date DATE,
  p_block_label TEXT,
  p_recorded_mode TEXT,
  p_records JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_session_id UUID;
  v_item JSONB;
  v_mut_id UUID;
  v_enrollment_id UUID;
  v_upserted INTEGER := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    siga_internal.teaches_assignment(p_teacher_assignment_id)
    OR siga_internal.has_any_role(ARRAY['control_estudios', 'direccion'])
  ) THEN
    RAISE EXCEPTION 'No autorizado para registrar asistencia en esta sección' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.attendance_sessions (
    teacher_assignment_id, momento_id, session_date, block_label, recorded_mode, created_by
  )
  VALUES (
    p_teacher_assignment_id, p_momento_id, p_session_date, p_block_label, p_recorded_mode, v_actor_id
  )
  ON CONFLICT (teacher_assignment_id, session_date, block_label)
  DO UPDATE SET synced_at = now()
  RETURNING id INTO v_session_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_records, '[]'::jsonb))
  LOOP
    v_enrollment_id := (v_item->>'enrollment_id')::UUID;
    v_mut_id := COALESCE(NULLIF(v_item->>'client_mutation_id', '')::UUID, gen_random_uuid());

    -- Si la misma mutación offline ya fue procesada antes, omitir de forma idempotente
    IF EXISTS (
      SELECT 1
        FROM public.attendance_records ar
       WHERE ar.client_mutation_id = v_mut_id
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.attendance_records (
      attendance_session_id, enrollment_id, status, note, client_mutation_id
    )
    VALUES (
      v_session_id,
      v_enrollment_id,
      v_item->>'status',
      v_item->>'note',
      v_mut_id
    )
    ON CONFLICT (attendance_session_id, enrollment_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      note = EXCLUDED.note,
      client_mutation_id = EXCLUDED.client_mutation_id;

    v_upserted := v_upserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'synced_count', v_upserted
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_sync_attendance_batch(UUID, UUID, DATE, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_sync_attendance_batch(UUID, UUID, DATE, TEXT, TEXT, JSONB) TO authenticated, service_role;
