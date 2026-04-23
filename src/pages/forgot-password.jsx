import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import SiteNav from "../components/SiteNav";
import styles from "../styles/Auth.module.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const handleSubmit = async () => {
    if (submitting) return;

    setMessage("");
    setMessageType("");

    if (!email.trim()) {
      setMessage("Email is required");
      setMessageType("error");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/reset-password",
    });

    if (error) {
      setMessage(error.message);
      setMessageType("error");
    } else {
      setMessage("Check your email for a password reset link");
      setMessageType("success");
    }
    setSubmitting(false);
  };

  return (
    <div className={styles.page}>
      <SiteNav />
      <main className={styles.main}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.title}>Forgot Password</h1>
            <p className={styles.subtitle}>Enter your email and we will send you a password reset link.</p>
          </div>

          <input
            className={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <button type="button" className={styles.primaryBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Sending reset link..." : "Send reset link"}
          </button>

          {message ? (
            <p className={messageType === "error" ? styles.messageError : styles.messageSuccess}>{message}</p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
