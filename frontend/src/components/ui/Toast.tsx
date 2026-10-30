import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import styles from './Toast.module.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface AddToastParams {
  title?: string;
  message?: string;
  variant?: 'success' | 'danger' | 'warning' | 'neutral' | 'info';
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  addToast: (toast: AddToastParams) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const addToast = useCallback(
    ({ title, message, variant = 'info', duration = 4000 }: AddToastParams) => {
      let mappedType: ToastType = 'info';
      if (variant === 'success') mappedType = 'success';
      else if (variant === 'danger') mappedType = 'error';
      else if (variant === 'warning') mappedType = 'warning';
      showToast({ type: mappedType, title, message: message || '', duration });
    },
    [showToast]
  );

  const success = useCallback((msg: string, title?: string) => showToast({ type: 'success', message: msg, title }), [showToast]);
  const error = useCallback((msg: string, title?: string) => showToast({ type: 'error', message: msg, title }), [showToast]);
  const warning = useCallback((msg: string, title?: string) => showToast({ type: 'warning', message: msg, title }), [showToast]);
  const info = useCallback((msg: string, title?: string) => showToast({ type: 'info', message: msg, title }), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, addToast, success, error, warning, info }}>
      {children}
      <div className={styles.container} aria-live="polite">
        {toasts.map((toast) => {
          let Icon = Info;
          if (toast.type === 'success') Icon = CheckCircle2;
          if (toast.type === 'error') Icon = AlertCircle;
          if (toast.type === 'warning') Icon = AlertTriangle;

          return (
            <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
              <Icon className={styles.icon} size={20} />
              <div className={styles.content}>
                {toast.title && <div className={styles.title}>{toast.title}</div>}
                <div className={styles.message}>{toast.message}</div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => removeToast(toast.id)}
                aria-label="Close notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
