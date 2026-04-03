'use client';

import { useLanguage } from '@/components/i18n/LanguageProvider';
import { Modal } from '@/components/ui/Modal';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  entityName: string;
  entityLabel: string;
  description: string;
  confirmationValue: string;
  onConfirmationChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  title,
  entityName,
  entityLabel,
  description,
  confirmationValue,
  onConfirmationChange,
  onClose,
  onConfirm,
  isDeleting = false,
}: ConfirmDeleteModalProps) {
  const { t } = useLanguage();
  const isMatch = confirmationValue === entityName;

  return (
    <Modal isOpen={isOpen} onClose={isDeleting ? () => {} : onClose} title={title}>
      <div className="space-y-5">
        <div className="rounded-2xl border border-error/15 bg-error/5 px-4 py-4">
          <p className="text-sm font-semibold text-on-surface">{t('modals.permanentAction')}</p>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            {t('modals.confirmNameLabel', { entityLabel })}
          </label>
          <p className="mb-3 text-sm text-on-surface-variant">
            {t('modals.typeToContinue', { name: entityName }).split(entityName)[0]}
            <span className="font-semibold text-on-surface">{entityName}</span>
            {t('modals.typeToContinue', { name: entityName }).split(entityName)[1] ?? ""}
          </p>
          <input
            autoFocus
            value={confirmationValue}
            onChange={(event) => onConfirmationChange(event.target.value)}
            placeholder={entityName}
            className="w-full rounded-2xl border border-outline-variant/20 bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-error/30"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 rounded-2xl border border-outline-variant/20 px-4 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={!isMatch || isDeleting}
            className="flex-1 rounded-2xl border border-error/20 bg-error px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? t('common.deleting') : `${t('common.delete')} ${entityLabel}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
