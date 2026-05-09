'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AgentViewTabs } from '@/components/agents/AgentViewTabs';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useToast } from '@/components/ui/ToastProvider';
import { formatLocaleDateTime } from '@/lib/i18n';
import type {
  AgentAutomationRecord,
  AgentRecord,
  AutomationEventRecord,
  ConnectionRecord,
  RunRecord,
} from '@/lib/types';

interface AutomationActivityResponse {
  agent: AgentRecord;
  automation: AgentAutomationRecord | null;
  connections: ConnectionRecord[];
  runs: RunRecord[];
  events: AutomationEventRecord[];
  environment: {
    hasComposio: boolean;
    hasWebhookSecret: boolean;
  };
}

function summarizeRun(run: RunRecord) {
  if (run.error_message) {
    return run.error_message;
  }

  const content = run.output?.assistantContent;
  if (typeof content === 'string' && content.trim()) {
    return content.trim().slice(0, 220);
  }

  return 'No output summary yet.';
}

function statusClasses(status: string) {
  if (status === 'active' || status === 'processed' || status === 'succeeded') {
    return 'bg-success/10 text-success';
  }

  if (status === 'failed' || status === 'error') {
    return 'bg-error/10 text-error';
  }

  return 'bg-warning/10 text-warning';
}

export default function AgentActivityPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const agentId = params.id;
  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [automation, setAutomation] = useState<AgentAutomationRecord | null>(null);
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [events, setEvents] = useState<AutomationEventRecord[]>([]);
  const [environment, setEnvironment] =
    useState<AutomationActivityResponse['environment'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const selectedConnection = useMemo(
    () =>
      automation?.connection_id
        ? connections.find((connection) => connection.id === automation.connection_id) ?? null
        : null,
    [automation?.connection_id, connections],
  );

  const loadActivity = useCallback(async () => {
    const response = await fetch(`/api/agents/${agentId}/automation`, {
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        typeof payload.error === 'string' ? payload.error : 'Failed to load automation activity.',
      );
    }

    const data = payload as AutomationActivityResponse;

    if (data.agent.surface !== 'automation') {
      router.replace(`/agents/${agentId}/preview`);
      return;
    }

    setAgent(data.agent);
    setAutomation(data.automation);
    setConnections(data.connections ?? []);
    setRuns(data.runs ?? []);
    setEvents(data.events ?? []);
    setEnvironment(data.environment ?? null);
  }, [agentId, router]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        await loadActivity();
      } catch (error) {
        if (isMounted) {
          showToast(
            error instanceof Error ? error.message : 'Failed to load automation activity.',
            'error',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [loadActivity, showToast]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="shrink-0 flex h-20 items-center justify-between border-b border-outline-variant/10 bg-surface/70 px-8 backdrop-blur-xl">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant/15 bg-surface-container-low text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </Link>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/60">
                Automation
              </span>
              <span className="text-on-surface-variant/20 text-[10px]">/</span>
              <h1 className="font-headline text-xl font-bold tracking-tight text-on-surface">
                {agent?.name ?? 'Automation'}
              </h1>
            </div>

            <div className="h-4 w-[1px] bg-outline-variant/20" />

            <AgentViewTabs agentId={agentId} current="activity" surface="automation" />
          </div>
        </div>

        <button
          onClick={() => void loadActivity()}
          className="h-10 rounded-2xl border border-outline-variant/15 px-6 text-xs font-bold uppercase tracking-widest text-on-surface-variant transition-all hover:bg-surface-container active:scale-95"
        >
          Refresh
        </button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm font-bold text-on-surface-variant">
            Loading activity...
          </div>
        ) : (
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            <section className="grid gap-4 md:grid-cols-4">
              {[
                { label: 'Status', value: automation?.status ?? 'draft' },
                {
                  label: 'Trigger',
                  value: automation?.trigger_slug ? 'Gmail new message' : 'Not selected',
                },
                {
                  label: 'Account',
                  value:
                    selectedConnection?.account_label ??
                    selectedConnection?.external_id ??
                    'Not selected',
                },
                {
                  label: 'Webhook',
                  value: environment?.hasWebhookSecret ? 'Configured' : 'Missing',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-lowest p-5"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/45">
                    {item.label}
                  </p>
                  <p className="mt-3 truncate text-sm font-black text-on-surface">{item.value}</p>
                </div>
              ))}
            </section>

            {automation?.last_error ? (
              <section className="rounded-[1.5rem] border border-error/15 bg-error/5 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-error">
                  Last error
                </p>
                <p className="mt-3 text-sm font-bold leading-6 text-error">{automation.last_error}</p>
              </section>
            ) : null}

            <section className="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="min-w-0 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline text-lg font-bold text-on-surface">Runs</h2>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                    {runs.length} recent
                  </span>
                </div>

                {runs.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-outline-variant/20 bg-surface-container-lowest p-10 text-center text-sm font-bold text-on-surface-variant">
                    No automation runs yet.
                  </div>
                ) : (
                  runs.map((run) => (
                    <article
                      key={run.id}
                      className="rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-lowest p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] ${statusClasses(run.status)}`}>
                          {run.status}
                        </span>
                        <span className="text-[10px] font-bold text-on-surface-variant/55">
                          {formatLocaleDateTime(run.created_at, language)}
                        </span>
                      </div>
                      <p className="mt-4 text-sm font-medium leading-6 text-on-surface-variant">
                        {summarizeRun(run)}
                      </p>
                    </article>
                  ))
                )}
              </div>

              <div className="min-w-0 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline text-lg font-bold text-on-surface">Events</h2>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                    {events.length} recent
                  </span>
                </div>

                {events.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-outline-variant/20 bg-surface-container-lowest p-10 text-center text-sm font-bold text-on-surface-variant">
                    No trigger events received yet.
                  </div>
                ) : (
                  events.map((event) => (
                    <article
                      key={event.id}
                      className="rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-lowest p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-on-surface">
                            {event.trigger_slug}
                          </p>
                          <p className="mt-1 truncate text-[11px] font-medium text-on-surface-variant/55">
                            {event.external_event_id}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] ${statusClasses(event.status)}`}>
                          {event.status}
                        </span>
                      </div>
                      <p className="mt-4 text-[10px] font-bold text-on-surface-variant/55">
                        {formatLocaleDateTime(event.created_at, language)}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
