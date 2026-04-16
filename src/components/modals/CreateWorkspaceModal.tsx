'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useToast } from '@/components/ui/ToastProvider';
import { Modal } from '@/components/ui/Modal';
import { Building2 } from 'lucide-react';

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
    <Modal isOpen={isOpen} onClose={isCreating ? () => {} : onClose} title={t('nav.createWorkspace') || 'Create workspace'}>
      <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-8">
        <div className="flex flex-col items-center justify-center py-6">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-[2rem] bg-surface-container shadow-premium border border-outline-variant/10 mb-6">
            <Building2 className="h-10 w-10 text-primary" />
            <div className="absolute inset-0 bg-primary blur-2xl opacity-10 rounded-full" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-on-surface tracking-tight">
              {t('settings.workspaceDetails') || 'Workspace Details'}
            </p>
            <p className="mt-2 text-sm text-on-surface-variant leading-relaxed max-w-[280px] mx-auto">
              {t('settings.workspaceDescription') || 'Create a new workspace to collaborate with your team and manage agents.'}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-[0.25em] block">
              {t('settings.workspaceName') || 'Workspace Name'}
            </label>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
              placeholder={t('settings.companyPlaceholder') || "Acme Inc."}
              className="w-full bg-surface-container-low/40 border border-outline-variant/15 rounded-[1.5rem] px-7 py-5 text-[15px] text-on-surface transition-all outline-none focus:bg-surface focus:ring-4 focus:ring-primary/5 focus:border-primary/30 shadow-sm placeholder:text-on-surface-variant/60 disabled:opacity-50"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-[0.25em] block">
              {t('settings.workspaceDescription') || 'Description'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
              rows={3}
              placeholder={t('settings.descriptionPlaceholder') || "Briefly describe this workspace..."}
              className="w-full bg-surface-container-low/40 border border-outline-variant/15 rounded-[1.5rem] px-7 py-5 text-[15px] text-on-surface transition-all outline-none resize-none focus:bg-surface focus:ring-4 focus:ring-primary/5 focus:border-primary/30 shadow-sm placeholder:text-on-surface-variant/60 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex items-center gap-6 pt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-surface transition-all disabled:opacity-50"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isCreating}
            className="signature-gradient flex-1 rounded-full px-10 py-5 text-xs font-bold uppercase tracking-[0.25em] shadow-premium transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 active:scale-[0.98] disabled:opacity-40"
          >
            <span className="flex items-center justify-center gap-2">
              {isCreating ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
                  {t('common.saving') || 'Creating...'}
                </>
              ) : (
                t('nav.createWorkspace') || 'Create workspace'
              )}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}