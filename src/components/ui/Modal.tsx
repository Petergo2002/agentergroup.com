'use client';

import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { AppIcon } from '@/components/icons/AppIcon';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useDialogFocus } from '@/lib/hooks/useDialogFocus';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full';
}

export const Modal = ({ isOpen, onClose, title, description, children, size = 'lg' }: ModalProps) => {
  const { t } = useLanguage();
  const dialogRef = useDialogFocus({ isOpen, onClose });
  const titleId = useId();
  const descriptionId = useId();

  const sizeClasses = {
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    full: 'max-w-[calc(100vw-2rem)]',
  }[size];

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-outline-variant/20 glass-panel shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200 sm:max-h-[calc(100vh-2rem)] ${sizeClasses}`}
      >
        {/* Physical Top-Light Detail */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-xl sm:text-2xl font-headline font-bold text-on-surface tracking-tight">
              {title || t('modals.defaultTitle')}
            </h3>
            {description && (
              <p id={descriptionId} className="mt-1 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-flex h-6 items-center rounded-md border border-outline-variant/20 bg-surface-container-low px-2 text-[10px] font-mono font-medium text-on-surface-variant/60 shadow-xs">
              ESC
            </kbd>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-on-surface-variant/70 hover:bg-surface-container-high hover:text-on-surface transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <AppIcon name="close" className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 overflow-y-auto px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
