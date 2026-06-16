'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useToast } from '@/components/ui/ToastProvider';
import { Modal } from '@/components/ui/Modal';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateWorkspaceModal({ isOpen, onClose }: CreateWorkspaceModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);

    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || t('settings.saveError') || 'Failed to create workspace');
      }

      showToast(t('settings.workspaceSaved') || 'Workspace created successfully', 'success');
      
      // Force a hard reload to ensure all app contexts are completely fresh
      window.location.href = '/dashboard';
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.saveError') || 'An error occurred';
      showToast(message, 'error');
      setIsCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={isCreating ? () => {} : onClose} title={t('nav.createWorkspace') !== 'nav.createWorkspace' ? t('nav.createWorkspace') : 'Create workspace'}>
      <form onSubmit={handleSubmit} className="px-5 pb-5 pt-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-on-surface">
              {t('settings.workspaceName') !== 'settings.workspaceName' ? t('settings.workspaceName') : 'Workspace Name'}
            </label>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface transition-all outline-none focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/10 placeholder:text-on-surface-variant/50 disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-on-surface">
              {t('settings.workspaceDescription') !== 'settings.workspaceDescription' ? t('settings.workspaceDescription') : 'Description'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
              rows={3}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface transition-all outline-none resize-none focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/10 placeholder:text-on-surface-variant/50 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-6 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all disabled:opacity-50"
          >
            {t('common.cancel') !== 'common.cancel' ? t('common.cancel') : 'Cancel'}
          </button>
          <button
            type="submit"
            className="signature-gradient rounded-lg px-5 py-2 text-[13px] font-semibold text-white shadow-sm transition-all duration-150 hover:shadow-md hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            <span className="flex items-center justify-center gap-2">
              {isCreating ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
                  {t('common.saving') !== 'common.saving' ? t('common.saving') : 'Creating...'}
                </>
              ) : (
                t('nav.createWorkspace') !== 'nav.createWorkspace' ? t('nav.createWorkspace') : 'Create workspace'
              )}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}