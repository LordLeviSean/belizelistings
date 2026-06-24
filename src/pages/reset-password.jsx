import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import SiteNav from "../components/SiteNav";
import styles from "../styles/Auth.module.css";
import { validateResetPassword } from "../utils/passwordValidation";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setHasSession(Boolean(data?.session));
      setSessionChecked(true);
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "PASSWORD_RECOVERY") {
        setHasSession(Boolean(session?.user));
      } else if (!session?.user) {
        setHasSession(false);
      }

      setSessionChecked(true);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async () => {
    if (submitting || !hasSession) return;

    setMessage("");
    setMessageType("");

    const validationError = validateResetPassword(password, confirmPassword);
    if (validationError) {
      setMessage(validationError);
      setMessageType("error");
      return;
    }
    if (!password) {
      setMessage("Password is required");
      setMessageType("error");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      console.error("RESET ERROR:", error);
      setMessage(error.message);
      setMessageType("error");
    } else {
      setMessage("Password updated successfully. Redirecting to login...");
      setMessageType("success");
      setTimeout(async () => {
        await supabase.auth.signOut();
        router.push("/login");
      }, 2500);
    }
    setSubmitting(false);
  };

  const confirmMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className={styles.page}>
      <SiteNav />
      <main className={styles.main}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.title}>Reset Password</h1>
            <p className={styles.subtitle}>Set a new password for your account.</p>
          </div>

          {!sessionChecked ? (
            <p className={styles.subtitle}>Verifying reset link...</p>
          ) : !hasSession ? (
            <p className={styles.messageError}>Invalid or expired reset link</p>
          ) : (
            <>
              <input
                className={styles.input}
                type={showPassword ? "text" : "password"}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? "Hide password" : "Show password"}
              </button>

              <p className={styles.subtitle}>Password must be at least 6 characters.</p>

              <input
                className={styles.input}
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setShowConfirmPassword((v) => !v)}
              >
                {showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              </button>

              {confirmMismatch ? <p className={styles.messageError}>Passwords do not match</p> : null}

              <button type="button" className={styles.primaryBtn} onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Updating password..." : "Update password"}
              </button>
            </>
          )}

          {message ? (
            <p className={messageType === "error" ? styles.messageError : styles.messageSuccess}>{message}</p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
