/** @jest-environment node */

import fs from "fs";
import path from "path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260806160000_push_subscriptions_foundation.sql"
);

describe("20260806160000_push_subscriptions_foundation migration", () => {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");

  test("creates push_subscriptions with lifecycle columns", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.push_subscriptions/);
    expect(sql).toMatch(/user_id uuid NOT NULL REFERENCES auth\.users/);
    expect(sql).toMatch(/endpoint text NOT NULL/);
    expect(sql).toMatch(/p256dh text NOT NULL/);
    expect(sql).toMatch(/auth_secret text NOT NULL/);
    expect(sql).toMatch(/consecutive_failures smallint/);
    expect(sql).toMatch(/revoked_at timestamptz/);
  });

  test("prevents duplicate active endpoints", () => {
    expect(sql).toMatch(/push_subscriptions_active_endpoint_uidx/);
    expect(sql).toMatch(/WHERE is_active = true/);
  });

  test("allows one user to own multiple subscriptions", () => {
    expect(sql).toMatch(/push_subscriptions_user_active_idx/);
    expect(sql).not.toMatch(/UNIQUE \(user_id\)/);
  });

  test("enables RLS without broad client table policies", () => {
    expect(sql).toMatch(/ALTER TABLE public\.push_subscriptions ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY .* ON public\.push_subscriptions FOR SELECT/);
    expect(sql).not.toMatch(/GRANT .* ON TABLE public\.push_subscriptions/);
  });

  test("register_push_subscription derives ownership from auth.uid", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.register_push_subscription/);
    expect(sql).toMatch(/v_user_id := auth\.uid\(\)/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.register_push_subscription/);
    expect(sql).toMatch(/TO authenticated/);
    const registerBlock = sql.split("CREATE OR REPLACE FUNCTION public.register_push_subscription")[1]?.split(
      "CREATE OR REPLACE FUNCTION public.revoke_push_subscription"
    )[0];
    expect(registerBlock).toBeTruthy();
    expect(registerBlock).not.toMatch(/p_user_id uuid/);
  });

  test("revoke_push_subscription is scoped to authenticated owner", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.revoke_push_subscription/);
    expect(sql).toMatch(/WHERE id = p_subscription_id\s+AND user_id = v_user_id/);
  });

  test("anonymous users have no table or delivery access", () => {
    expect(sql).not.toMatch(/GRANT EXECUTE.*register_push_subscription.*TO anon/);
    expect(sql).not.toMatch(/GRANT EXECUTE.*select_active_push_subscriptions_for_delivery.*TO authenticated/);
  });

  test("delivery selector is service_role only", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.select_active_push_subscriptions_for_delivery/);
    expect(sql).toMatch(/IF NOT public\.is_service_role_context\(\)/);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.select_active_push_subscriptions_for_delivery\(uuid\) TO service_role/
    );
  });

  test("list_my_push_subscription_devices hides endpoint and keys", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.list_my_push_subscription_devices/);
    const listBlock = sql.split("CREATE OR REPLACE FUNCTION public.list_my_push_subscription_devices")[1]?.split(
      "CREATE OR REPLACE FUNCTION public.select_active_push_subscriptions_for_delivery"
    )[0];
    expect(listBlock).toMatch(/subscription_id uuid/);
    expect(listBlock).not.toMatch(/\bendpoint text\b/);
    expect(listBlock).not.toMatch(/\bp256dh text\b/);
    expect(listBlock).not.toMatch(/\bauth_secret text\b/);
  });

  test("revoked subscriptions excluded from delivery selection", () => {
    expect(sql).toMatch(/AND ps\.is_active = true/);
    expect(sql).toMatch(/AND ps\.revoked_at IS NULL/);
  });
});
