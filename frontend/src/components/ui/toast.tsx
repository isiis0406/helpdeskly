"use client";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type Toast = { id: string; title?: string; description?: string };

const ToastCtx = createContext<{
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, ...t }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((x) => x.id !== id)),
      3000
    );
  }, []);
  const remove = useCallback(
    (id: string) => setToasts((p) => p.filter((x) => x.id !== id)),
    []
  );
  const value = useMemo(
    () => ({ toasts, push, remove }),
    [toasts, push, remove]
  );
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rounded bg-gray-900 text-white px-4 py-2 shadow"
          >
            {t.title && <div className="font-medium">{t.title}</div>}
            {t.description && (
              <div className="text-sm opacity-90">{t.description}</div>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
