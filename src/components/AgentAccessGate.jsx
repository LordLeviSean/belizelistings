import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import styles from "../styles/Dashboard.module.css";

export default function AgentAccessGate({ user, onApproved }) {
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");

  const hasPendingRequest = useMemo(() => request?.status === "pending", [request]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    const loadRequest = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("agent_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        setRequest(data ?? null);
        setLoading(false);
      }
    };

    loadRequest();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const submitRequest = async (event) => {
    event.preventDefault();
    if (!user?.id || submitting) return;
    if (!fullName.trim() || !phone.trim()) {
      setFeedback("Full name and phone are required.");
      return;
    }

    setSubmitting(true);
    setFeedback("");

    const { data: pending } = await supabase
      .from("agent_requests")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (pending?.id) {
      setFeedback("You already have a pending request.");
      setRequest(pending);
      setShowForm(false);
      setSubmitting(false);
      return;
    }

    const payload = {
      user_id: user.id,
      full_name: fullName.trim(),
      phone: phone.trim(),
      message: message.trim() || null,
    };

    const { data, error } = await supabase.from("agent_requests").insert(payload).select("*").maybeSingle();

    if (error) {
      setFeedback(error.message);
    } else {
      setRequest(data ?? { status: "pending" });
      setShowForm(false);
      setFullName("");
      setPhone("");
      setMessage("");
      setFeedback("Request submitted successfully.");
      onApproved?.();
    }

    setSubmitting(false);
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.sectionTitle}>You are not an agent</h2>
      {loading ? <p className={styles.muted}>Checking request status...</p> : null}
      {!loading && hasPendingRequest ? <p className={styles.muted}>Your request is pending.</p> : null}
      {!loading && !hasPendingRequest ? (
        <>
          <button type="button" className={styles.primaryButton} onClick={() => setShowForm((value) => !value)}>
            Become an Agent
          </button>
          {showForm ? (
            <form className={styles.form} onSubmit={submitRequest}>
              <input
                className={styles.input}
                placeholder="Full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
              <input
                className={styles.input}
                placeholder="Phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
              <textarea
                className={styles.textarea}
                placeholder="Message (optional)"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <button type="submit" className={styles.primaryButton} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          ) : null}
        </>
      ) : null}
      {feedback ? <p className={styles.muted}>{feedback}</p> : null}
    </section>
  );
}
