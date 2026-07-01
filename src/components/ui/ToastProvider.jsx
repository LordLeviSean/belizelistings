import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import styles from "./ToastProvider.module.css";

const ToastContext = createContext(null);

function glassFavoriteRemovedLike() {
  return {
    variant: "glassFavorite",
    glassStyles: {
      border: "1px solid rgba(166, 198, 196, 0.42)",
      background:
        "radial-gradient(circle at 8% 4%, rgba(232, 240, 255, 0.45), transparent 50%)," +
        "radial-gradient(circle at 94% 88%, rgba(255, 220, 210, 0.22), transparent 48%)," +
        "linear-gradient(172deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 251, 255, 0.86) 45%, rgba(244, 250, 248, 0.9) 100%)",
      color: "rgba(44, 78, 86, 0.92)",
      boxShadow:
        "0 0 0 1px rgba(255, 255, 255, 0.42) inset, 0 12px 32px rgba(88, 128, 124, 0.1)," +
        "0 22px 40px rgba(102, 132, 140, 0.1)",
      backdropFilter: "blur(17px) saturate(1.05)",
      WebkitBackdropFilter: "blur(17px) saturate(1.05)",
    },
    iconWrapStyle: {
      color: "rgba(200, 88, 160, 0.72)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    heartProps: { fill: "none" },
  };
}

function toastPresentation(type) {
  if (type === "favorite_add") {
    return {
      variant: "glassFavorite",
      glassStyles: {
        border: "1px solid rgba(236, 92, 196, 0.38)",
        background:
          "radial-gradient(circle at 12% 0%, rgba(255, 228, 244, 0.55), transparent 52%)," +
          "radial-gradient(circle at 92% 8%, rgba(196, 230, 246, 0.35), transparent 48%)," +
          "linear-gradient(165deg, rgba(255, 255, 255, 0.92) 0%, rgba(255, 246, 252, 0.88) 38%, rgba(242, 252, 250, 0.9) 100%)",
        color: "rgba(38, 72, 80, 0.96)",
        boxShadow:
          "0 0 0 1px rgba(255, 255, 255, 0.4) inset, 0 12px 32px rgba(186, 48, 128, 0.12)," +
          "0 22px 44px rgba(102, 142, 140, 0.12)",
        backdropFilter: "blur(18px) saturate(1.08)",
        WebkitBackdropFilter: "blur(18px) saturate(1.08)",
      },
      iconWrapStyle: {
        color: "rgba(186, 28, 128, 0.92)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      },
      heartProps: { fill: "currentColor" },
    };
  }

  if (type === "favorite_remove" || type === "favorite_clear") {
    return glassFavoriteRemovedLike();
  }

  if (type === "success") {
    return { variant: "dark", colors: { border: "#1f8f62", icon: "#6fe6b3" } };
  }
  if (type === "error") {
    return { variant: "dark", colors: { border: "#9f3348", icon: "#ff8fa1" } };
  }
  return { variant: "dark", colors: { border: "#355f9f", icon: "#89b7ff" } };
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = "info", message }) => {
      if (!message) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      window.setTimeout(() => dismissToast(id), 3600);
    },
    [dismissToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className={styles.stack}
      >
        {toasts.map((toast) => {
          const preset = toastPresentation(toast.type);
          const glass = preset.variant === "glassFavorite";
          const colors = preset.colors;

          return (
            <div
              key={toast.id}
              className={`${styles.toast} ${glass ? styles.toastGlass : ""}`}
              style={{
                animation: "toastSlideIn 260ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                ...(glass && preset.glassStyles),
                ...(glass
                  ? {}
                  : {
                      border: `1px solid ${colors.border}`,
                      background: "#12161c",
                      color: "#e8edf3",
                      boxShadow: "0 10px 28px rgba(0, 0, 0, 0.35)",
                    }),
              }}
            >
              {glass ? (
                <span style={preset.iconWrapStyle} aria-hidden>
                  <Heart width={17} height={17} strokeWidth={1.85} {...preset.heartProps} />
                </span>
              ) : (
                <span style={{ color: colors.icon, fontSize: 16, lineHeight: 1.1 }}>
                  {toast.type === "success" ? "✓" : toast.type === "error" ? "!" : "i"}
                </span>
              )}
              <span
                style={{
                  fontSize: glass ? 13.5 : 14,
                  fontWeight: glass ? 600 : 400,
                  letterSpacing: glass ? "0.01em" : "normal",
                  lineHeight: 1.42,
                  fontFamily: glass ? '"DM Sans", "Segoe UI", system-ui, sans-serif' : "inherit",
                }}
              >
                {toast.message}
              </span>
            </div>
          );
        })}
      </div>
      <style jsx global>{`
        @keyframes toastSlideIn {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
