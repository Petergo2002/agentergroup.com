'use client';

import { TriangleAlert } from 'lucide-react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { Modal } from '@/components/ui/Modal';

interface ConfirmSimpleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isProcessing?: boolean;
  variant?: 'error' | 'primary';
}

export function ConfirmSimpleModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isProcessing = false,
  variant = 'error',
}: ConfirmSimpleModalProps) {
  const { t } = useLanguage();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center text-center pt-2">
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${variant === 'error' ? 'bg-error/10' : 'bg-primary/10'} mb-4`}>
            <TriangleAlert className={`h-8 w-8 ${variant === 'error' ? 'text-error' : 'text-primary'}`} />
          </div>
          <h3 className="text-lg font-headline font-bold text-on-surface">{title}</h3>
          <p className="mt-2 text-[13px] font-medium leading-relaxed text-on-surface-variant/80 max-w-sm">
            {description}
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 rounded-xl border border-outline-variant/20 px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface transition-all duration-150 active:scale-[0.98] hover:bg-surface-container-low disabled:opacity-50"
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex-1 rounded-xl ${variant === 'error' ? 'bg-error text-white' : 'app-primary-surface'} px-4 py-3 text-xs font-bold uppercase tracking-widest shadow-lg ${variant === 'error' ? 'shadow-error/20' : ''} transition-all duration-150 active:scale-[0.98] disabled:opacity-50`}
          >
            {isProcessing ? t('common.processing') : confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
