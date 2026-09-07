'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import {
  getFlattenedModelOptions,
  type OpenRouterModelOption,
  type OpenRouterModelSection,
} from '@/lib/openrouter-models';

interface AgentModelPickerProps {
  value: string;
  sections: OpenRouterModelSection[];
  legacyOption?: OpenRouterModelOption | null;
  isLoading: boolean;
  source: 'openrouter' | 'fallback' | null;
  onChange: (value: string) => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLElement>) => void;
  milo?: boolean;
}

function getSectionCopy(
  key: OpenRouterModelSection['key'],
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  switch (key) {
    case 'recommended':
      return {
        title: t('agentBuilder.modelSectionRecommended'),
        description: t('agentBuilder.modelSectionRecommendedDescription'),
      };
    case 'frontier':
      return {
        title: t('agentBuilder.modelSectionFrontier'),
        description: t('agentBuilder.modelSectionFrontierDescription'),
      };
    case 'fast':
      return {
        title: t('agentBuilder.modelSectionFast'),
        description: t('agentBuilder.modelSectionFastDescription'),
      };
    case 'open':
      return {
        title: t('agentBuilder.modelSectionOpen'),
        description: t('agentBuilder.modelSectionOpenDescription'),
      };
    default:
      return {
        title: t('agentBuilder.cognitiveModel'),
        description: '',
      };
  }
}

export function AgentModelPicker({
  value,
  sections,
  legacyOption,
  isLoading,
  source,
  onChange,
  onKeyDown,
  milo = false,
}: AgentModelPickerProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => {
    return (
      getFlattenedModelOptions(sections).find((option) => option.id === value) ??
      legacyOption ??
      null
    );
  }, [legacyOption, sections, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="mb-2.5 ml-1 flex items-center justify-between gap-4">
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
          {milo ? t('agentBuilder.miloModel') : t('agentBuilder.cognitiveModel')}
        </label>
        <div className="flex items-center gap-2 rounded-full border border-outline-variant/10 bg-surface-container-low px-3 py-1">
          <span
            className={`h-1 w-1 rounded-full ${
              isLoading ? 'animate-pulse bg-primary/40' : 'bg-primary'
            }`}
          />
          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70">
            {isLoading ? '...' : source === 'openrouter' ? 'Live' : 'Cached'}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={onKeyDown}
        className={`group flex w-full items-center justify-between rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-lowest px-5 py-4 text-left shadow-sm outline-none transition-all ${
          isOpen
            ? 'border-primary/40 bg-surface-container-low ring-4 ring-primary/5'
            : 'hover:border-primary/40 focus:border-primary/40 focus:ring-4 focus:ring-primary/5'
        }`}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-on-surface">
              {selectedOption?.shortName || t('common.loading')}
            </span>
            <span className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/50">
              {selectedOption?.providerLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-on-surface-variant/50">
          <span className="material-symbols-outlined text-lg transition-transform duration-300 group-hover:text-primary">
            {isOpen ? 'expand_less' : 'unfold_more'}
          </span>
        </div>
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-full z-[100] mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex max-h-[360px] flex-col overflow-hidden rounded-[1.25rem] border border-outline-variant/10 bg-surface/95 shadow-xl backdrop-blur-3xl">
            <div className="scrollbar-hide flex-1 space-y-6 overflow-y-auto p-4">
              {legacyOption && value !== legacyOption.id ? (
                <div className="space-y-4">
                  <p className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                    {t('agentBuilder.modelSectionCurrent')}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelect(legacyOption.id)}
                    className="group w-full rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-lowest p-4 text-left transition-all hover:border-primary/30 hover:bg-surface-container-low"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-on-surface">
                          {legacyOption.shortName}
                        </h4>
                        <p className="mt-1 text-[10px] font-bold uppercase text-on-surface-variant/40">
                          {legacyOption.id}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              ) : null}

              {sections.map((section) => {
                const copy = getSectionCopy(section.key, t);

                return (
                  <section key={section.key} className="space-y-4">
                    <div className="ml-1 flex flex-col gap-0.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                        {copy.title}
                      </p>
                      <p className="text-[10px] font-bold tracking-wide text-on-surface-variant/20">
                        {copy.description}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {section.models.map((option) => {
                        const isSelected = option.id === value;

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleSelect(option.id)}
                            className={`group flex w-full flex-col gap-1.5 rounded-[1rem] border p-3.5 text-left transition-all duration-200 ${
                              isSelected
                                ? 'border-primary/40 bg-primary/5'
                                : 'border-outline-variant/10 bg-surface-container-lowest hover:border-primary/30 hover:bg-surface-container-low'
                            }`}
                          >
                            <div className="flex w-full items-center justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <h4
                                  className={`truncate text-sm font-bold ${
                                    isSelected ? 'text-primary' : 'text-on-surface'
                                  }`}
                                >
                                  {option.shortName}
                                </h4>
                                <p
                                  className={`mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.1em] ${
                                    isSelected
                                      ? 'text-primary/60'
                                      : 'text-on-surface-variant/40'
                                  }`}
                                >
                                  {option.providerLabel}
                                </p>
                              </div>
                              {isSelected ? (
                                <div className="app-selected-icon flex h-5 w-5 items-center justify-center rounded-full">
                                  <span className="material-symbols-outlined text-[14px] font-bold">
                                    check
                                  </span>
                                </div>
                              ) : null}
                            </div>
                            <p
                              className={`line-clamp-2 text-[11px] font-medium leading-relaxed ${
                                isSelected
                                  ? 'text-primary/70'
                                  : 'text-on-surface-variant/60'
                              }`}
                            >
                              {option.summary}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="flex h-10 shrink-0 items-center justify-center bg-gradient-to-t from-surface/80 to-transparent">
              <span className="animate-bounce text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/20">
                scroll
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
