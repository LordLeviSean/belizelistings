import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

function toastColors(type) {
  if (type === "success") {
    return { border: "#1f8f62", icon: "#6fe6b3" };
  }
  if (type === "error") {
    return { border: "#9f3348", icon: "#ff8fa1" };
  }
  return { border: "#355f9f", icon: "#89b7ff" };
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
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        {toasts.map((toast) => {
          const colors = toastColors(toast.type);
          return (
            <div
              key={toast.id}
              style={{
                minWidth: 240,
                maxWidth: 360,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                background: "#12161c",
                color: "#e8edf3",
                boxShadow: "0 10px 28px rgba(0, 0, 0, 0.35)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                pointerEvents: "auto",
                animation: "toastSlideIn 180ms ease-out",
              }}
            >
              <span style={{ color: colors.icon, fontSize: 16, lineHeight: 1.1 }}>
                {toast.type === "success" ? "✓" : toast.type === "error" ? "!" : "i"}
              </span>
              <span style={{ fontSize: 14 }}>{toast.message}</span>
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
