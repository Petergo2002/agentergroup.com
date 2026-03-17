'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface EntityActionsMenuProps {
  onArchiveToggle?: () => void;
  archiveLabel?: string;
  archiveDisabled?: boolean;
  onDelete?: () => void;
  deleteLabel?: string;
  deleteDisabled?: boolean;
}

export function EntityActionsMenu({
  onArchiveToggle,
  archiveLabel = 'Archive',
  archiveDisabled = false,
  onDelete,
  deleteLabel = 'Delete',
  deleteDisabled = false,
}: EntityActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const updatePosition = () => {
    if (!buttonRef.current) {
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 188;
    const viewportPadding = 16;
    const left = Math.min(
      rect.right - menuWidth,
      window.innerWidth - menuWidth - viewportPadding,
    );

    setMenuPosition({
      top: rect.bottom + 8,
      left: Math.max(viewportPadding, left),
    });
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();

    const handleViewportChange = () => updatePosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          if (!isOpen) {
            updatePosition();
          }
          setIsOpen((current) => !current);
        }}
        className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant/65 transition-colors hover:bg-surface-container hover:text-on-surface"
      >
        <span className="material-symbols-outlined text-[20px]">more_horiz</span>
      </button>

      {isOpen
        ? createPortal(
        <div
          className="fixed z-[70] min-w-[188px] rounded-2xl bg-background p-2 shadow-[0_18px_48px_rgba(15,23,42,0.16)] ring-1 ring-black/5"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          {onArchiveToggle ? (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onArchiveToggle();
              }}
              disabled={archiveDisabled}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:text-on-surface-variant/40"
            >
              <span className="material-symbols-outlined text-[18px]">archive</span>
              {archiveLabel}
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onDelete();
              }}
              disabled={deleteDisabled}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-error transition-colors hover:bg-error/5 disabled:cursor-not-allowed disabled:text-on-surface-variant/40"
            >
              <span className="material-symbols-outlined text-[18px]">delete_forever</span>
              {deleteLabel}
            </button>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
