import { useState, useLayoutEffect, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { ensureProfile } from "../lib/ensureProfile";
import { lookupUsernameAvailability } from "../lib/usernameAvailability";
import SiteNav from "../components/SiteNav";
import useUserRole from "../hooks/useUserRole";
import { useAuthGate } from "../components/auth/AuthGateProvider";
import { validateSignupUsername } from "../lib/usernameRules";
import styles from "../styles/Auth.module.css";

const USERNAME_TAKEN_MSG = "Username already taken, try a new username";

function getPasswordRequirements(password) {
  return {
    minLength: password.length >= 6,
    hasLetter: /[A-Za-z]/.test(password),
    hasNumber: /\d/.test(password),
  };
}

function isPasswordValid(password) {
  const checks = getPasswordRequirements(password);
  return checks.minLength && checks.hasLetter && checks.hasNumber;
}

function evaluatePasswordStrength(password) {
  const checks = getPasswordRequirements(password);
  const meetsBasic = checks.minLength && checks.hasLetter && checks.hasNumber;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!meetsBasic) return "weak";
  if (password.length >= 10 && (hasMixedCase || hasSymbol)) return "strong";
  return "medium";
}

export default function Login() {
  const router = useRouter();
  const { user: sessionUser, loading: authLoading } = useUserRole();
  const { presentAlreadySignedInModal } = useAuthGate();
  const [username, setUsername] = useState("");
  const [usernameAvail, setUsernameAvail] = useState("empty");
  const [usernameHint, setUsernameHint] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);

  useLayoutEffect(() => {
    if (!router.isReady) return;
    const signup = router.query.signup;
    const mode = router.query.mode;
    const wantSignup =
      signup === "1" ||
      signup === "true" ||
      String(signup || "").toLowerCase() === "yes" ||
      mode === "signup";
    if (wantSignup) setIsSignup(true);
  }, [router.isReady, router.query.signup, router.query.mode]);

  useEffect(() => {
    if (!router.isReady || authLoading) return;
    if (!sessionUser) return;
    const q = router.query;
    const wantSignup =
      q.signup === "1" ||
      q.signup === "true" ||
      String(q.signup || "").toLowerCase() === "yes" ||
      q.mode === "signup";
    presentAlreadySignedInModal({ signup: wantSignup });
  }, [router.isReady, router.query, authLoading, sessionUser, presentAlreadySignedInModal]);

  useEffect(() => {
    if (!isSignup) {
      setUsernameAvail("empty");
      setUsernameHint("");
      return undefined;
    }

    if (!username.trim()) {
      setUsernameAvail("empty");
      setUsernameHint("");
      return undefined;
    }

    const v = validateSignupUsername(username);
    if (!v.ok && v.code === "short") {
      setUsernameAvail("short");
      setUsernameHint(v.message || "");
      return undefined;
    }
    if (!v.ok) {
      setUsernameAvail("invalid");
      setUsernameHint(v.message || "");
      return undefined;
    }

    setUsernameAvail("scanning");
    setUsernameHint("");
    let cancelled = false;
    const ac = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await lookupUsernameAvailability(v.username, ac.signal);
          if (cancelled) return;
          if (result.status === "available") {
            setUsernameAvail("available");
            setUsernameHint("Available");
          } else if (result.status === "taken") {
            setUsernameAvail("taken");
            setUsernameHint(USERNAME_TAKEN_MSG);
          } else {
            setUsernameAvail("error");
            setUsernameHint(result.message || "Could not verify username. Try again.");
          }
        } catch (e) {
          if (e?.name === "AbortError" || cancelled) return;
          if (!cancelled) {
            setUsernameAvail("error");
            setUsernameHint("Could not verify username. Try again.");
          }
        }
      })();
    }, 440);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      ac.abort();
    };
  }, [username, isSignup]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [signupSuccessOpen, setSignupSuccessOpen] = useState(false);
  const [signupSuccessEmail, setSignupSuccessEmail] = useState("");
  /** "full" = client confirmed profiles row; "email" = verify-email flow (no JWT yet; DB trigger owns insert). */
  const [signupSuccessMode, setSignupSuccessMode] = useState("full");
  const [signupRecoveryUser, setSignupRecoveryUser] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [signupModalNotice, setSignupModalNotice] = useState("");

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const t = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (!signupSuccessOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [signupSuccessOpen]);

  const toggleMode = () => {
    setIsSignup((v) => !v);
    setMessage("");
    setMessageType("");
    setUsername("");
    setUsernameAvail("empty");
    setUsernameHint("");
    setSignupSuccessOpen(false);
    setSignupSuccessEmail("");
    setSignupSuccessMode("full");
    setSignupRecoveryUser(null);
    setSignupModalNotice("");
    setResendCooldown(0);
  };

  const closeSuccessModalToSignIn = () => {
    setSignupSuccessOpen(false);
    setSignupSuccessEmail("");
    setSignupSuccessMode("full");
    setSignupRecoveryUser(null);
    setSignupModalNotice("");
    setResendCooldown(0);
    setUsername("");
    setUsernameAvail("empty");
    setUsernameHint("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsSignup(false);
  };

  const handleProfileSetupRetry = async () => {
    if (submitting || !signupRecoveryUser?.id) return;
    setSubmitting(true);
    setMessage("");
    setMessageType("");
    const prof = await ensureProfile(signupRecoveryUser, { flow: "signup-retry", force: true });
    setSubmitting(false);
    if (prof.ok && prof.profile?.id) {
      setSignupRecoveryUser(null);
      setSignupSuccessEmail(email.trim());
      setSignupSuccessMode("full");
      setSignupModalNotice("");
      setSignupSuccessOpen(true);
    } else if (prof.deferredWithoutSession) {
      setSignupRecoveryUser(null);
      setSignupSuccessEmail(email.trim());
      setSignupSuccessMode("email");
      setSignupModalNotice("");
      setSignupSuccessOpen(true);
    } else {
      setMessage(
        "We still could not confirm your profile. Try again, or verify your email and sign in — we will repair your profile automatically."
      );
      setMessageType("error");
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || !signupSuccessEmail.trim()) return;
    setSignupModalNotice("");
    setResendCooldown(50);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: signupSuccessEmail.trim(),
    });
    if (error) {
      setSignupModalNotice(error.message);
      setResendCooldown(0);
    } else {
      setSignupModalNotice("Verification email sent again.");
    }
  };

  const handleSubmit = async () => {
    if (submitting || signupSuccessOpen) return;
    if (!authLoading && sessionUser) return;

    setMessage("");
    setMessageType("");

    let signupUsername = null;
    if (isSignup) {
      const uv = validateSignupUsername(username);
      if (!uv.ok) {
        setMessage(uv.message || "Please enter a valid username.");
        setMessageType("error");
        return;
      }
      signupUsername = uv.username;

      if (usernameAvail === "scanning") {
        setMessage("Please wait for the username check to finish.");
        setMessageType("error");
        return;
      }
      if (usernameAvail !== "available") {
        setMessage(
          usernameAvail === "taken" ? USERNAME_TAKEN_MSG : "Choose an available username before continuing."
        );
        setMessageType("error");
        return;
      }

      const dupCheck = await lookupUsernameAvailability(signupUsername);
      if (dupCheck.status === "taken") {
        setUsernameAvail("taken");
        setUsernameHint(USERNAME_TAKEN_MSG);
        setMessage(USERNAME_TAKEN_MSG);
        setMessageType("error");
        return;
      }
      if (dupCheck.status !== "available") {
        setMessage(dupCheck.message || "Unable to verify username. Try again.");
        setMessageType("error");
        return;
      }
    }

    if (!email.trim()) {
      setMessage("Email is required");
      setMessageType("error");
      return;
    }

    if (!isPasswordValid(password)) {
      setMessage("Password must be at least 6 characters and include a letter and a number");
      setMessageType("error");
      return;
    }

    if (isSignup && password !== confirmPassword) {
      setMessage("Passwords do not match");
      setMessageType("error");
      return;
    }

    setSubmitting(true);

    if (isSignup) {
      const { data: signData, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { username: signupUsername },
        },
      });

      if (error) {
        setMessage(error.message);
        setMessageType("error");
      } else {
        const createdUser = signData?.user ?? null;
        const hasSession = Boolean(signData?.session);
        let prof = {
          ok: false,
          profile: null,
          deferredWithoutSession: false,
          clientVerified: false,
        };
        if (createdUser) {
          prof = await ensureProfile(createdUser, {
            flow: "signup",
            force: true,
            signUpSummary: {
              hasSession,
              userId: createdUser.id,
              identities: Array.isArray(createdUser.identities) ? createdUser.identities.length : 0,
            },
          });
        }

        if (!createdUser) {
          setSignupSuccessEmail(email.trim());
          setSignupSuccessMode("email");
          setSignupModalNotice("");
          setSignupRecoveryUser(null);
          setSignupSuccessOpen(true);
        } else if (hasSession && !prof.ok) {
          setSignupRecoveryUser(createdUser);
          setMessage(
            "Your account was created but we could not confirm your profile in the app. Use “Retry profile setup”, or sign out and sign in after verifying your email."
          );
          setMessageType("error");
        } else if (hasSession && prof.ok) {
          setSignupRecoveryUser(null);
          setSignupSuccessEmail(email.trim());
          setSignupSuccessMode("full");
          setSignupModalNotice("");
          setSignupSuccessOpen(true);
        } else {
          setSignupRecoveryUser(null);
          setSignupSuccessEmail(email.trim());
          setSignupSuccessMode("email");
          setSignupModalNotice("");
          setSignupSuccessOpen(true);
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        setMessageType("error");
      } else {
        router.push("/");
      }
    }

    setSubmitting(false);
  };

  const passwordChecks = getPasswordRequirements(password);
  const passwordStrength = evaluatePasswordStrength(password);
  const strengthColor =
    passwordStrength === "strong" ? "#22c55e" : passwordStrength === "medium" ? "#facc15" : "#ef4444";
  const strengthWidth = passwordStrength === "strong" ? "100%" : passwordStrength === "medium" ? "66%" : "33%";
  const confirmMismatch = isSignup && confirmPassword.length > 0 && password !== confirmPassword;
  const signInPasswordStarted = !isSignup && password.length > 0;

  const accountLocked = !authLoading && Boolean(sessionUser);
  const formHidden = signupSuccessOpen || accountLocked;
  const formDisabled = submitting || signupSuccessOpen || accountLocked;

  const onPasswordKeyDown = (e) => {
    if (signupSuccessOpen || accountLocked) return;
    if (e.key !== "Enter" || isSignup) return;
    e.preventDefault();
    if (!submitting) void handleSubmit();
  };

  const mailtoHref = signupSuccessEmail.trim() ? `mailto:${signupSuccessEmail.trim()}` : "mailto:";

  if (authLoading) {
    return (
      <div className={`${styles.page} ${isSignup ? styles.pageSignup : ""}`}>
        <SiteNav />
        <main className={styles.main}>
          <div className={styles.authStage}>
            <section
              className={`${styles.card} ${isSignup ? styles.cardSignup : ""} ${styles.sessionShell}`}
              aria-busy="true"
              aria-label="Checking session"
            >
              <Loader2 className={styles.sessionLoader} strokeWidth={2} aria-hidden />
              <p className={styles.sessionShellNote}>Checking session…</p>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${isSignup ? styles.pageSignup : ""}`}>
      <SiteNav />

      <main className={styles.main}>
        <div className={styles.authStage}>
          <section
            className={`${styles.card} ${isSignup ? styles.cardSignup : ""} ${formHidden ? styles.cardLocked : ""}`}
            aria-hidden={formHidden}
          >
          <div className={styles.cardHeader}>
            {isSignup ? <span className={styles.modePill}>New account</span> : null}
            <h1 className={`${styles.title} ${isSignup ? styles.titleSignup : ""}`}>
              {isSignup ? "Create Account" : "Sign In"}
            </h1>
            {isSignup ? (
              <p className={styles.subtitle}>Join BelizeListings to save favorites and searches.</p>
            ) : null}
          </div>

          {isSignup ? (
            <div className={styles.usernameBlock}>
              <input
                className={styles.input}
                placeholder="Username"
                value={username}
                autoComplete="username"
                disabled={formDisabled}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p
                className={styles.usernameFeedback}
                data-tone={
                  usernameAvail === "empty" || usernameAvail === "scanning" ? undefined : usernameAvail
                }
              >
                {usernameHint}
              </p>
            </div>
          ) : null}

          <input
            className={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            autoComplete={isSignup ? "email" : "email"}
            disabled={formDisabled}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={styles.input}
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            disabled={formDisabled}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onPasswordKeyDown}
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={formDisabled}
            onClick={() => setShowPassword((v) => !v)}
            style={{ marginTop: "-0.35rem" }}
          >
            {showPassword ? "Hide password" : "Show password"}
          </button>

          {isSignup ? (
            <>
              <div style={{ marginTop: "0.2rem", marginBottom: "0.4rem" }}>
                <p style={{ color: "#a9b4c5", marginBottom: "0.5rem" }}>Password requirements</p>
                <p style={{ color: passwordChecks.minLength ? "#22c55e" : "#7b8794", margin: "0.2rem 0" }}>
                  {passwordChecks.minLength ? "✔" : "○"} At least 6 characters
                </p>
                <p style={{ color: passwordChecks.hasLetter ? "#22c55e" : "#7b8794", margin: "0.2rem 0" }}>
                  {passwordChecks.hasLetter ? "✔" : "○"} At least 1 letter
                </p>
                <p style={{ color: passwordChecks.hasNumber ? "#22c55e" : "#7b8794", margin: "0.2rem 0" }}>
                  {passwordChecks.hasNumber ? "✔" : "○"} At least 1 number
                </p>
              </div>

              <div style={{ marginBottom: "0.8rem" }}>
                <p style={{ color: "#a9b4c5", marginBottom: "0.35rem" }}>
                  Strength: {password ? passwordStrength : "weak"}
                </p>
                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    borderRadius: "999px",
                    backgroundColor: "rgba(255, 255, 255, 0.12)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: password ? strengthWidth : "0%",
                      height: "100%",
                      backgroundColor: strengthColor,
                      transition: "width 180ms ease, background-color 180ms ease",
                    }}
                  />
                </div>
              </div>
            </>
          ) : null}

          {isSignup ? (
            <>
              <input
                className={styles.input}
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm password"
                value={confirmPassword}
                disabled={formDisabled}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={formDisabled}
                onClick={() => setShowConfirmPassword((v) => !v)}
                style={{ marginTop: "-0.35rem" }}
              >
                {showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              </button>
              {confirmMismatch ? <p className={styles.messageError}>Passwords do not match</p> : null}
            </>
          ) : null}

          <button
            type="button"
            className={`${styles.primaryBtn} ${isSignup ? styles.primaryBtnSignup : ""} ${signInPasswordStarted ? styles.primaryBtnSignInLit : ""}`}
            onClick={handleSubmit}
            disabled={formDisabled}
          >
            {submitting ? (isSignup ? "Creating account..." : "Signing in...") : isSignup ? "Create Account" : "Sign In"}
          </button>

          <button type="button" className={styles.secondaryBtn} disabled={formDisabled} onClick={toggleMode}>
            {isSignup ? "Already have an account? Sign in" : "Don't have an account? Create one"}
          </button>
          {!isSignup ? (
            <Link className={styles.textLink} href="/forgot-password">
              Forgot password?
            </Link>
          ) : null}

          {message && messageType === "error" ? (
            <div>
              <p className={styles.messageError}>{message}</p>
              {signupRecoveryUser?.id ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={submitting}
                  onClick={() => void handleProfileSetupRetry()}
                  style={{ marginTop: "0.75rem" }}
                >
                  {submitting ? "Retrying…" : "Retry profile setup"}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

          {signupSuccessOpen ? (
            <>
              <div className={styles.successBackdrop} aria-hidden />
              <div
                className={styles.successModal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="signup-success-title"
              >
                <h2 id="signup-success-title" className={styles.successModalTitle}>
                  {signupSuccessMode === "full" ? "Account created" : "Check your email"}
                </h2>
                <p className={styles.successModalBody}>
                  {signupSuccessMode === "full"
                    ? "Your profile is ready. We sent a verification link to your email."
                    : "We sent a verification link to your email."}
                  <br />
                  Please verify your account before signing in.
                </p>
                <p className={styles.successModalFine}>
                  Check spam or promotions if you don&apos;t see it.
                </p>
                <div className={styles.successModalActions}>
                  <a className={styles.successPrimaryLink} href={mailtoHref}>
                    Open Email
                  </a>
                  <button type="button" className={styles.successSecondaryBtn} onClick={closeSuccessModalToSignIn}>
                    Back to Sign In
                  </button>
                  <button
                    type="button"
                    className={styles.successTertiaryBtn}
                    onClick={() => void handleResendVerification()}
                    disabled={resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Resend Email (${resendCooldown}s)` : "Resend Email"}
                  </button>
                </div>
                {signupModalNotice ? (
                  <p className={styles.successModalFine} style={{ marginTop: 12, marginBottom: 0 }}>
                    {signupModalNotice}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
