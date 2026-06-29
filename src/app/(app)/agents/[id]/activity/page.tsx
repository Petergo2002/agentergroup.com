'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AgentViewTabs } from '@/components/agents/AgentViewTabs';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useToast } from '@/components/ui/ToastProvider';
import {
  buildAutomationRunResult,
  readAutomationRunResult,
} from '@/lib/automation/result';
import { normalizeAutomationTriggerPayload } from '@/lib/automation/payload';
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
  recipient: string | null;
  subject: string | null;
  threadId: string | null;
  messageId: string | null;
  body: string | null;
}

interface ActivityItem {
  event: AutomationEventRecord;
  run: RunRecord | null;
  runResult: AutomationRunResult | null;
  context: EventContext;
  steps: RunStepRecord[];
  outcome: string;
  actionSummary: string;
  hasError: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
  const storedPayload = isRecord(event.payload.payload)
    ? event.payload.payload
    : event.payload;
  const payload = normalizeAutomationTriggerPayload(event.trigger_slug, storedPayload);

  return {
    sender: formatSender(payload.sender),
    recipient: formatSender(payload.to),
    subject: readString(payload.subject)?.slice(0, 180) ?? null,
    threadId: readString(payload.threadId)?.slice(0, 120) ?? null,
    messageId: readString(payload.messageId)?.slice(0, 120) ?? null,
    body: readString(payload.body)?.replace(/\s+/g, ' ').slice(0, 600) ?? null,
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
    return 'bg-success/10 text-success ring-success/15';
  }

  if (['failed', 'error', 'action_failed'].includes(status)) {
    return 'bg-error/10 text-error ring-error/15';
  }

  if (['no_action', 'ignored'].includes(status)) {
    return 'bg-surface-container-high text-on-surface-variant ring-outline-variant/20';
  }

  return 'bg-warning/10 text-warning ring-warning/15';
}

