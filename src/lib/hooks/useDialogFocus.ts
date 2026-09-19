'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(',');

interface DialogFocusOptions {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Everything a dialog owes a keyboard: focus moves in, Tab cycles inside it,
 * Escape closes it, the page behind stops scrolling, and focus returns to
 * whatever opened it.
 *
 * Shared rather than copied, because a dialog that misses any one of these is
 * a trap: focus walks out of the panel into the page underneath, where the
 * user is tabbing through controls they cannot see.
 */
export function useDialogFocus({ isOpen, onClose }: DialogFocusOptions) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;

    const getFocusableElements = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
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

  return dialogRef;
}
