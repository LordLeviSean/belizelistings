-- Server-backed visual mode configuration (public read / admin write via RPC).
-- Seeds four keys in platform_runtime_config; exposes narrow public read;
-- admin updates require is_admin() inside SECURITY DEFINER RPC.

INSERT INTO public.platform_runtime_config (config_key, config_value)
VALUES
  ('live_palette_mode', '0'),
  ('pulse_mode', '0'),
  ('sea_flow_mode', '0'),
  ('sea_flow_intensity', '0.5')
ON CONFLICT (config_key) DO NOTHING;

ALTER TABLE public.platform_runtime_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_runtime_config_public_visual_read" ON public.platform_runtime_config;
CREATE POLICY "platform_runtime_config_public_visual_read"
ON public.platform_runtime_config
FOR SELECT
TO anon, authenticated
USING (
  config_key IN (
    'live_palette_mode',
    'pulse_mode',
    'sea_flow_mode',
    'sea_flow_intensity'
  )
);

CREATE OR REPLACE FUNCTION public.get_public_visual_mode_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT jsonb_build_object(
    'livePalette',
      COALESCE(
        (SELECT config_value FROM public.platform_runtime_config WHERE config_key = 'live_palette_mode'),
        '0'
      ) = '1',
    'pulse',
      COALESCE(
        (SELECT config_value FROM public.platform_runtime_config WHERE config_key = 'pulse_mode'),
        '0'
      ) = '1',
    'seaFlow',
      COALESCE(
        (SELECT config_value FROM public.platform_runtime_config WHERE config_key = 'sea_flow_mode'),
        '0'
      ) = '1',
    'seaFlowIntensity',
      LEAST(
        5::numeric,
        GREATEST(
          0::numeric,
          COALESCE(
            NULLIF(
              (SELECT config_value FROM public.platform_runtime_config WHERE config_key = 'sea_flow_intensity'),
              ''
            )::numeric,
            0.5
          )
        )
      )
  );
$$;

COMMENT ON FUNCTION public.get_public_visual_mode_config() IS
  'Returns the four public visual-mode settings as JSON; no other platform_runtime_config keys exposed.';

REVOKE ALL ON FUNCTION public.get_public_visual_mode_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_visual_mode_config() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_visual_mode_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_visual_mode_config() TO service_role;

CREATE OR REPLACE FUNCTION public.update_visual_mode_platform_config(
  p_live_palette_mode boolean,
  p_pulse_mode boolean,
  p_sea_flow_mode boolean,
  p_sea_flow_intensity numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_sea_flow_intensity IS NULL
     OR p_sea_flow_intensity < 0
     OR p_sea_flow_intensity > 5 THEN
    RAISE EXCEPTION 'invalid_sea_flow_intensity' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.platform_runtime_config (config_key, config_value, updated_at)
  VALUES
    ('live_palette_mode', CASE WHEN p_live_palette_mode THEN '1' ELSE '0' END, timezone('utc'::text, now())),
    ('pulse_mode', CASE WHEN p_pulse_mode THEN '1' ELSE '0' END, timezone('utc'::text, now())),
    ('sea_flow_mode', CASE WHEN p_sea_flow_mode THEN '1' ELSE '0' END, timezone('utc'::text, now())),
    (
      'sea_flow_intensity',
      trim(to_char(p_sea_flow_intensity, 'FM9999990.0#')),
      timezone('utc'::text, now())
    )
  ON CONFLICT (config_key) DO UPDATE
  SET config_value = EXCLUDED.config_value,
      updated_at = EXCLUDED.updated_at;

  RETURN public.get_public_visual_mode_config();
END;
$$;

COMMENT ON FUNCTION public.update_visual_mode_platform_config(boolean, boolean, boolean, numeric) IS
  'Admin-only upsert of visual-mode platform_runtime_config keys; authorized via is_admin().';

REVOKE ALL ON FUNCTION public.update_visual_mode_platform_config(boolean, boolean, boolean, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_visual_mode_platform_config(boolean, boolean, boolean, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_visual_mode_platform_config(boolean, boolean, boolean, numeric) TO service_role;
