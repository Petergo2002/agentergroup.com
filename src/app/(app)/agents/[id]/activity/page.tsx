'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AgentViewTabs } from '@/components/agents/AgentViewTabs';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useToast } from '@/components/ui/ToastProvider';
import {
  buildAutomationRunResult,
  readAutomationRunResult,
} from '@/lib/automation/result';
import { formatLocaleDateTime } from '@/lib/i18n';
import type {
  AgentAutomationRecord,
  AgentRecord,
  AutomationDecision,
  AutomationEventRecord,
  AutomationRunResult,
  BuilderDefinition,
  ComposioTriggerHealth,
  ConnectionRecord,
  RunRecord,
  RunStepRecord,
} from '@/lib/types';

interface AutomationActivityResponse {
  agent: AgentRecord;
  definition: BuilderDefinition | null;
  automation: AgentAutomationRecord | null;
  connections: ConnectionRecord[];
  runs: RunRecord[];
  steps: RunStepRecord[];
  events: AutomationEventRecord[];
  providerTriggerHealth: ComposioTriggerHealth | null;
  providerTriggerHealthError: string | null;
  environment: {
    hasComposio: boolean;
    hasWebhookSecret: boolean;
    configuredAppUrl: string;
    appUrlMatchesRequestOrigin: boolean;
    expectedWebhookUrl: string;
  };
}

