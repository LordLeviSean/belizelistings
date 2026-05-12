import React from "react";
import styles from "./AppErrorBoundary.module.css";

/**
 * Catches unexpected React render errors so beta users see a calm recovery surface
 * instead of a blank shell (does not catch async/event-handler errors).
 */
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[AppErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.shell} role="alert">
          <div className={styles.card}>
            <h1 className={styles.title}>Something paused this screen</h1>
            <p className={styles.body}>
              BelizeListings hit an unexpected display issue. Your session and listings are usually unaffected —
              try reloading. If this repeats, note what you clicked last so we can trace it.
            </p>
            <button type="button" className={styles.reload} onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
