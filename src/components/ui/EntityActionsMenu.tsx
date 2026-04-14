'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppIcon } from '@/components/icons/AppIcon';
import { useLanguage } from '@/components/i18n/LanguageProvider';

interface EntityActionsMenuProps {
  onArchiveToggle?: () => void;
  archiveLabel?: string;
  archiveDisabled?: boolean;
  onEdit?: () => void;
  editLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
  deleteDisabled?: boolean;
  buttonClassName?: string;
}

export function EntityActionsMenu({
  onArchiveToggle,
  archiveLabel,
  archiveDisabled = false,
  onEdit,
  editLabel,
  onDelete,
  deleteLabel,
  deleteDisabled = false,
  buttonClassName = "flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant/65 transition-colors hover:bg-surface-container hover:text-on-surface",
}: EntityActionsMenuProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
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
      const target = event.target as Node;
      const clickedTrigger = containerRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);

      if (!clickedTrigger && !clickedMenu) {
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
        className={buttonClassName}
      >
        <AppIcon name="more_horiz" className="h-5 w-5" />
      </button>

      {isOpen
        ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[70] min-w-[188px] rounded-2xl bg-surface-container-low p-2 shadow-[0_18px_48px_rgba(0,0,0,0.35)] ring-1 ring-outline-variant/10"
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
              <AppIcon name="archive" className="h-[18px] w-[18px]" />
              {archiveLabel ?? t('common.archive')}
            </button>
          ) : null}
          {onEdit ? (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:text-on-surface-variant/40"
            >
              <AppIcon name="edit" className="h-[18px] w-[18px]" />
              {editLabel ?? t('common.edit')}
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
              <AppIcon name="delete_forever" className="h-[18px] w-[18px]" />
              {deleteLabel ?? t('common.delete')}
            </button>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
