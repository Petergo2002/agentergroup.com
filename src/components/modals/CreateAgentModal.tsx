'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, MessageSquare, Workflow } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useAppContext } from '@/components/app/AppContext';
import { useToast } from '@/components/ui/ToastProvider';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { buildAgentPayload, buildInitialDefinition } from '@/lib/agents/defaults';
import type { AgentSurface } from '@/lib/types';
import { hasInternalAssistantsEnabled, hasAutomationsEnabled } from '@/lib/assistants/feature-flags';

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
  const automationsEnabled = hasAutomationsEnabled(workspace);
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

  const surfaceOptions: Array<{
    surface: AgentSurface;
    title: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      surface: 'widget',
      title: t('agents.createModal.widgetTitle'),
      description: t('agents.createModal.widgetDescription'),
      icon: <MessageSquare className="h-5 w-5" />,
    },
    ...(automationsEnabled
      ? [
          {
            surface: 'automation' as AgentSurface,
            title: t('agents.createModal.automationTitle'),
            description: t('agents.createModal.automationDescription'),
            icon: <Workflow className="h-5 w-5" />,
          },
        ]
      : []),
    ...(internalAssistantsEnabled
      ? [
          {
            surface: 'assistant' as AgentSurface,
            title: t('agents.createModal.assistantTitle'),
            description: t('agents.createModal.assistantDescription'),
            icon: <Bot className="h-5 w-5" />,
          },
        ]
      : []),
  ];

  const nameLabel =
    surface === 'assistant'
      ? t('agents.createModal.assistantName')
      : surface === 'automation'
        ? t('agents.createModal.automationName')
        : t('agents.createModal.agentName');
  const namePlaceholder =
    surface === 'assistant'
      ? t('agents.createModal.assistantNamePlaceholder')
      : surface === 'automation'
        ? t('agents.createModal.automationNamePlaceholder')
        : t('agents.createModal.agentNamePlaceholder');
  const createLabel =
    surface === 'assistant'
      ? t('agents.createModal.createAssistant')
      : surface === 'automation'
        ? t('agents.createModal.createAutomation')
        : t('agents.createAgent');

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast(t('agents.createModal.enterName'), 'info');
      return;
    }

    if (surface === 'assistant' && !internalAssistantsEnabled) {
      showToast(t('agentBuilder.internalAssistantsDisabled'), 'error');
      return;
    }

    if (surface === 'automation' && !automationsEnabled) {
      showToast('Automations are not enabled for this workspace.', 'error');
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
      const definition = buildInitialDefinition('custom', surface);

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
      const rawMessage =
        error instanceof Error
          ? error.message
          : error && typeof error === 'object' && 'message' in error
            ? String(error.message)
            : '';
      const message = rawMessage.includes('AGENT_LIMIT_REACHED')
        ? t('settings.billing.agentLimitReached') ||
          'You have reached your agent limit. Please upgrade your plan.'
        : rawMessage || t('agents.createModal.createError');
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('agents.createModal.title')}>
      <div className="space-y-10 py-4">
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-secondary uppercase tracking-[0.25em] block">
            {t('agents.createModal.trigger')}
          </label>
          <div className="grid gap-3">
            {surfaceOptions.map((option) => {
              const isSelected = surface === option.surface;

              return (
                <button
                  key={option.surface}
                  type="button"
                  onClick={() => setSurface(option.surface)}
                  className={`flex items-start gap-4 rounded-[1.5rem] border p-4 text-left transition-all ${
                    isSelected
                      ? 'border-primary/35 bg-primary/5 shadow-sm'
                      : 'border-outline-variant/10 bg-surface-container-low/40 hover:border-primary/25 hover:bg-surface-container-low'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      isSelected
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {option.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-on-surface">{option.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-on-surface-variant/65">
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Section */}
        <div className="space-y-5">
          <label className="text-[10px] font-bold text-secondary uppercase tracking-[0.25em] block">
            {nameLabel}
          </label>
          
          <div className="group relative">
            <input 
              type="text" 
              placeholder={namePlaceholder}
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
                createLabel
              )}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
