-- Fix admin visual-mode updates: to_char(..., 'FM9999990.0#') appended a literal '#'
-- to sea_flow_intensity (e.g. '0.5#'), causing get_public_visual_mode_config() to fail
-- when casting config_value back to numeric after upsert.

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
      trim(to_char(p_sea_flow_intensity, 'FM999999990.0999999')),
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
