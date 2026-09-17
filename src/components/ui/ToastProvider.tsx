'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { useLanguage } from '@/components/i18n/LanguageProvider';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  durationMs: number;
}

/**
 * Errors are the one kind a user has to read before acting, and three seconds
 * was not enough to read and understand one.
 */
const TOAST_DURATION_MS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
};

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useLanguage();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = Math.random().toString(36).substring(2, 9);
      const durationMs = TOAST_DURATION_MS[type];
      setToasts((prev) => [...prev, { id, message, type, durationMs }]);
      setTimeout(() => dismissToast(id), durationMs);
    },
    [dismissToast],
  );

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast Container */}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-3 sm:inset-x-auto sm:bottom-6 sm:right-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-atomic="true"
            className={`
              relative pointer-events-auto flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-2xl border border-outline-variant/20 px-5 py-3 shadow-2xl glass-panel
              animate-in fade-in slide-in-from-right-4 duration-300 motion-reduce:animate-none
            `}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center shrink-0
              ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : ''}
              ${toast.type === 'error' ? 'bg-error/10 text-error' : ''}
              ${toast.type === 'warning' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : ''}
              ${toast.type === 'info' ? 'bg-primary/10 text-primary' : ''}
            `}>
              <AppIcon
                name={
                  toast.type === 'success'
                    ? 'task_alt'
                    : toast.type === 'error'
                      ? 'warning'
                      : toast.type === 'warning'
                        ? 'warning'
                        : 'info'
                }
                className="h-[18px] w-[18px]"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-on-surface leading-tight">
                {toast.type === 'success' ? t('toast.success') : ''}
                {toast.type === 'error' ? t('toast.error') : ''}
                {toast.type === 'warning' ? t('toast.warning') : ''}
                {toast.type === 'info' ? t('toast.notice') : ''}
              </p>
              <p className="text-[11px] text-on-surface-variant font-medium mt-0.5 leading-snug">
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label={t('common.close')}
              className="ml-2 flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant/60 hover:bg-surface-container-high hover:text-on-surface transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <AppIcon name="close" className="h-4 w-4" />
            </button>

            {/* Auto-dismiss countdown bar */}
            <div
              aria-hidden="true"
              style={{ animationDuration: `${toast.durationMs}ms` }}
              className={`absolute bottom-0 left-0 h-0.5 animate-toast-progress opacity-80 ${
                toast.type === 'success' ? 'bg-emerald-500' : ''
              } ${toast.type === 'error' ? 'bg-error' : ''} ${
                toast.type === 'warning' ? 'bg-amber-500' : ''
              } ${toast.type === 'info' ? 'bg-primary' : ''}`}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
