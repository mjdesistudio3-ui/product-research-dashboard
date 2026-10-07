'use client';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

interface ToastItem {
  id: number;
  msg: string;
}

/**
 * App-wide toast host. Wrap the layout in <ToastProvider>, then call
 * const toast = useToast(); toast('Saved ✓') from any client component.
 * Toasts auto-dismiss after ~3s. Rendered fixed bottom-right.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((msg: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-2), { id, msg }]); // cap at 3 visible
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-in max-w-xs rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg"
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