interface EventContext {
  sender: string | null;
  subject: string | null;
  threadId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function findValueByKeys(
  value: unknown,
  keys: Set<string>,
  depth = 0,
): unknown {
  if (!isRecord(value) || depth > 4) return null;

  for (const [key, nestedValue] of Object.entries(value)) {
    if (keys.has(key)) return nestedValue;
  }

  for (const nestedValue of Object.values(value)) {
    if (isRecord(nestedValue)) {
      const match = findValueByKeys(nestedValue, keys, depth + 1);
      if (match !== null) return match;
    }
  }

  return null;
}

function formatSender(value: unknown) {
  const direct = readString(value);
  if (direct) return direct.slice(0, 160);
  if (!isRecord(value)) return null;

  const name = readString(value.name) ?? readString(value.display_name);
  const email = readString(value.email) ?? readString(value.address);
  if (name && email) return `${name} <${email}>`.slice(0, 160);
  return (email ?? name)?.slice(0, 160) ?? null;
}

function getEventContext(event: AutomationEventRecord): EventContext {
  const payload = isRecord(event.payload.payload) ? event.payload.payload : event.payload;
  const senderValue = findValueByKeys(
    payload,
    new Set(['sender', 'from', 'sender_email', 'senderEmail', 'from_email', 'fromEmail']),
  );
  const subjectValue = findValueByKeys(payload, new Set(['subject', 'email_subject']));
  const threadValue = findValueByKeys(payload, new Set(['thread_id', 'threadId']));

  return {
    sender: formatSender(senderValue),
    subject: readString(subjectValue)?.slice(0, 180) ?? null,
    threadId: readString(threadValue)?.slice(0, 120) ?? null,
  };
}

function getRunResult(run: RunRecord): AutomationRunResult {
  const storedResult = readAutomationRunResult(run.output?.automationResult);
  if (storedResult) return storedResult;

  const toolMessages = Array.isArray(run.output?.toolMessages)
    ? run.output.toolMessages.filter(isRecord)
    : [];
  const assistantContent = readString(run.output?.assistantContent) ?? run.error_message ?? '';

  return buildAutomationRunResult({
    assistantContent,
    toolMessages,
    runtimeHadError: run.status === 'failed' || Boolean(run.error_message),
    runtimeErrorSummary: run.error_message,
  });
}

function statusClasses(status: string) {
  if (['active', 'processed', 'succeeded', 'action_taken'].includes(status)) {
    return 'bg-success/10 text-success';
  }

  if (['failed', 'error', 'action_failed'].includes(status)) {
    return 'bg-error/10 text-error';
  }

  if (status === 'no_action') {
    return 'bg-surface-container-high text-on-surface-variant';
  }

  return 'bg-warning/10 text-warning';
}

function decisionLabel(decision: AutomationDecision) {
  switch (decision) {
    case 'action_taken':
      return 'Action taken';
    case 'no_action':
      return 'No action needed';
    case 'needs_input':
      return 'Missing information';
    case 'action_failed':
      return 'Action failed';
  }
}

function decisionIcon(decision: AutomationDecision) {
  switch (decision) {
    case 'action_taken':
      return 'check_circle';
    case 'no_action':
      return 'do_not_disturb_on';
    case 'needs_input':
      return 'help';
    case 'action_failed':
      return 'error';
  }
}

function TimelineStep({
  icon,
  label,
  children,
  last = false,
}: {
  icon: string;
  label: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
      {!last ? (
        <span className="absolute bottom-[-1.25rem] left-[1.08rem] top-9 w-px bg-outline-variant/15" />
      ) : null}
      <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container-low text-on-surface-variant">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
      <div className="min-w-0 pt-1">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/45">
          {label}
        </p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

export default function AgentActivityPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const agentId = params.id;
  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [definition, setDefinition] = useState<BuilderDefinition | null>(null);
  const [automation, setAutomation] = useState<AgentAutomationRecord | null>(null);
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [steps, setSteps] = useState<RunStepRecord[]>([]);
  const [events, setEvents] = useState<AutomationEventRecord[]>([]);
  const [providerTriggerHealth, setProviderTriggerHealth] =
    useState<ComposioTriggerHealth | null>(null);
  const [providerTriggerHealthError, setProviderTriggerHealthError] =
    useState<string | null>(null);
  const [environment, setEnvironment] =
    useState<AutomationActivityResponse['environment'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const selectedConnection = useMemo(
    () =>
      automation?.connection_id
        ? connections.find((connection) => connection.id === automation.connection_id) ?? null
        : null,
    [automation?.connection_id, connections],
  );

  const enabledGmailTools = useMemo(() => {
    const gmailNode = definition?.nodes?.find((node) => {
      if (!isRecord(node) || !isRecord(node.data)) return false;
      return node.data.kind === 'gmail';
    });
    const enabledTools = isRecord(gmailNode) && isRecord(gmailNode.data)
      ? gmailNode.data.enabledTools
      : null;

    return Array.isArray(enabledTools)
      ? enabledTools.filter((value): value is string => typeof value === 'string')
      : [];
  }, [definition]);

  const gmailReplyEnabled = enabledGmailTools.includes('GMAIL_REPLY_TO_THREAD');
  const runsById = useMemo(() => new Map(runs.map((run) => [run.id, run])), [runs]);
  const runStepsByRunId = useMemo(() => {
    const grouped = new Map<string, RunStepRecord[]>();
    for (const step of steps) {
      grouped.set(step.run_id, [...(grouped.get(step.run_id) ?? []), step]);
    }
    return grouped;
  }, [steps]);

  const webhookReady = Boolean(
    environment?.hasComposio &&
      environment.hasWebhookSecret &&
      environment.appUrlMatchesRequestOrigin,
  );
  const providerPollingStale = Boolean(
    automation?.status === 'active' &&
      providerTriggerHealth?.lastSyncedAt &&
      Date.now() - new Date(providerTriggerHealth.lastSyncedAt).getTime() > 45 * 60 * 1_000,
  );
  const providerTriggerReady = Boolean(
    automation?.status !== 'active' ||
      (providerTriggerHealth?.found && providerTriggerHealth.active && !providerPollingStale),
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
    setDefinition(data.definition ?? null);
    setAutomation(data.automation);
    setConnections(data.connections ?? []);
    setRuns(data.runs ?? []);
    setSteps(data.steps ?? []);
    setEvents(data.events ?? []);
    setProviderTriggerHealth(data.providerTriggerHealth ?? null);
    setProviderTriggerHealthError(data.providerTriggerHealthError ?? null);
    setEnvironment(data.environment ?? null);
  }, [agentId, router]);

  const refreshActivity = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadActivity();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to refresh automation activity.',
        'error',
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [loadActivity, showToast]);

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
        if (isMounted) setIsLoading(false);
      }
    };

    void run();
    return () => {
      isMounted = false;
    };
  }, [loadActivity, showToast]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-outline-variant/10 bg-surface/70 px-4 backdrop-blur-xl sm:px-8">
        <div className="flex min-w-0 items-center gap-4 sm:gap-8">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-outline-variant/15 bg-surface-container-low text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </Link>

          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <div className="hidden items-center gap-3 md:flex">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/60">
                Automation
              </span>
              <span className="text-[10px] text-on-surface-variant/20">/</span>
              <h1 className="max-w-64 truncate font-headline text-xl font-bold tracking-tight text-on-surface">
                {agent?.name ?? 'Automation'}
              </h1>
            </div>
            <div className="hidden h-4 w-px bg-outline-variant/20 md:block" />
            <AgentViewTabs agentId={agentId} current="activity" surface="automation" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refreshActivity()}
          disabled={isRefreshing}
          className="flex h-10 items-center gap-2 rounded-2xl border border-outline-variant/15 px-4 text-xs font-bold text-on-surface-variant transition-all hover:bg-surface-container active:scale-95 disabled:cursor-wait disabled:opacity-60 sm:px-5"
        >
          <span className={`material-symbols-outlined text-[17px] ${isRefreshing ? 'animate-spin' : ''}`}>
            refresh
          </span>
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        {isLoading ? (
          <div className="mx-auto max-w-6xl animate-pulse space-y-5">
            <div className="h-24 rounded-[1.5rem] bg-surface-container-low" />
            <div className="h-80 rounded-[1.5rem] bg-surface-container-low" />
          </div>
        ) : (
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <section className="rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] ${statusClasses(automation?.status ?? 'draft')}`}>
                      {automation?.status ?? 'draft'}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] ${webhookReady ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                      Webhook {webhookReady ? 'ready' : 'not ready'}
                    </span>
                    {automation?.status === 'active' ? (
                      <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] ${providerTriggerReady ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                        Gmail polling {providerTriggerReady ? 'healthy' : 'needs attention'}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-lg font-bold text-on-surface">Gmail new message automation</h2>
                  <p className="mt-1 text-sm font-medium text-on-surface-variant/65">
                    {selectedConnection?.account_label ?? selectedConnection?.external_id ?? 'No Gmail account selected'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.17em] text-on-surface-variant/40">Events</p>
                    <p className="mt-1 font-bold text-on-surface">{events.length} recent</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.17em] text-on-surface-variant/40">Last event</p>
                    <p className="mt-1 whitespace-nowrap font-bold text-on-surface">
                      {events[0]?.created_at ? formatLocaleDateTime(events[0].created_at, language) : 'Never'}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.17em] text-on-surface-variant/40">Thread replies</p>
                    <p className="mt-1 font-bold text-on-surface">{gmailReplyEnabled ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </div>
              </div>
            </section>

            {!webhookReady ? (
              <section className="rounded-[1.5rem] border border-error/15 bg-error/5 p-5">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined mt-0.5 text-error">error</span>
                  <div>
                    <p className="text-sm font-bold text-error">Webhook readiness problem</p>
                    <p className="mt-1 text-sm font-medium leading-6 text-error/80">
                      {!environment?.hasComposio
                        ? 'COMPOSIO_API_KEY is missing from this deployment.'
                        : !environment.hasWebhookSecret
                          ? 'COMPOSIO_WEBHOOK_SECRET is missing from this deployment.'
                          : `NEXT_PUBLIC_APP_URL is set to ${environment.configuredAppUrl}, but this deployment is running at ${new URL(environment.expectedWebhookUrl).origin}.`}
                    </p>
                    <p className="mt-2 break-all font-mono text-[11px] font-semibold text-error/70">
                      Expected endpoint: {environment?.expectedWebhookUrl ?? 'Unavailable'}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {automation?.status === 'active' && !providerTriggerReady ? (
              <section className="rounded-[1.5rem] border border-error/15 bg-error/5 p-5">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined mt-0.5 text-error">sync_problem</span>
                  <div>
                    <p className="text-sm font-bold text-error">Gmail trigger health problem</p>
                    <p className="mt-1 text-sm font-medium leading-6 text-error/80">
                      {providerTriggerHealthError
                        ? providerTriggerHealthError
                        : !providerTriggerHealth?.found
                          ? 'The stored trigger ID no longer exists in Composio. Pause and reactivate this automation to recreate it.'
                          : !providerTriggerHealth.active
                            ? 'Composio has disabled this Gmail trigger. Pause and reactivate it after checking the Gmail connection.'
                            : `Composio has not reported a Gmail poll in more than 45 minutes. Last poll: ${providerTriggerHealth.lastSyncedAt ? formatLocaleDateTime(providerTriggerHealth.lastSyncedAt, language) : 'unknown'}.`}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {automation && !gmailReplyEnabled ? (
              <section className="rounded-[1.5rem] border border-warning/15 bg-warning/5 p-5">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined mt-0.5 text-warning">info</span>
                  <div>
                    <p className="text-sm font-bold text-on-surface">Gmail thread replies are disabled</p>
                    <p className="mt-1 text-sm font-medium leading-6 text-on-surface-variant">
                      This automation can send a new email, but cannot reply in the original conversation. Enable <span className="font-mono text-xs">GMAIL_REPLY_TO_THREAD</span> in Gmail actions for true thread replies.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {automation?.last_error ? (
              <section className="rounded-[1.5rem] border border-error/15 bg-error/5 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-error">Latest automation error</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-error">{automation.last_error}</p>
              </section>
            ) : null}

            <section>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-headline text-lg font-bold text-on-surface">Recent activity</h2>
                  <p className="mt-1 text-sm font-medium text-on-surface-variant/55">
                    Every trigger is shown with its decision, actions, and final result.
                  </p>
                </div>
              </div>

              {events.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-outline-variant/20 bg-surface-container-lowest px-6 py-14 text-center">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">mail</span>
                  <h3 className="mt-4 text-base font-bold text-on-surface">No trigger events yet</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-on-surface-variant/60">
                    Activate the automation, then send a message to the connected Gmail account. The event and its run result will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {events.map((event) => {
                    const run = event.run_id ? runsById.get(event.run_id) ?? null : null;
                    const runResult = run ? getRunResult(run) : null;
                    const eventContext = getEventContext(event);
                    const runSteps = run ? runStepsByRunId.get(run.id) ?? [] : [];

                    return (
                      <article key={event.id} className="rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-5 sm:p-6">
                        <div className="flex flex-col gap-3 border-b border-outline-variant/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-bold text-on-surface">Gmail new message</h3>
                              <span className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] ${statusClasses(event.status)}`}>
                                {event.status}
                              </span>
                              {runResult ? (
                                <span className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] ${statusClasses(runResult.decision)}`}>
                                  {decisionLabel(runResult.decision)}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[11px] font-medium text-on-surface-variant/50">
                              {formatLocaleDateTime(event.created_at, language)}
                            </p>
                          </div>
                          <span className="truncate font-mono text-[10px] font-medium text-on-surface-variant/35 sm:max-w-72">
                            {event.external_event_id}
                          </span>
                        </div>

                        <div className="mt-6 space-y-5">
                          <TimelineStep icon="input" label="Trigger received">
                            <div className="grid gap-2 text-sm sm:grid-cols-2">
                              <p className="min-w-0 truncate font-semibold text-on-surface">
                                {eventContext.sender ?? 'Sender not included'}
                              </p>
                              <p className="min-w-0 truncate font-medium text-on-surface-variant sm:text-right">
                                {eventContext.subject ?? 'No subject included'}
                              </p>
                            </div>
                            {eventContext.threadId ? (
                              <p className="mt-2 truncate font-mono text-[10px] text-on-surface-variant/45">Thread {eventContext.threadId}</p>
                            ) : null}
                          </TimelineStep>

                          {runResult ? (
                            <>
                              <TimelineStep icon={decisionIcon(runResult.decision)} label="Decision">
                                <p className="text-sm font-bold text-on-surface">{decisionLabel(runResult.decision)}</p>
                                <p className="mt-1 text-sm font-medium leading-6 text-on-surface-variant/70">{runResult.reason}</p>
                                {runResult.missingInformation.length > 0 ? (
                                  <ul className="mt-2 space-y-1 text-sm font-medium text-warning">
                                    {runResult.missingInformation.map((item) => <li key={item}>• {item}</li>)}
                                  </ul>
                                ) : null}
                              </TimelineStep>

                              <TimelineStep icon="bolt" label="Actions">
                                {runResult.actions.length > 0 ? (
                                  <div className="space-y-2">
                                    {runResult.actions.map((action, index) => (
                                      <div key={`${action.toolName}:${index}`} className="flex flex-col gap-2 rounded-xl bg-surface-container-low px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-bold text-on-surface">{action.label}</p>
                                          <p className="mt-1 truncate text-[11px] font-medium text-on-surface-variant/60">{action.detail}</p>
                                        </div>
                                        <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] ${statusClasses(action.status)}`}>
                                          {action.status}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm font-medium text-on-surface-variant/65">No external action was attempted.</p>
                                )}
                              </TimelineStep>

                              <TimelineStep icon="summarize" label="Run summary" last>
                                <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-on-surface-variant/80">{runResult.summary}</p>
                                {run?.error_message ? (
                                  <p className="mt-3 rounded-xl bg-error/5 px-4 py-3 text-sm font-semibold text-error">{run.error_message}</p>
                                ) : null}
                              </TimelineStep>
                            </>
                          ) : (
                            <TimelineStep
                              icon={event.status === 'failed' ? 'error' : 'progress_activity'}
                              label={event.status === 'failed' ? 'Processing failed' : 'Waiting for run'}
                              last
                            >
                              <p className="text-sm font-medium text-on-surface-variant/65">
                                {event.status === 'failed'
                                  ? 'The event could not start or complete a runtime run. Check the latest automation error above.'
                                  : 'The event has been received and is waiting for execution details.'}
                              </p>
                            </TimelineStep>
                          )}
                        </div>

                        <details className="mt-6 border-t border-outline-variant/10 pt-4">
                          <summary className="cursor-pointer select-none text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/50 hover:text-on-surface">
                            Technical details
                          </summary>
                          <div className="mt-4 grid gap-4 text-[11px] sm:grid-cols-2">
                            <div className="space-y-2 font-mono text-on-surface-variant/60">
                              <p>Event: {event.id}</p>
                              <p>Run: {run?.id ?? 'Not created'}</p>
                              <p>Runtime: {run?.status ?? 'Not started'}</p>
                            </div>
                            <div className="space-y-2">
                              {runSteps.length > 0 ? runSteps.map((step) => (
                                <div key={step.id} className="flex items-start justify-between gap-3">
                                  <span className="font-medium text-on-surface-variant">{step.title}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${statusClasses(step.status)}`}>{step.status}</span>
                                </div>
                              )) : <p className="font-medium text-on-surface-variant/50">No run steps recorded.</p>}
                            </div>
                          </div>
                        </details>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