function formatStatusLabel(status: string) {
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function triggerLabel(triggerSlug: string | null | undefined) {
  if (triggerSlug === 'GMAIL_NEW_GMAIL_MESSAGE') return 'Gmail new message';
  return triggerSlug ? formatStatusLabel(triggerSlug.toLowerCase()) : 'Trigger not saved';
}

function truncateIdentifier(value: string | null | undefined) {
  if (!value) return null;
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function cleanActivityText(value: string | null | undefined, maxLength = 1_000) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (isRecord(parsed)) {
      return (readString(parsed.summary) ?? readString(parsed.reason))?.slice(0, maxLength) ?? normalized.slice(0, maxLength);
    }
  } catch {
    // Legacy runs can contain operator text followed by raw JSON.
  }

  const jsonStart = normalized.search(/\{\s*"decision"\s*:/);
  const displayText = jsonStart > 0 ? normalized.slice(0, jsonStart).trim() : normalized;
  return displayText.slice(0, maxLength);
}

function eventOutcomeLabel(
  event: AutomationEventRecord,
  run: RunRecord | null,
  runResult: AutomationRunResult | null,
) {
  if (event.status === 'failed' || run?.status === 'failed' || runResult?.decision === 'action_failed') {
    return 'Failed';
  }
  if (event.status === 'processing' || run?.status === 'running') return 'Processing';
  if (runResult?.decision === 'action_taken') return 'Action completed';
  if (runResult?.decision === 'needs_input') return 'Needs input';
  if (runResult?.decision === 'no_action' || event.status === 'ignored') return 'Reviewed, no action';
  return formatStatusLabel(event.status);
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

function actionSummary(runResult: AutomationRunResult | null) {
  if (!runResult) return 'Waiting for run';
  const failed = runResult.actions.filter((action) => action.status === 'failed').length;
  if (failed > 0) return `${failed} failed`;
  if (runResult.actions.length > 0) return `${runResult.actions.length} completed`;
  return 'No external action';
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex h-7 w-fit items-center rounded-full px-2.5 text-xs font-semibold ring-1 ${statusClasses(status)}`}>
      {formatStatusLabel(status)}
    </span>
  );
}

function HealthItem({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'error';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'error'
          ? 'text-error'
          : 'text-on-surface';

  return (
    <div className="min-w-0 border-l border-outline-variant/10 pl-3 first:border-l-0 first:pl-0">
      <p className="text-[11px] font-medium text-on-surface-variant/55">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function DetailLine({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-on-surface-variant/60">{label}</p>
      <div className={`mt-1 break-words text-sm font-semibold text-on-surface ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-outline-variant/10 py-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function AlertBanner({
  icon,
  title,
  children,
  tone = 'error',
}: {
  icon: string;
  title: string;
  children: ReactNode;
  tone?: 'error' | 'warning';
}) {
  const className = tone === 'error'
    ? 'border-error/15 bg-error/5 text-error'
    : 'border-warning/15 bg-warning/5 text-warning';

  return (
    <section className={`rounded-xl border px-4 py-3 ${className}`}>
      <div className="flex gap-3">
        <span className="material-symbols-outlined mt-0.5 text-[18px]" aria-hidden="true">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <div className="mt-1 text-sm leading-6 text-on-surface-variant">{children}</div>
        </div>
      </div>
    </section>
  );
}

function ActivityRow({
  item,
  selected,
  language,
  onSelect,
}: {
  item: ActivityItem;
  selected: boolean;
  language: 'en' | 'sv';
  onSelect: () => void;
}) {
  const title = item.context.subject ?? 'No subject included';
  const subtitle = item.context.sender ?? 'Sender not included';

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full border-b border-l-2 border-b-outline-variant/10 px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-surface-container-low ${
        selected ? 'border-l-primary bg-surface-container-lowest' : 'border-l-transparent'
      }`}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-on-surface">{title}</p>
            <p className="mt-1 truncate text-xs font-medium text-on-surface-variant/65">{subtitle}</p>
          </div>
          <span className="shrink-0 text-xs font-medium text-on-surface-variant/55">
            {formatLocaleDateTime(item.event.created_at, language)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={item.event.status} />
          {item.runResult ? <StatusBadge status={item.runResult.decision} /> : null}
          {item.hasError ? <StatusBadge status="failed" /> : null}
        </div>

        <div className="grid gap-2 text-xs text-on-surface-variant sm:grid-cols-2">
          <span className="truncate">
            <span className="font-semibold text-on-surface">Outcome:</span> {item.outcome}
          </span>
          <span className="truncate">
            <span className="font-semibold text-on-surface">Action:</span> {item.actionSummary}
          </span>
        </div>
      </div>
    </button>
  );
}

function ActivityDetail({
  item,
  selectedConnection,
  providerTriggerHealth,
  providerTriggerHealthError,
  language,
}: {
  item: ActivityItem | null;
  selectedConnection: ConnectionRecord | null;
  providerTriggerHealth: ComposioTriggerHealth | null;
  providerTriggerHealthError: string | null;
  language: 'en' | 'sv';
}) {
  if (!item) {
    return (
      <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container-lowest px-6 py-12 text-center">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant/35" aria-hidden="true">receipt_long</span>
        <h2 className="mt-4 text-base font-semibold text-on-surface">No run selected</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-on-surface-variant/70">
          Select a trigger event to inspect the decision, generated message, actions, and diagnostics.
        </p>
      </div>
    );
  }

  const { event, run, runResult, context, steps } = item;
  const cleanSummary = cleanActivityText(runResult?.summary);
  const cleanReason = cleanActivityText(runResult?.reason, 700);
  const generatedMessage = runResult?.generatedMessage ?? null;

  return (
    <article className="min-h-0 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm">
      <div className="border-b border-outline-variant/10 px-5 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-on-surface-variant/60">{triggerLabel(event.trigger_slug)}</p>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-normal text-on-surface">
              {context.subject ?? 'No subject included'}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant/65">
              {formatLocaleDateTime(event.created_at, language)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={event.status} />
            {runResult ? <StatusBadge status={runResult.decision} /> : null}
          </div>
        </div>
      </div>

      <div className="px-5 py-5">
        <DetailSection title="Trigger context">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DetailLine label="From" value={context.sender ?? 'Sender not included'} />
            <DetailLine label="To" value={context.recipient ?? selectedConnection?.account_label ?? 'Connected inbox'} />
            <DetailLine label="Thread" value={truncateIdentifier(context.threadId) ?? 'No thread id'} mono={Boolean(context.threadId)} />
            <DetailLine label="Message" value={truncateIdentifier(context.messageId) ?? 'No message id'} mono={Boolean(context.messageId)} />
          </div>
          {context.body ? (
            <div className="mt-4 rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-3">
              <p className="text-xs font-medium text-on-surface-variant/60">Safe message preview</p>
              <p className="mt-2 line-clamp-4 text-sm leading-6 text-on-surface-variant">
                {context.body}
              </p>
            </div>
          ) : null}
        </DetailSection>

        <DetailSection title="Decision">
          {runResult ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={runResult.decision} />
                <span className="text-sm font-semibold text-on-surface">
                  {cleanSummary ?? decisionLabel(runResult.decision)}
                </span>
              </div>
              {cleanReason ? (
                <p className="text-sm leading-6 text-on-surface-variant/75">{cleanReason}</p>
              ) : null}
              {runResult.missingInformation.length > 0 ? (
                <div className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3">
                  <p className="text-xs font-semibold text-warning">Missing information</p>
                  <ul className="mt-2 space-y-1 text-sm text-on-surface-variant">
                    {runResult.missingInformation.map((itemText) => <li key={itemText}>{itemText}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm leading-6 text-on-surface-variant/75">
              {event.status === 'failed'
                ? 'The event failed before a run result was stored.'
                : 'The trigger has been received and execution details will appear when the run is recorded.'}
            </p>
          )}
        </DetailSection>

        <DetailSection title="Generated message">
          {generatedMessage ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailLine label="Recipient" value={generatedMessage.to ?? context.sender ?? 'Recipient not stored'} />
                <DetailLine label="Subject" value={generatedMessage.subject ?? context.subject ?? 'Subject not stored'} />
              </div>
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-3">
                <p className="text-xs font-medium text-on-surface-variant/60">Message preview</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-on-surface">
                  {generatedMessage.body ?? 'The generated message body was not stored.'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-6 text-on-surface-variant/75">
              {runResult?.actions.length
                ? 'A generated-message preview was not stored for this run. The verified action result is shown below.'
                : 'No outbound message was generated for this event.'}
            </p>
          )}
        </DetailSection>

        <DetailSection title="Verified actions">
          {runResult?.actions.length ? (
            <div className="space-y-2">
              {runResult.actions.map((action, index) => (
                <div key={`${action.toolName}:${index}`} className="flex flex-col gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-on-surface">{action.label}</p>
                    <p className="mt-1 text-sm leading-5 text-on-surface-variant/70">{action.detail}</p>
                  </div>
                  <StatusBadge status={action.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-on-surface-variant/75">No external action was attempted.</p>
          )}
          {run?.error_message ? (
            <p className="mt-3 rounded-xl bg-error/5 px-4 py-3 text-sm font-semibold text-error">{run.error_message}</p>
          ) : null}
        </DetailSection>

        <details className="border-t border-outline-variant/10 pt-5">
          <summary className="cursor-pointer select-none text-sm font-semibold text-on-surface-variant/70 hover:text-on-surface">
            Diagnostics
          </summary>
          <div className="mt-4 grid gap-5 text-xs lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="space-y-2 rounded-xl bg-surface-container-low px-4 py-3 font-mono text-on-surface-variant/75">
              <p>Event: {event.id}</p>
              <p>External: {event.external_event_id}</p>
              <p>Run: {run?.id ?? 'Not created'}</p>
              <p>Runtime: {run?.status ?? 'Not started'}</p>
              <p>Provider: {providerTriggerHealthError ?? (providerTriggerHealth ? `${providerTriggerHealth.found ? 'found' : 'missing'} / ${providerTriggerHealth.active ? 'active' : 'inactive'}` : 'Not checked')}</p>
              <p>Last poll: {providerTriggerHealth?.lastSyncedAt ? formatLocaleDateTime(providerTriggerHealth.lastSyncedAt, language) : 'Unknown'}</p>
            </div>
            <div className="space-y-2">
              {steps.length > 0 ? steps.map((step) => (
                <div key={step.id} className="flex items-start justify-between gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-low px-3 py-2">
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-on-surface">{step.title}</span>
                    {step.detail ? (
                      <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-on-surface-variant/65">{step.detail}</span>
                    ) : null}
                  </div>
                  <StatusBadge status={step.status} />
                </div>
              )) : <p className="font-medium text-on-surface-variant/50">No run steps recorded.</p>}
            </div>
          </div>
        </details>
      </div>
    </article>
  );
}

export default function AgentActivityPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedEventId = searchParams.get('event');
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(requestedEventId);
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

  const activityItems = useMemo<ActivityItem[]>(() => events.map((event) => {
    const run = event.run_id ? runsById.get(event.run_id) ?? null : null;
    const runResult = run ? getRunResult(run) : null;
    const context = getEventContext(event);
    const outcome = eventOutcomeLabel(event, run, runResult);
    const hasError = event.status === 'failed' || run?.status === 'failed' || runResult?.decision === 'action_failed';

    return {
      event,
      run,
      runResult,
      context,
      steps: run ? runStepsByRunId.get(run.id) ?? [] : [],
      outcome,
      actionSummary: actionSummary(runResult),
      hasError,
    };
  }), [events, runStepsByRunId, runsById]);

  useEffect(() => {
    if (requestedEventId) {
      setSelectedEventId(requestedEventId);
    }
  }, [requestedEventId]);

  useEffect(() => {
    if (activityItems.length === 0) {
      setSelectedEventId(null);
      return;
    }

    if (!selectedEventId || !activityItems.some((item) => item.event.id === selectedEventId)) {
      setSelectedEventId(activityItems[0].event.id);
    }
  }, [activityItems, selectedEventId]);

  const selectedItem =
    activityItems.find((item) => item.event.id === selectedEventId) ?? activityItems[0] ?? null;
  const latestEvent = events[0] ?? null;

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
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant/10 bg-surface/90 px-4 backdrop-blur-xl sm:px-6 lg:px-7">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-outline-variant/15 bg-surface-container-low text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface active:scale-95"
          >
            <span className="material-symbols-outlined text-xl" aria-hidden="true">arrow_back</span>
          </Link>

          <div className="flex min-w-0 items-center gap-4">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/45">
                Automation activity
              </p>
              <h1 className="truncate text-sm font-semibold tracking-tight text-on-surface sm:max-w-64">
                {agent?.name ?? 'Activity log'}
              </h1>
            </div>
            <div className="hidden h-4 w-px bg-outline-variant/20 sm:block" />
            <AgentViewTabs agentId={agentId} current="activity" surface="automation" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refreshActivity()}
          disabled={isRefreshing}
          aria-label="Refresh activity"
          className="flex h-9 items-center gap-2 rounded-xl border border-outline-variant/15 bg-surface-container-low px-3 text-xs font-semibold text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface active:scale-95 disabled:cursor-wait disabled:opacity-60 sm:px-4"
        >
          <span className={`material-symbols-outlined text-[17px] ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true">
            refresh
          </span>
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:overflow-hidden lg:px-7">
        {isLoading ? (
          <div className="space-y-4 lg:h-full">
            <div className="h-28 animate-pulse rounded-2xl border border-outline-variant/10 bg-surface-container-low" />
            <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
              <div className="h-96 animate-pulse rounded-2xl border border-outline-variant/10 bg-surface-container-low" />
              <div className="h-96 animate-pulse rounded-2xl border border-outline-variant/10 bg-surface-container-low" />
            </div>
          </div>
        ) : (
          <div className="flex min-h-full flex-col gap-4 lg:h-full">
            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={automation?.status ?? 'draft'} />
                    <StatusBadge status={webhookReady ? 'active' : 'error'} />
                    {automation?.status === 'active' ? (
                      <StatusBadge status={providerTriggerReady ? 'active' : 'error'} />
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-base font-semibold tracking-normal text-on-surface">
                    Run history
                  </h2>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2 xl:min-w-[620px] xl:grid-cols-4">
                  <HealthItem label="Trigger" value={triggerLabel(automation?.trigger_slug)} />
                  <HealthItem
                    label="Account"
                    value={selectedConnection?.account_label ?? 'No account selected'}
                    tone={selectedConnection ? 'neutral' : 'warning'}
                  />
                  <HealthItem
                    label="Readiness"
                    value={webhookReady && providerTriggerReady ? 'Ready' : 'Needs attention'}
                    tone={webhookReady && providerTriggerReady ? 'success' : 'error'}
                  />
                  <HealthItem
                    label="Last event"
                    value={latestEvent ? formatLocaleDateTime(latestEvent.created_at, language) : 'No events'}
                  />
                </div>
              </div>
            </section>

            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
              <div className="flex min-h-0 flex-col gap-3">
                {!webhookReady ? (
                  <AlertBanner icon="error" title="Webhook readiness problem">
                    {!environment?.hasComposio
                      ? 'COMPOSIO_API_KEY is missing from this deployment.'
                      : !environment.hasWebhookSecret
                        ? 'COMPOSIO_WEBHOOK_SECRET is missing from this deployment.'
                        : `NEXT_PUBLIC_APP_URL does not match this deployment. Expected endpoint: ${environment?.expectedWebhookUrl ?? 'Unavailable'}`}
                  </AlertBanner>
                ) : null}

                {automation?.status === 'active' && !providerTriggerReady ? (
                  <AlertBanner icon="sync_problem" title="Trigger health problem">
                    {providerTriggerHealthError
                      ? providerTriggerHealthError
                      : !providerTriggerHealth?.found
                        ? 'The stored trigger ID no longer exists. Pause and reactivate this automation to recreate it.'
                        : !providerTriggerHealth.active
                          ? 'The provider has disabled this trigger. Check the connected account, then pause and reactivate it.'
                          : `The provider has not reported a poll in more than 45 minutes. Last poll: ${providerTriggerHealth.lastSyncedAt ? formatLocaleDateTime(providerTriggerHealth.lastSyncedAt, language) : 'unknown'}.`}
                  </AlertBanner>
                ) : null}

                {automation && !gmailReplyEnabled ? (
                  <AlertBanner icon="info" title="Thread replies are disabled" tone="warning">
                    This automation can send a new email, but cannot reply in the original thread.
                  </AlertBanner>
                ) : null}

                {automation?.last_error ? (
                  <AlertBanner icon="warning" title="Latest automation error">
                    {automation.last_error}
                  </AlertBanner>
                ) : null}

                <section className="min-h-[24rem] overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm lg:min-h-0 lg:flex-1">
                  <div className="border-b border-outline-variant/10 px-4 py-4">
                    <h2 className="text-sm font-semibold text-on-surface">Events</h2>
                    <p className="mt-1 text-xs text-on-surface-variant/60">
                      Newest trigger events first. Select one to inspect the run.
                    </p>
                  </div>

                  {activityItems.length === 0 ? (
                    <div className="flex min-h-[20rem] flex-col items-center justify-center px-6 py-12 text-center">
                      <span className="material-symbols-outlined text-3xl text-on-surface-variant/35" aria-hidden="true">mark_email_unread</span>
                      <h3 className="mt-4 text-base font-semibold text-on-surface">No trigger events yet</h3>
                      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-on-surface-variant/70">
                        Activate the automation and send a message to the connected inbox. Events will appear here as they arrive.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[34rem] overflow-y-auto lg:max-h-none lg:h-[calc(100%-73px)]">
                      {activityItems.map((item) => (
                        <ActivityRow
                          key={item.event.id}
                          item={item}
                          selected={selectedItem?.event.id === item.event.id}
                          language={language}
                          onSelect={() => setSelectedEventId(item.event.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div className="min-h-0 lg:overflow-y-auto">
                <ActivityDetail
                  item={selectedItem}
                  selectedConnection={selectedConnection}
                  providerTriggerHealth={providerTriggerHealth}
                  providerTriggerHealthError={providerTriggerHealthError}
                  language={language}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
