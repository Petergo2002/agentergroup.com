'use client';

import { useLanguage } from '@/components/i18n/LanguageProvider';

interface StatusToggleProps {
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  activeLabel?: string;
  inactiveLabel?: string;
}

export function StatusToggle({
  checked,
  onClick,
  disabled = false,
  label,
  activeLabel,
  inactiveLabel,
}: StatusToggleProps) {
  const { t } = useLanguage();
  const resolvedActiveLabel = activeLabel ?? t('common.on');
  const resolvedInactiveLabel = inactiveLabel ?? t('common.off');

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex shrink-0 rounded-full p-1 transition-all ${
        checked
          ? 'bg-primary/10 text-primary'
          : 'bg-surface-container text-on-surface-variant'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span className="relative flex h-9 w-[92px] items-center rounded-full bg-background px-1.5">
        <span
          className={`absolute top-1.5 h-6 w-[42px] rounded-full shadow-[0_6px_18px_rgba(15,23,42,0.12)] transition-all ${
            checked
              ? 'left-[46px] bg-primary'
              : 'left-[6px] bg-surface-container-highest'
          }`}
        />
        <span className="relative z-10 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em]">
          <span
            className={`w-[42px] text-center transition-colors ${
              checked ? 'text-on-surface-variant/45' : 'text-on-surface'
            }`}
          >
            {resolvedInactiveLabel}
          </span>
          <span
            className={`w-[42px] text-center transition-colors ${
              checked ? 'text-white' : 'text-on-surface-variant/55'
            }`}
          >
            {resolvedActiveLabel}
          </span>
        </span>
      </span>
    </button>
  );
}
