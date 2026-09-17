'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AppIcon } from '@/components/icons/AppIcon';
import { useLanguage } from '@/components/i18n/LanguageProvider';

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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
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

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousBodyOverflow = document.body.style.overflow;
    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      "[contenteditable='true']",
      "[tabindex]:not([tabindex='-1'])",
    ].join(',');
    const getFocusableElements = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) =>
          !element.hidden &&
          element.getAttribute('aria-hidden') !== 'true' &&
          element.getAttribute('inert') === null,
      );

    const focusFrame = window.requestAnimationFrame(() => {
      const autoFocusElement = dialog.querySelector<HTMLElement>('[autofocus]');
      (autoFocusElement ?? getFocusableElements()[0] ?? dialog).focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

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
