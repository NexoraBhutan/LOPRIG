import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle, Info, XCircle, X } from "@phosphor-icons/react";

const ToastContext = createContext(null);
let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, type = "success") => {
      const id = ++idCounter;
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => dismiss(id), 3800);
    },
    [dismiss]
  );

  const iconMap = {
    success: <CheckCircle size={18} weight="fill" className="text-gold-dark" />,
    error: <XCircle size={18} weight="fill" className="text-red" />,
    info: <Info size={18} weight="fill" className="text-ink" />,
  };

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center gap-3 px-5 py-3.5 rounded-xl bg-white border-2 border-line shadow-elevated text-sm font-medium text-ink-strong animate-[slideUp_0.3s_ease-out]`} role="status">
            {iconMap[t.type]}
            <span className="flex-1">{t.message}</span>
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-muted hover:bg-bg-soft hover:text-ink-strong transition-colors bg-transparent border-none cursor-pointer" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <X size={14} weight="bold" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
