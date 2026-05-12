import { useState, useLayoutEffect, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { ensureProfile } from "../lib/ensureProfile";
import { lookupUsernameAvailability } from "../lib/usernameAvailability";
import SiteNav from "../components/SiteNav";
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

  const toggleMode = () => {
    setIsSignup((v) => !v);
    setMessage("");
    setMessageType("");
    setUsername("");
    setUsernameAvail("empty");
    setUsernameHint("");
  };

  const handleSubmit = async () => {
    if (submitting) return;

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

      if (usernameAvail === "checking") {
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
        if (signData?.user) {
          await ensureProfile(signData.user);
        }
        setMessage("Account created. Check your email.");
        setMessageType("success");
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

  const onPasswordKeyDown = (e) => {
    if (e.key !== "Enter" || isSignup) return;
    e.preventDefault();
    if (!submitting) void handleSubmit();
  };

  return (
    <div className={`${styles.page} ${isSignup ? styles.pageSignup : ""}`}>
      <SiteNav />

      <main className={styles.main}>
        <section className={`${styles.card} ${isSignup ? styles.cardSignup : ""}`}>
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
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={styles.input}
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onPasswordKeyDown}
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
          <button
            type="button"
            className={styles.secondaryBtn}
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
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.secondaryBtn}
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
            disabled={submitting}
          >
            {submitting ? (isSignup ? "Creating account..." : "Signing in...") : isSignup ? "Create Account" : "Sign In"}
          </button>

          <button type="button" className={styles.secondaryBtn} onClick={toggleMode}>
            {isSignup ? "Already have an account? Sign in" : "Don't have an account? Create one"}
          </button>
          {!isSignup ? (
            <Link className={styles.textLink} href="/forgot-password">
              Forgot password?
            </Link>
          ) : null}

          {message ? (
            <p className={messageType === "error" ? styles.messageError : styles.messageSuccess}>{message}</p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
