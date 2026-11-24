-- ============================================================================
-- S.I.G.A. — Migración 00013: Soporte de URLs Neon Object Storage en avatares
-- Motor: Neon PostgreSQL 17/18+ (SOLO DDL)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.siga_actualizar_avatar_estudiante(
  p_avatar_webp_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_auth_uid TEXT := auth.uid()::text;
  v_clean_url TEXT := NULLIF(trim(COALESCE(p_avatar_webp_url, '')), '');
  v_access_tier TEXT;
BEGIN
  IF v_actor_id IS NULL OR v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  SELECT u.access_tier
    INTO v_access_tier
    FROM public.users u
   WHERE u.id = v_actor_id
     AND u.is_active = true
     AND u.deleted_at IS NULL;

  IF NOT FOUND OR v_access_tier = 'suspended' THEN
    RAISE EXCEPTION 'Tu cuenta institucional no se encuentra habilitada para esta operación'
      USING ERRCODE = '42501';
  END IF;

  IF v_clean_url IS NOT NULL THEN
    IF length(v_clean_url) > 512
       OR v_clean_url !~ ('^https://[a-z0-9.-]+/[a-z0-9/_.-]*/' || v_auth_uid || '/avatar\.webp(\?v=[0-9]{1,16})?$') THEN
      RAISE EXCEPTION 'La imagen de perfil no corresponde a una fotografía institucional válida en formato WebP'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM set_config('siga.internal_rpc', '1', true);

  UPDATE public.users
     SET avatar_webp_url = v_clean_url
   WHERE id = v_actor_id
     AND deleted_at IS NULL;

  INSERT INTO public.profile_audit_logs (user_id, actor_user_id, action, changed_fields)
  VALUES (
    v_actor_id,
    v_actor_id,
    CASE WHEN v_clean_url IS NULL THEN 'avatar_removed' ELSE 'avatar_updated' END,
    ARRAY['avatar_webp_url']
  );

  RETURN jsonb_build_object(
    'success', true,
    'avatar_webp_url', v_clean_url
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_actualizar_avatar_estudiante(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_actualizar_avatar_estudiante(TEXT) TO authenticated, service_role;
