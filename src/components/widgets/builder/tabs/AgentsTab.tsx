'use client';

import { Bot, ChevronDown, ChevronUp, Plus, Trash2, UserCircle2, X } from 'lucide-react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useWidgetBuilder } from '../WidgetBuilderContext';
import { CreateAgentDropdown } from '@/components/agents/CreateAgentDropdown';
import { MiloLogo } from '@/components/brand/MiloLogo';

const fieldLabelClassName = 'text-xs font-bold text-on-surface';
const inputFieldClassName =
  'w-full rounded-xl border border-outline-variant/20 bg-background px-3.5 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-on-surface-variant/35';

export function AgentsTab() {
  const { t } = useLanguage();
  const {
    summary,
    attachedAgents,
    setAttachedAgents,
    addAgent,
    removeAgent,
    moveAgent,
    isPrimaryMiloWidget,
  } = useWidgetBuilder();

  if (!summary) return null;

  const unattachedAgents = summary.availableAgents.filter(
    (agent) => !attachedAgents.some((item) => item.agentId === agent.id),
  );

  const updateAttachedAgent = (
    index: number,
    update: (item: (typeof attachedAgents)[number]) => (typeof attachedAgents)[number],
  ) => {
    setAttachedAgents((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? update(item) : item)),
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Attached Specialists Section */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-bold font-headline tracking-tight text-on-surface">
            {isPrimaryMiloWidget
              ? t('widgetBuilder.agents.miloChatTitle')
              : t('widgetBuilder.agents.activeSpecialists')}
          </h2>
          <p className="text-xs text-on-surface-variant/70">
            {isPrimaryMiloWidget
              ? t('widgetBuilder.agents.miloChatDescription')
              : t('widgetBuilder.agents.activeSpecialistsDescription')}
          </p>
        </div>

        <div className="space-y-4">
          {attachedAgents.map((item, index) => (
            <div
              key={item.agentId}
              className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-xs space-y-5 transition-all hover:border-outline-variant/30"
            >
              {/* Specialist Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-outline-variant/15 bg-surface-container-low">
                    {isPrimaryMiloWidget ? (
                      <MiloLogo size={32} className="h-8 w-8" />
                    ) : (
                      <Bot className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-headline text-on-surface">{item.label}</h3>
                    {isPrimaryMiloWidget ? (
                      <p className="text-[11px] font-semibold text-primary">
                        {t('widgetBuilder.agents.miloProfile')}
                      </p>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-on-surface-variant/60 font-medium">
                          {item.agent.name}
                        </span>
                        <span className="rounded bg-surface-container-low px-1.5 py-0.5 text-[9px] font-mono font-bold text-on-surface-variant/70">
                          {item.agent.model.split('/').pop()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {!isPrimaryMiloWidget && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-outline-variant/15 bg-surface-container-low p-0.5">
                      <button
                        type="button"
                        onClick={() => moveAgent(index, -1)}
                        disabled={index === 0}
                        aria-label="Move up"
                        className="rounded p-1 text-on-surface-variant/60 transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-20"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveAgent(index, 1)}
                        disabled={index === attachedAgents.length - 1}
                        aria-label="Move down"
                        className="rounded p-1 text-on-surface-variant/60 transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-20"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeAgent(item.agentId)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-error/20 bg-error/5 px-2.5 py-1 text-xs font-semibold text-error transition-colors hover:bg-error/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t('widgetBuilder.agents.detachAgent')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Form Zone */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block space-y-1.5">
                    <span className={fieldLabelClassName}>{t('widgetBuilder.agents.displayName')}</span>
                    <input
                      value={item.label}
                      onChange={(e) => {
                        const next = [...attachedAgents];
                        next[index].label = e.target.value;
                        setAttachedAgents(next);
                      }}
                      className={inputFieldClassName}
                      placeholder={t(
                        isPrimaryMiloWidget
                          ? 'widgetBuilder.agents.miloDisplayNamePlaceholder'
                          : 'widgetBuilder.agents.displayNamePlaceholder',
                      )}
                    />
                  </label>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block space-y-1.5">
                    <span className={fieldLabelClassName}>
                      {t(isPrimaryMiloWidget ? 'widgetBuilder.agents.greeting' : 'widgetBuilder.agents.greetingPrompt')}
                    </span>
                    <textarea
                      value={item.greeting}
                      onChange={(e) => {
                        const next = [...attachedAgents];
                        next[index].greeting = e.target.value;
                        setAttachedAgents(next);
                      }}
                      className={`${inputFieldClassName} h-24 resize-none`}
                      rows={3}
                    />
                  </label>
                  <p className="text-[11px] text-on-surface-variant/60">
                    The initial message the agent sends when a visitor opens the chat.
                  </p>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block space-y-1.5">
                    <span className={fieldLabelClassName}>
                      {t(
                        isPrimaryMiloWidget
                          ? 'widgetBuilder.agents.shortDescription'
                          : 'widgetBuilder.agents.descriptionSnippet',
                      )}
                    </span>
                    <textarea
                      value={item.description}
                      onChange={(e) => {
                        const next = [...attachedAgents];
                        next[index].description = e.target.value;
                        setAttachedAgents(next);
                      }}
                      className={`${inputFieldClassName} h-20 resize-none`}
                      placeholder={t(
                        isPrimaryMiloWidget
                          ? 'widgetBuilder.agents.miloDescriptionPlaceholder'
                          : 'widgetBuilder.agents.descriptionPlaceholder',
                      )}
                      rows={2}
                    />
                  </label>
                </div>

                {isPrimaryMiloWidget && (
                  <>
                    <div className="space-y-1.5">
                      <label className="block space-y-1.5">
                        <span className={fieldLabelClassName}>{t('widgetBuilder.agents.messagePlaceholder')}</span>
                        <input
                          value={item.placeholder}
                          onChange={(event) =>
                            updateAttachedAgent(index, (current) => ({
                              ...current,
                              placeholder: event.target.value,
                            }))
                          }
                          className={inputFieldClassName}
                          placeholder={t('widgetBuilder.agents.defaultPlaceholder')}
                        />
                      </label>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block space-y-1.5">
                        <span className={fieldLabelClassName}>{t('widgetBuilder.agents.interaction')}</span>
                        <select
                          value={item.interactionMode}
                          onChange={(event) =>
                            updateAttachedAgent(index, (current) => ({
                              ...current,
                              interactionMode:
                                event.target.value === 'contact_form' ? 'contact_form' : 'chat',
                            }))
                          }
                          className={inputFieldClassName}
                        >
                          <option value="chat">{t('widgetBuilder.agents.realtimeChat')}</option>
                          <option value="contact_form">{t('widgetBuilder.agents.contactForm')}</option>
                        </select>
                      </label>
                    </div>

                    {/* Quick Actions */}
                    <div className="space-y-3 sm:col-span-2 rounded-xl border border-outline-variant/15 bg-surface-container-low/50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-on-surface">{t('widgetBuilder.agents.quickActions')}</p>
                          <p className="text-[11px] text-on-surface-variant/60">
                            {t('widgetBuilder.agents.quickActionsDescription')}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={item.showQuickActions}
                          onChange={(event) =>
                            updateAttachedAgent(index, (current) => ({
                              ...current,
                              showQuickActions: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                        />
                      </div>

                      {item.showQuickActions && (
                        <div className="space-y-2 pt-2 border-t border-outline-variant/10">
                          {item.quickActions.map((action, actionIndex) => (
                            <div key={actionIndex} className="flex items-center gap-2">
                              <input
                                value={action.label || action.prompt}
                                onChange={(event) =>
                                  updateAttachedAgent(index, (current) => ({
                                    ...current,
                                    quickActions: current.quickActions.map((entry, entryIndex) =>
                                      entryIndex === actionIndex
                                        ? { ...entry, label: event.target.value, prompt: event.target.value }
                                        : entry,
                                    ),
                                  }))
                                }
                                className={inputFieldClassName}
                                placeholder={t('widgetBuilder.agents.quickActionLabel')}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateAttachedAgent(index, (current) => ({
                                    ...current,
                                    quickActions: current.quickActions.filter(
                                      (_, entryIndex) => entryIndex !== actionIndex,
                                    ),
                                  }))
                                }
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant/15 text-on-surface-variant/60 transition-colors hover:bg-error/10 hover:text-error"
                                aria-label={t('widgetBuilder.agents.removeQuickAction')}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}

                          {item.quickActions.length < 3 && (
                            <button
                              type="button"
                              onClick={() =>
                                updateAttachedAgent(index, (current) => ({
                                  ...current,
                                  quickActions: [...current.quickActions, { label: '', prompt: '', icon: null }],
                                }))
                              }
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline pt-1"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>{t('widgetBuilder.agents.addQuickAction')}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Contact Form Settings */}
                    {item.interactionMode === 'contact_form' && (
                      <div className="grid gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-low/50 p-4 sm:col-span-2 sm:grid-cols-2">
                        <label className="block space-y-1.5 sm:col-span-2">
                          <span className={fieldLabelClassName}>{t('widgetBuilder.agents.contactIntro')}</span>
                          <input
                            value={item.contactFormSettings.introText}
                            onChange={(event) =>
                              updateAttachedAgent(index, (current) => ({
                                ...current,
                                contactFormSettings: {
                                  ...current.contactFormSettings,
                                  introText: event.target.value,
                                },
                              }))
                            }
                            className={inputFieldClassName}
                          />
                        </label>
                        <label className="block space-y-1.5">
                          <span className={fieldLabelClassName}>{t('widgetBuilder.agents.contactSubmit')}</span>
                          <input
                            value={item.contactFormSettings.submitButtonText}
                            onChange={(event) =>
                              updateAttachedAgent(index, (current) => ({
                                ...current,
                                contactFormSettings: {
                                  ...current.contactFormSettings,
                                  submitButtonText: event.target.value,
                                },
                              }))
                            }
                            className={inputFieldClassName}
                          />
                        </label>
                        <label className="block space-y-1.5">
                          <span className={fieldLabelClassName}>{t('widgetBuilder.agents.contactSuccess')}</span>
                          <input
                            value={item.contactFormSettings.successMessage}
                            onChange={(event) =>
                              updateAttachedAgent(index, (current) => ({
                                ...current,
                                contactFormSettings: {
                                  ...current.contactFormSettings,
                                  successMessage: event.target.value,
                                },
                              }))
                            }
                            className={inputFieldClassName}
                          />
                        </label>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {attachedAgents.length === 0 && (
            <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container-lowest p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-low">
                <UserCircle2 className="h-6 w-6 text-on-surface-variant/40" />
              </div>
              <h3 className="mt-3 text-sm font-bold font-headline text-on-surface">
                {t('widgetBuilder.agents.noSpecialists')}
              </h3>
              <p className="mt-1 text-xs text-on-surface-variant/60 max-w-sm mx-auto">
                {t('widgetBuilder.agents.noSpecialistsDescription')}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Specialist Registry for Custom Widgets */}
      {!isPrimaryMiloWidget && (
        <section className="space-y-3 border-t border-outline-variant/10 pt-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold font-headline tracking-tight text-on-surface">
              {t('widgetBuilder.agents.expandRoster')}
            </h2>
            <p className="text-xs text-on-surface-variant/70">
              {t('widgetBuilder.agents.expandRosterDescription')}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unattachedAgents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => addAgent(agent.id)}
                className="group flex flex-col items-start gap-3 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-left transition-all hover:border-primary/40 hover:bg-surface-container-low"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/15 bg-surface-container-low transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="truncate text-xs font-bold text-on-surface">{agent.name}</h4>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-on-surface-variant/60">
                    {agent.description || t('widgetBuilder.agents.standardSpecialist')}
                  </p>
                </div>
                <div className="mt-2 flex w-full items-center justify-between">
                  <span className="text-[10px] font-bold text-primary">
                    + {t('widgetBuilder.agents.clickToAttach')}
                  </span>
                  <span className="rounded bg-surface-container-low px-1.5 py-0.5 text-[9px] font-mono font-bold text-on-surface-variant/70">
                    {agent.model.split('/').pop()}
                  </span>
                </div>
              </button>
            ))}

            {unattachedAgents.length === 0 && (
              <div className="col-span-full py-8 text-center">
                <p className="text-xs font-bold text-on-surface-variant/50">
                  {t('widgetBuilder.agents.noRemainingSpecialists')}
                </p>
                <div className="mt-2">
                  <CreateAgentDropdown
                    variant="ghost"
                    buttonClassName="text-xs font-bold text-primary hover:underline px-0 py-0 min-h-0 min-w-0"
                    buttonText={`+ ${t('widgetBuilder.agents.createNewAgent')}`}
                    align="left"
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
