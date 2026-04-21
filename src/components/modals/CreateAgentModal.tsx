'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Layout, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useAppContext } from '@/components/app/AppContext';
import { useToast } from '@/components/ui/ToastProvider';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { buildAgentPayload, buildInitialDefinition } from '@/lib/agents/defaults';
import type { AgentSurface } from '@/lib/types';
import { hasInternalAssistantsEnabled } from '@/lib/assistants/feature-flags';

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSurface?: AgentSurface;
}

export const CreateAgentModal = ({
  isOpen,
  onClose,
  initialSurface = 'widget',
}: CreateAgentModalProps) => {
  const router = useRouter();
  const supabase = createClient();
  const { workspace, user, subscription } = useAppContext();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const internalAssistantsEnabled = hasInternalAssistantsEnabled(workspace);
  const [name, setName] = useState('');
  const [surface, setSurface] = useState<AgentSurface>(initialSurface);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSurface(
        initialSurface === 'assistant' && !internalAssistantsEnabled
          ? 'widget'
          : initialSurface,
      );
    }
  }, [initialSurface, internalAssistantsEnabled, isOpen]);

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast(t('agents.createModal.enterName'), 'info');
      return;
    }

    if (surface === 'assistant' && !internalAssistantsEnabled) {
      showToast(t('agentBuilder.internalAssistantsDisabled'), 'error');
      return;
    }

    setIsSaving(true);

    try {
      // Check agent limit
      const { count, error: countError } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id)
        .is('archived_at', null);

      if (countError) throw countError;

      if ((count ?? 0) >= (subscription?.agents_limit ?? 1)) {
        showToast(
          t('settings.billing.agentLimitReached') || 
          'You have reached your agent limit. Please upgrade your plan.', 
          'error'
        );
        return;
      }

      const agentPayload = buildAgentPayload('custom', name, surface);
      const definition = buildInitialDefinition('custom');

      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .insert({
          workspace_id: workspace.id,
          created_by: user.id,
          ...agentPayload,
        })
        .select()
        .single();

      if (agentError || !agent) {
        throw agentError ?? new Error(t('agents.createModal.createError'));
      }

      const { error: draftError } = await supabase.from('agent_drafts').insert({
        agent_id: agent.id,
        workspace_id: workspace.id,
        updated_by: user.id,
        definition,
      });

      if (draftError) {
        throw draftError;
      }

      showToast(t('agents.createModal.created'), 'success');
      onClose();
      setName('');
      setSurface('widget');
      router.push(`/agents/${agent.id}/builder`);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('agents.createModal.createError');
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('agents.createModal.title')}>
      <div className="space-y-10 py-4">
        {/* Surface Selection */}
        <div className="space-y-5">
          <label className="text-[10px] font-bold text-secondary uppercase tracking-[0.25em] block">
            {t('agents.createModal.surface')}
          </label>
          
          <div className="flex flex-col gap-3">
            {internalAssistantsEnabled && (
              <button
                type="button"
                onClick={() => setSurface('assistant')}
                className={`group relative flex items-center gap-5 p-5 rounded-[2rem] border transition-all duration-300 text-left ${
                  surface === 'assistant'
                    ? 'border-primary/30 bg-surface shadow-premium scale-[1.01]'
                    : 'border-outline-variant/10 bg-surface-container-low/40 hover:bg-surface-container-low/80'
                }`}
              >
                <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 ${
                  surface === 'assistant' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface-container-high text-on-surface-variant/40'
                }`}>
                  <Bot className="h-7 w-7" />
                  {surface === 'assistant' && (
                    <div className="absolute inset-0 bg-primary blur-xl opacity-20" />
                  )}
                </div>
                
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold text-on-surface tracking-tight">
                    {t('agents.createModal.assistantTitle')}
                  </p>
                  <p className="mt-0.5 text-xs text-on-surface-variant leading-relaxed truncate">
                    {t('agents.createModal.assistantDescription')}
                  </p>
                </div>

                <div className={`mr-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                  surface === 'assistant' ? 'border-primary bg-primary scale-110' : 'border-outline-variant/20 scale-100'
                }`}>
                  {surface === 'assistant' && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSurface('widget')}
              className={`group relative flex items-center gap-5 p-5 rounded-[2rem] border transition-all duration-300 text-left ${
                surface === 'widget'
                  ? 'border-primary/30 bg-surface shadow-premium scale-[1.01]'
                  : 'border-outline-variant/10 bg-surface-container-low/40 hover:bg-surface-container-low/80'
              }`}
            >
              <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 ${
                surface === 'widget' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface-container-high text-on-surface-variant/40'
              }`}>
                <Layout className="h-7 w-7" />
                {surface === 'widget' && (
                  <div className="absolute inset-0 bg-primary blur-xl opacity-20" />
                )}
              </div>
              
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold text-on-surface tracking-tight">
                  {t('agents.createModal.widgetTitle')}
                </p>
                <p className="mt-0.5 text-xs text-on-surface-variant leading-relaxed truncate">
                  {t('agents.createModal.widgetDescription')}
                </p>
              </div>

              <div className={`mr-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                surface === 'widget' ? 'border-primary bg-primary scale-110' : 'border-outline-variant/20 scale-100'
              }`}>
                {surface === 'widget' && <Check className="h-3.5 w-3.5 text-white" />}
              </div>
            </button>
          </div>
        </div>

        {/* Input Section */}
        <div className="space-y-5">
          <label className="text-[10px] font-bold text-secondary uppercase tracking-[0.25em] block">
            {surface === 'assistant'
              ? t('agents.createModal.assistantName')
              : t('agents.createModal.agentName')}
          </label>
          
          <div className="group relative">
            <input 
              type="text" 
              placeholder={
                surface === 'assistant'
                  ? t('agents.createModal.assistantNamePlaceholder')
                  : t('agents.createModal.agentNamePlaceholder')
              }
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full bg-surface-container-low/40 border border-outline-variant/15 rounded-[1.5rem] px-7 py-5 text-[15px] text-on-surface transition-all outline-none focus:bg-surface focus:ring-4 focus:ring-primary/5 focus:border-primary/30 shadow-sm placeholder:text-on-surface-variant/60"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-6 pt-6">
          <button 
            onClick={onClose}
            className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-surface transition-all"
          >
            {t('common.cancel')}
          </button>
          <button 
            onClick={handleCreate}
            disabled={isSaving}
            className="signature-gradient flex-1 rounded-full px-10 py-5 text-xs font-bold uppercase tracking-[0.25em] shadow-premium transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 active:scale-[0.98] disabled:opacity-40"
          >
            <span className="flex items-center justify-center gap-2">
              {isSaving ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
                  {t('agents.createModal.creating')}
                </>
              ) : (
                surface === 'assistant'
                  ? t('agents.createModal.createAssistant')
                  : t('agents.createAgent')
              )}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
