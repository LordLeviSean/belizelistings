import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ensureProfile } from "@/lib/ensureProfile";
import {
  normalizeQueryParam,
  parseHashParams,
  pickAuthError,
  pickAuthLinkType,
  resolveAuthCallbackDestination,
  shouldEnsureProfile,
} from "@/lib/authCallback";
import { resolvePostAuthEngagementReturnPath } from "@/lib/authEngagementReturn";
import SiteNav from "@/components/SiteNav";
import styles from "@/styles/Auth.module.css";

/**
 * Handles Supabase email confirmation and OAuth return URLs.
 * Links land here with hash tokens (#access_token=…) or ?code= (PKCE).
 */
export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Confirming your account…");

  useEffect(() => {
    if (!router.isReady) return undefined;

    let cancelled = false;
    let settled = false;

    const finish = (nextStatus, nextMessage, dest = null) => {
      if (cancelled || settled) return;
      settled = true;
      setStatus(nextStatus);
      if (nextMessage) setMessage(nextMessage);
      if (dest) void router.replace(dest);
    };

    const resolveLinkType = (authEvent = null) =>
      pickAuthLinkType({
        hashType: hashParams.type,
        queryType: normalizeQueryParam(router.query.type),
        authEvent,
      });

    const routeAfterSession = async (session, linkType) => {
      const user = session?.user;
      const destination = resolveAuthCallbackDestination({ linkType, hasUser: Boolean(user) });
      if (destination.status === "error") {
        finish(destination.status, destination.message, destination.dest);
        return;
      }

      if (shouldEnsureProfile(linkType)) {
        await ensureProfile(user, { flow: "email-verification", force: true });
      }

      const engagementReturn =
        linkType !== "recovery" ? resolvePostAuthEngagementReturnPath() : null;
      if (engagementReturn) {
        finish("success", "Returning to your listing…", engagementReturn);
        return;
      }

      finish(destination.status, destination.message, destination.dest);
    };

    const resolveSession = async (linkType) => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        finish("error", error.message, resolveAuthCallbackDestination({ hasUser: false }).dest);
        return;
      }
      if (data?.session) {
        await routeAfterSession(data.session, linkType);
      }
    };

    const hashParams =
      typeof window !== "undefined" ? parseHashParams(window.location.hash) : {};
    const queryParams = {
      error: normalizeQueryParam(router.query.error),
      error_description: normalizeQueryParam(router.query.error_description),
      type: normalizeQueryParam(router.query.type),
    };
    const authError = pickAuthError({ hashParams, queryParams });
    const linkType = resolveLinkType();
    const code = normalizeQueryParam(router.query.code);

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled || settled) return;
      if (!session?.user) return;
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "PASSWORD_RECOVERY") {
        await routeAfterSession(session, resolveLinkType(event));
      }
    });

    void (async () => {
      const recoverExistingSession = async () => {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          await routeAfterSession(data.session, linkType);
          return true;
        }
        return false;
      };

      if (authError) {
        if (await recoverExistingSession()) return;
        finish("error", authError, resolveAuthCallbackDestination({ hasUser: false }).dest);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (await recoverExistingSession()) return;
          finish("error", error.message, resolveAuthCallbackDestination({ hasUser: false }).dest);
          return;
        }
      }

      await resolveSession(linkType);

      if (!settled) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        if (!cancelled && !settled) {
          await resolveSession(linkType);
        }
      }

      if (!cancelled && !settled) {
        if (await recoverExistingSession()) return;

        finish(
          "error",
          "Verification link expired or invalid. Sign in or request a new link.",
          resolveAuthCallbackDestination({ hasUser: false }).dest
        );
      }
    })();

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [router.isReady, router.query.code, router.query.type, router.query.error, router.query.error_description, router]);

  return (
    <div className={styles.page}>
      <SiteNav />
      <main className={styles.main}>
        <section className={`${styles.card} ${styles.sessionShell}`} aria-live="polite">
          {status === "processing" ? (
            <>
              <Loader2 className={styles.sessionLoader} strokeWidth={2} aria-hidden />
              <p className={styles.sessionShellNote}>{message}</p>
            </>
          ) : (
            <p className={status === "error" ? styles.messageError : styles.messageSuccess}>{message}</p>
          )}
        </section>
      </main>
    </div>
  );
}
