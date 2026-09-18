'use client';

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
  Plus,
  Workflow,
} from 'lucide-react';
import { useAppContext } from '@/components/app/AppContext';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useToast } from '@/components/ui/ToastProvider';
import { AgentCreationError, createAgent } from '@/lib/agents/create-client';
import type { AgentSurface } from '@/lib/types';
import {
  hasAutomationsEnabled,
  hasInternalAssistantsEnabled,
} from '@/lib/assistants/feature-flags';

interface CreateAgentDropdownProps {
  buttonClassName?: string;
  buttonText?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  align?: 'left' | 'right';
  onCreated?: () => void;
}

export function CreateAgentDropdown({
  buttonClassName,
  buttonText,
  variant = 'primary',
  align = 'right',
  onCreated,
}: CreateAgentDropdownProps) {
  const router = useRouter();
  const { workspace } = useAppContext();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isMenuRendered, setIsMenuRendered] = useState(false);
  const [creatingSurface, setCreatingSurface] = useState<AgentSurface | null>(null);
  const [customName, setCustomName] = useState('');
  const [activeStep, setActiveStep] = useState<'menu' | 'nameInput'>('menu');
  const [selectedSurface, setSelectedSurface] = useState<AgentSurface>('widget');
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const dropdownId = useId();
  const nameInputId = useId();

  const internalAssistantsEnabled = hasInternalAssistantsEnabled(workspace);
  const automationsEnabled = hasAutomationsEnabled(workspace);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuWidth = Math.min(328, window.innerWidth - 32);

    const style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 9999,
      width: `${menuWidth}px`,
    };

    if (align === 'right') {
      style.right = `${Math.max(16, window.innerWidth - rect.right)}px`;
    } else {
      style.left = `${Math.max(16, rect.left)}px`;
    }

    if (spaceBelow < 320 && rect.top > 320) {
      style.bottom = `${window.innerHeight - rect.top + 8}px`;
      style.transformOrigin = align === 'right' ? 'bottom right' : 'bottom left';
    } else {
      style.top = `${rect.bottom + 8}px`;
      style.transformOrigin = align === 'right' ? 'top right' : 'top left';
    }

    setMenuStyle(style);
  }, [align]);

  const openDropdown = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    updatePosition();
    setIsMenuRendered(true);
    setIsOpen(true);
  }, [updatePosition]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setIsMenuRendered(false);
      setActiveStep('menu');
      setCustomName('');
      closeTimerRef.current = null;
    }, 180);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        closeDropdown();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    }

    function handleReposition() {
      if (isOpen) {
        updatePosition();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      window.addEventListener('resize', handleReposition);
      window.addEventListener('scroll', handleReposition, { capture: true });
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, { capture: true });
    };
  }, [closeDropdown, isOpen, updatePosition]);

  useEffect(() => {
    if (isOpen && activeStep === 'nameInput') {
      inputRef.current?.focus();
    }
  }, [activeStep, isOpen]);

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
      icon: <MessageSquare className="h-4 w-4" strokeWidth={2.1} />,
    },
    ...(automationsEnabled
      ? [
          {
            surface: 'automation' as AgentSurface,
            title: t('agents.createModal.automationTitle'),
            description: t('agents.createModal.automationDescription'),
            icon: <Workflow className="h-4 w-4" strokeWidth={2.1} />,
          },
        ]
      : []),
    ...(internalAssistantsEnabled
      ? [
          {
            surface: 'assistant' as AgentSurface,
            title: t('agents.createModal.assistantTitle'),
            description: t('agents.createModal.assistantDescription'),
            icon: <Bot className="h-4 w-4" strokeWidth={2.1} />,
          },
        ]
      : []),
  ];

  const handleSelectSurface = (surface: AgentSurface) => {
    setSelectedSurface(surface);
    setCustomName('');
    setActiveStep('nameInput');
  };

  const handleCreateAgent = async (surfaceToCreate: AgentSurface, nameToUse: string) => {
    if (creatingSurface) return;
    setCreatingSurface(surfaceToCreate);

    try {
      const finalName = nameToUse.trim() || 'New Agent';
      const agent = await createAgent({
        name: finalName,
        surface: surfaceToCreate,
      });

      showToast(t('agents.createModal.created'), 'success');
      closeDropdown();
      onCreated?.();
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
      setCreatingSurface(null);
    }
  };

  const defaultButtonText = buttonText || t('agents.createAgent');
  const selectedOption = surfaceOptions.find(
    (option) => option.surface === selectedSurface,
  );
  const nameLabel =
    selectedSurface === 'assistant'
      ? t('agents.createModal.assistantName')
      : selectedSurface === 'automation'
        ? t('agents.createModal.automationName')
        : t('agents.createModal.agentName');
  const namePlaceholder =
    selectedSurface === 'assistant'
      ? t('agents.createModal.assistantNamePlaceholder')
      : selectedSurface === 'automation'
        ? t('agents.createModal.automationNamePlaceholder')
        : t('agents.createModal.agentNamePlaceholder');
  const createLabel =
    selectedSurface === 'assistant'
      ? t('agents.createModal.createAssistant')
      : selectedSurface === 'automation'
        ? t('agents.createModal.createAutomation')
        : t('agents.createAgent');
  const triggerVariantClass =
    variant === 'secondary'
      ? 'app-secondary-button'
      : variant === 'ghost'
        ? 'min-h-10 rounded-xl px-3 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
        : 'app-primary-button';

  const menuContent = isMenuRendered ? (
    <div
      ref={menuRef}
      id={dropdownId}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${dropdownId}-title`}
      style={menuStyle}
      className={`relative overflow-hidden rounded-2xl border border-outline-variant/20 solid-panel shadow-2xl transition-all duration-200 ${
        isOpen ? 'agent-dropdown-enter' : 'agent-dropdown-exit'
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      {activeStep === 'menu' ? (
        <>
          <div className="border-b border-outline-variant/15 px-4 py-3">
            <h2
              id={`${dropdownId}-title`}
              className="text-[13px] font-bold tracking-tight text-on-surface"
            >
              {t('agents.createModal.selectTypeTitle')}
            </h2>
            <p className="mt-0.5 text-[11px] leading-4 text-on-surface-variant">
              {t('agents.createModal.selectTypeDescription')}
            </p>
          </div>

          <div className="space-y-1 p-2">
            {surfaceOptions.map((option) => (
              <button
                key={option.surface}
                type="button"
                disabled={creatingSurface !== null}
                onClick={() => handleSelectSurface(option.surface)}
                className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all duration-150 hover:border-outline-variant/20 hover:bg-surface-container-low active:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-outline-variant/15 bg-surface-container-low text-on-surface-variant transition-colors group-hover:border-primary/20 group-hover:bg-primary/10 group-hover:text-primary">
                  {option.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-on-surface">
                    {option.title}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-on-surface-variant">
                    {option.description}
                  </p>
                </div>
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-on-surface-variant/40 transition-colors group-hover:text-primary"
                  strokeWidth={2.1}
                />
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="border-b border-outline-variant/15 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => setActiveStep('menu')}
                aria-label={t('common.back')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-outline-variant/20 bg-surface-container-low text-on-surface-variant transition-colors hover:border-primary/25 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
              <div className="min-w-0">
                <h2
                  id={`${dropdownId}-title`}
                  className="text-[13px] font-bold tracking-tight text-on-surface"
                >
                  {t('agents.createModal.nameStepTitle')}
                </h2>
                <p className="mt-0.5 text-[11px] leading-4 text-on-surface-variant">
                  {t('agents.createModal.nameStepDescription')}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4">
            {selectedOption ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-primary/15 bg-primary/[0.06] px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  {selectedOption.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-on-surface-variant">
                    {t('agents.createModal.selectedType')}
                  </p>
                  <p className="text-xs font-bold text-on-surface">
                    {selectedOption.title}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label
                htmlFor={nameInputId}
                className="block text-xs font-semibold text-on-surface"
              >
                {nameLabel}
              </label>
              <input
                id={nameInputId}
                ref={inputRef}
                type="text"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && customName.trim()) {
                    event.preventDefault();
                    handleCreateAgent(selectedSurface, customName);
                  }
                }}
                placeholder={namePlaceholder}
                className="depth-input h-10 w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/45 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-outline-variant/15 bg-surface-container-low/45 px-4 py-3">
            <button
              type="button"
              onClick={closeDropdown}
              disabled={creatingSurface !== null}
              className="app-secondary-button min-h-9 px-3 text-xs"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={creatingSurface !== null || !customName.trim()}
              onClick={() => handleCreateAgent(selectedSurface, customName)}
              className="app-primary-button min-h-9 px-3 text-xs"
            >
              {creatingSurface ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{t('agents.createModal.creating')}</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                  <span>{createLabel}</span>
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="inline-flex text-left">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={dropdownId}
        onClick={() => {
          if (isOpen) {
            closeDropdown();
          } else {
            openDropdown();
          }
        }}
        className={`group inline-flex items-center justify-center gap-2 transition-all duration-150 ${triggerVariantClass} ${buttonClassName ?? ''}`}
      >
        {creatingSurface ? (
          <Loader2 className="h-4 w-4 animate-spin text-current" />
        ) : (
          <Plus className="h-4 w-4" strokeWidth={2.2} />
        )}
        <span>{defaultButtonText}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 opacity-65 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
          strokeWidth={2.2}
        />
      </button>

      {mounted && menuContent ? createPortal(menuContent, document.body) : null}
    </div>
  );
}
