'use client';


import { Bot, UserCircle2 } from 'lucide-react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useWidgetBuilder } from '../WidgetBuilderContext';
import { CreateAgentDropdown } from '@/components/agents/CreateAgentDropdown';

const fieldLabelClassName = 'text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1';
const sectionDescClassName = 'text-sm text-on-surface-variant/60 leading-relaxed max-w-2xl';
const inputFieldClassName = 'w-full rounded-[14px] border border-outline-variant/10 bg-background px-5 py-3.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/30';

export function AgentsTab() {
  const { t } = useLanguage();
  const { summary, attachedAgents, setAttachedAgents, addAgent, removeAgent, moveAgent } = useWidgetBuilder();

  if (!summary) return null;

  const unattachedAgents = summary.availableAgents.filter(
    (agent) => !attachedAgents.some((item) => item.agentId === agent.id),
  );

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Attached Specialists */}
      <section className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">{t('widgetBuilder.agents.activeSpecialists')}</h2>
          <p className={sectionDescClassName}>
            {t('widgetBuilder.agents.activeSpecialistsDescription')}
          </p>
        </div>

        <div className="space-y-4">
          {attachedAgents.map((item, index) => (
            <div 
              key={item.agentId} 
              className="group relative rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
            >
              <div className="flex flex-col gap-6 w-full">
                {/* Agent Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 w-full">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-[1.2rem] bg-surface-container-low flex items-center justify-center border border-outline-variant/10">
                      <Bot className="w-5 h-5 text-on-surface-variant/50" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold font-headline">{item.label}</h3>
                      <p className="text-xs text-on-surface-variant/50 uppercase tracking-[0.12em] font-bold">
                        {item.agent.name}
                      </p>
                      <p className="mt-1 text-[11px] text-on-surface-variant/45 uppercase tracking-[0.12em] font-bold">
                        {item.agent.model}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 auto-cols-auto rounded-full bg-surface-container-low border border-outline-variant/5 p-1">
                      <button 
                        onClick={() => moveAgent(index, -1)}
                        disabled={index === 0}
                        className="rounded-full px-2 py-1 text-xs text-on-surface-variant/40 transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-20 flex items-center justify-center"
                      >
                         ↑
                      </button>
                      <button 
                         onClick={() => moveAgent(index, 1)}
                         disabled={index === attachedAgents.length - 1}
                         className="rounded-full px-2 py-1 text-xs text-on-surface-variant/40 transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-20 flex items-center justify-center"
                      >
                         ↓
                      </button>
                    </div>
                    <button
                      onClick={() => removeAgent(item.agentId)}
                      className="rounded-full bg-error/5 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-error transition-all hover:bg-error/10 whitespace-nowrap"
                    >
                      {t('widgetBuilder.agents.detachAgent')}
                    </button>
                  </div>
                </div>

                {/* Form Zone */}
                <div className="grid gap-6 sm:grid-cols-2 rounded-[1.5rem] bg-surface-container/30 p-5 border border-outline-variant/5 w-full">
                  <label className="block space-y-2 sm:col-span-2">
                     <span className={fieldLabelClassName}>{t('widgetBuilder.agents.displayName')}</span>
                     <input
                       value={item.label}
                       onChange={(e) => {
                          const next = [...attachedAgents];
                          next[index].label = e.target.value;
                          setAttachedAgents(next);
                       }}
                       className={inputFieldClassName}
                       placeholder={t('widgetBuilder.agents.displayNamePlaceholder')}
                     />
                  </label>
                  <label className="block space-y-2">
                     <span className={fieldLabelClassName}>{t('widgetBuilder.agents.greetingPrompt')}</span>
                     <textarea
                       value={item.greeting}
                       onChange={(e) => {
                          const next = [...attachedAgents];
                          next[index].greeting = e.target.value;
                          setAttachedAgents(next);
                       }}
                       className={`${inputFieldClassName} h-28 resize-none`}
                     />
                  </label>
                  <label className="block space-y-2">
                     <span className={fieldLabelClassName}>{t('widgetBuilder.agents.descriptionSnippet')}</span>
                     <textarea
                       value={item.description}
                       onChange={(e) => {
                          const next = [...attachedAgents];
                          next[index].description = e.target.value;
                          setAttachedAgents(next);
                       }}
                       className={`${inputFieldClassName} h-28 resize-none`}
                       placeholder={t('widgetBuilder.agents.descriptionPlaceholder')}
                     />
                  </label>
                </div>
              </div>
            </div>
          ))}

          {attachedAgents.length === 0 && (
            <div className="rounded-[2.5rem] border border-dashed border-outline-variant/20 bg-surface-container-lowest p-16 text-center">
              <div className="mx-auto h-16 w-16 mb-6 rounded-full bg-surface-container-low flex items-center justify-center">
                 <UserCircle2 className="w-7 h-7 opacity-20 text-on-surface-variant" />
              </div>
              <h3 className="text-lg font-bold font-headline">{t('widgetBuilder.agents.noSpecialists')}</h3>
              <p className="mt-2 text-sm text-on-surface-variant/40 max-w-sm mx-auto">
                {t('widgetBuilder.agents.noSpecialistsDescription')}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Specialist Registry (Picker) */}
      <section className="space-y-6 pt-6 border-t border-outline-variant/10">
        <div className="space-y-1.5 text-center">
          <h2 className="text-lg font-bold font-headline tracking-tight">{t('widgetBuilder.agents.expandRoster')}</h2>
          <p className="text-sm text-on-surface-variant/60">{t('widgetBuilder.agents.expandRosterDescription')}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {unattachedAgents.map((agent) => (
            <button
               key={agent.id}
               onClick={() => addAgent(agent.id)}
               className="group flex flex-col items-start gap-4 rounded-[1.8rem] border border-outline-variant/10 bg-surface-container-low p-6 transition-all hover:bg-on-surface hover:text-background text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant/20 bg-background transition-colors group-hover:border-background/20 group-hover:bg-white/10">
                 <Bot className="w-4 h-4 text-on-surface-variant/50 group-hover:text-background/70" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="truncate text-sm font-bold uppercase tracking-[0.1em]">{agent.name}</h4>
                <p className="mt-1 line-clamp-2 text-xs opacity-60 font-medium">{agent.description || t('widgetBuilder.agents.standardSpecialist')}</p>
              </div>
              <div className="mt-4 flex w-full items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-40 group-hover:opacity-80">{t('widgetBuilder.agents.clickToAttach')}</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] bg-surface-container px-2 py-0.5 rounded group-hover:bg-white/20 whitespace-nowrap">
                  {agent.model.split('/').pop()}
                </span>
              </div>
            </button>
          ))}

          {unattachedAgents.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center opacity-40">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4">{t('widgetBuilder.agents.noRemainingSpecialists')}</p>
              <CreateAgentDropdown
                variant="ghost"
                buttonClassName="text-xs font-bold uppercase tracking-[0.12em] text-primary hover:underline hover:bg-transparent px-0 py-0 min-h-0 min-w-0"
                buttonText={`+ ${t('widgetBuilder.agents.createNewAgent')}`}
                align="left"
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
