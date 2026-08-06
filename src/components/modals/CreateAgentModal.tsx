'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, MessageSquare, Workflow, Check, Sparkles, Plus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useAppContext } from '@/components/app/AppContext';
import { useToast } from '@/components/ui/ToastProvider';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { AgentCreationError, createAgent } from '@/lib/agents/create-client';
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
  const { workspace } = useAppContext();
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
      const agent = await createAgent({
        name: name.trim(),
        surface,
      });

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
      const isAgentLimitError =
        (error instanceof AgentCreationError && error.code === 'agent_limit_reached') ||
        rawMessage.includes('AGENT_LIMIT_REACHED');
      const message = isAgentLimitError
        ? t('settings.billing.agentLimitReached') ||
          'You have reached your agent limit. Please upgrade your plan.'
        : rawMessage || t('agents.createModal.createError');
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('agents.createModal.title')}
      description={t('agents.createModal.subtitle') !== 'agents.createModal.subtitle' ? t('agents.createModal.subtitle') : 'Select how your new agent will trigger and specify a name.'}
    >
      <div className="space-y-6 pt-1 pb-2">
        {/* Surface selection */}
        <div className="space-y-3">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant block">
            {t('agents.createModal.trigger')}
          </label>

          <div className="grid gap-2.5">
            {surfaceOptions.map((option) => {
              const isSelected = surface === option.surface;

              return (
                <button
                  key={option.surface}
                  type="button"
                  onClick={() => setSurface(option.surface)}
                  className={`group relative flex items-center gap-3.5 rounded-xl border p-3.5 text-left transition-all duration-200 outline-none ${
                    isSelected
                      ? 'border-primary/50 bg-primary/[0.04] ring-1 ring-primary/20 shadow-xs'
                      : 'border-outline-variant/20 bg-surface-container-lowest/60 hover:border-outline-variant/50 hover:bg-surface-container-low/80'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-high/60 text-on-surface-variant group-hover:text-on-surface group-hover:bg-surface-container-high'
                    }`}
                  >
                    {option.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-on-surface tracking-tight">{option.title}</p>
                      {isSelected && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-on-surface-variant/80 leading-relaxed">
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Section */}
        <div className="space-y-2 pt-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant block">
            {nameLabel}
          </label>
          
          <div className="relative flex items-center">
            <div className="absolute left-3.5 text-on-surface-variant/50 pointer-events-none">
              <Sparkles className="h-4 w-4" />
            </div>
            <input 
              type="text" 
              placeholder={namePlaceholder}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSaving && name.trim()) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              autoFocus
              className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl py-3 pl-10 pr-4 text-sm text-on-surface transition-all outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-xs placeholder:text-on-surface-variant/50"
            />
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/15">
          <button 
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl px-4 py-2.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button 
            type="button"
            onClick={handleCreate}
            disabled={isSaving || !name.trim()}
            className="signature-gradient flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-xs transition-all duration-150 hover:shadow-md active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
          >
            {isSaving ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>{t('agents.createModal.creating')}</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>{createLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
