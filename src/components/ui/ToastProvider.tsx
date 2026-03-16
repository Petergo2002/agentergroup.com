'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

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
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl glass-panel border border-outline-variant/20
              animate-in fade-in slide-in-from-right-4 duration-300
            `}
          >
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center
              ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : ''}
              ${toast.type === 'error' ? 'bg-error/10 text-error' : ''}
              ${toast.type === 'info' ? 'bg-primary/10 text-primary' : ''}
            `}>
              <span className="material-symbols-outlined text-lg">
                {toast.type === 'success' ? 'task_alt' : ''}
                {toast.type === 'error' ? 'warning' : ''}
                {toast.type === 'info' ? 'info' : ''}
              </span>
            </div>
            <div>
              <p className="text-[13px] font-bold text-on-surface">
                {toast.type === 'success' ? 'Success' : ''}
                {toast.type === 'error' ? 'Error' : ''}
                {toast.type === 'info' ? 'Notice' : ''}
              </p>
              <p className="text-[11px] text-on-surface-variant font-medium">
                {toast.message}
              </p>
            </div>
            <button 
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="ml-2 text-on-surface-variant/40 hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
