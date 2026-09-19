'use client';

import { useCallback, useRef, useState } from 'react';
import { ConfirmSimpleModal } from '@/components/modals/ConfirmSimpleModal';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'error' | 'primary';
}

/**
 * A promise-based replacement for `window.confirm`.
 *
 * The native dialog blocks the main thread, cannot be styled or translated,
 * and — the part that actually bites — browsers let people tick "prevent this
 * page from creating more dialogs", after which every later confirm silently
 * returns false. A destructive action then appears to do nothing at all.
 *
 * Call sites read the same as the native call they replace:
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ title, description }))) return;
 *
 * ...with `{confirmDialog}` rendered somewhere in the tree.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((answer: boolean) => void) | null>(null);

  const settle = useCallback((answer: boolean) => {
    resolveRef.current?.(answer);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback(
    (next: ConfirmOptions) => {
      // A second prompt while one is open would otherwise strand the first
      // promise forever, leaving its caller suspended.
      resolveRef.current?.(false);
      setOptions(next);
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
      });
    },
    [],
  );

  const confirmDialog = options ? (
    <ConfirmSimpleModal
      isOpen
      onClose={() => settle(false)}
      onConfirm={() => settle(true)}
      title={options.title}
      description={options.description}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      variant={options.variant ?? 'error'}
    />
  ) : null;

  return { confirm, confirmDialog };
}
