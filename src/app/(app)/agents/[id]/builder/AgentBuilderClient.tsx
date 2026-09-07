'use client';

import Link from 'next/link';
import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { parseVariableKeys } from '@/lib/template-variables';
import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Handle,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowInstance,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAppContext } from '@/components/app/AppContext';
import { SimpleIcon } from '@/components/icons/SimpleIcon';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { hasInternalAssistantsEnabled, hasAutomationsEnabled } from '@/lib/assistants/feature-flags';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/ToastProvider';
import { AgentModelPicker } from '@/components/agents/AgentModelPicker';
import { canEditAgentRecord } from '@/lib/agents/access';
import { AgentViewTabs } from '@/components/agents/AgentViewTabs';
import { MiloLogo } from '@/components/brand/MiloLogo';
import { MiloLoadingScreen } from '@/components/milo/MiloLoadingScreen';
import {
  AUTOMATION_GMAIL_TRIGGER_CONFIG,
  AUTOMATION_GMAIL_TRIGGER_SLUG,
  buildInitialDefinition,
} from '@/lib/agents/defaults';
import {
  getSingleToolConnection,
  resolveToolNodeConnection,
} from '@/lib/builder-connection-resolver';
import { getEffectiveConnectionStatus } from '@/lib/connections';
import { DEFAULT_END_CHAT_INACTIVITY_TIMEOUT_SECONDS } from '@/lib/end-chat';
import { normalizeGmailRecipientEmail } from '@/lib/gmail';
import { formatLocaleDateTime, type PlatformLanguage } from '@/lib/i18n';
import type { GoogleCalendarListItem } from '@/lib/google-calendar';
import { CalEventTypeListItem, } from '@/lib/cal';
import {
  getRecommendedChatToolsForToolkit,
  getSupportedIntegration,
  isChatIntegrationSlug,
  isToolNameForToolkit,
} from '@/lib/integrations';
import { getKnowledgeStatusTone, isReadyKnowledgeSource } from '@/lib/knowledge';
import { jsonFetcher, workspaceSWRKey } from '@/lib/json-fetcher';
import {
  createLegacyOpenRouterModelOption,
  getFallbackOpenRouterModelSections,
  getOpenRouterModelOptionById,
  OPENROUTER_DEFAULT_AGENT_MODEL,
  type OpenRouterModelSection,
} from '@/lib/openrouter-models';
import { formatRelativeDate } from '@/lib/utils';
import type {
  AgentRecord,
  AgentBuilderBootstrapResponse,
  AgentAutomationRecord,
  AgentVersionRecord,
  AutomationEventRecord,
  ComposioTriggerHealth,
  BuilderDefinition,
  BuilderNodeData,
  BuilderNodeKind,
  BuilderTriggerSource,
  CalBuilderNodeData,
  ConnectionRecord,
  EndChatBuilderNodeData,
  GmailBuilderNodeData,
  GoogleAdsBuilderNodeData,
  HubSpotBuilderNodeData,
  OutlookBuilderNodeData,
  ShopifyBuilderNodeData,
  SlackBuilderNodeData,
  GoogleCalendarBuilderNodeData,
  KnowledgeBuilderNodeData,
  KnowledgeFolderWithSources,
  KnowledgeSourceRecord,
  RunRecord,
  TextAnnotationBuilderNodeData,
  TriggerBuilderNodeData,
} from '@/lib/types';

type BuilderFlowNode = Node<BuilderNodeData>;
type BuilderFlowEdge = Edge;
type ToolNodeKind = 'gmail' | 'outlook' | 'slack' | 'hubspot' | 'shopify' | 'googleads' | 'googlecalendar' | 'cal';
type ToolNodeData = GmailBuilderNodeData | OutlookBuilderNodeData | SlackBuilderNodeData | HubSpotBuilderNodeData | ShopifyBuilderNodeData | GoogleAdsBuilderNodeData | GoogleCalendarBuilderNodeData | CalBuilderNodeData;
type LibraryItemKey = 'trigger' | 'knowledge' | 'tools' | 'endchat' | 'annotation' | 'agent';
type Translate = (key: string, values?: Record<string, string | number>) => string;
type BuilderStatusNote =
  | { kind: 'draftInitial' }
  | { kind: 'lastSaved'; date: string }
  | { kind: 'publishedAt'; date: string; version: number }
  | { kind: 'rolledBackAt'; date: string };

interface NodeLibraryItem {
  key: LibraryItemKey;
  label: string;
  icon: string;
  description: string;
  fixed?: boolean;
}

interface NormalizedBuilderDefinition {
  nodes: BuilderFlowNode[];
  edges: BuilderFlowEdge[];
  requiresToolReview: boolean;
}

interface ToolkitActionOption {
  name: string;
  description: string;
  recommended: boolean;
}

interface OpenRouterModelsApiResponse {
  defaultModel?: string;
  sections?: OpenRouterModelSection[];
  source?: 'openrouter' | 'fallback';
}

interface AutomationEnvironmentStatus {
  hasComposio: boolean;
  hasWebhookSecret: boolean;
}

const FIXED_NODE_IDS = {
  trigger: 'trigger',
  agent: 'agent',
} as const;

const DEFAULT_EDGE_STYLE = {
  stroke: 'var(--color-primary)',
  strokeWidth: 2,
  opacity: 0.9,
};

const PRIMARY_EDGE_STYLE = {
  stroke: 'var(--color-primary)',
  strokeWidth: 2,
  opacity: 0.9,
};

const DEFAULT_POSITIONS: Record<BuilderNodeKind, { x: number; y: number }> = {
  trigger: { x: 40, y: 150 },
  agent: { x: 320, y: 150 },
  knowledge: { x: 610, y: 70 },
  gmail: { x: 610, y: 220 },
  outlook: { x: 610, y: 220 },
  slack: { x: 610, y: 290 },
  hubspot: { x: 610, y: 360 },
  shopify: { x: 610, y: 430 },
  googleads: { x: 610, y: 500 },
  googlecalendar: { x: 610, y: 570 },
  cal: { x: 610, y: 710 },
  endchat: { x: 1210, y: 150 },
  annotation: { x: 320, y: 360 },
};

const NODE_LIBRARY: NodeLibraryItem[] = [
  {
    key: 'trigger',
    label: 'Trigger',
    icon: 'input',
    description: 'Choose what starts this agent.',
    fixed: true,
  },
  {
    key: 'agent',
    label: 'Agent Core',
    icon: 'smart_toy',
    description: 'The AI brain that processes and responds to users.',
    fixed: true,
  },
  {
    key: 'knowledge',
    label: 'Knowledge',
    icon: 'library_books',
    description: 'Attach workspace sources the agent can retrieve from.',
  },
  {
    key: 'tools',
    label: 'Connected Tools',
    icon: 'build',
    description: 'Pick Gmail or Google Calendar for live in-chat actions.',
  },
  {
    key: 'endchat',
    label: 'End Chat',
    icon: 'stop_circle',
    description: 'Define when the backend should close the conversation.',
  },
  {
    key: 'annotation',
    label: 'Text annotation',
    icon: 'sticky_note_2',
    description: 'Add a canvas note that does not affect runtime behavior.',
  },
];

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'America/Toronto', label: 'Toronto' },
  { value: 'America/Vancouver', label: 'Vancouver' },
  { value: 'America/Mexico_City', label: 'Mexico City' },
  { value: 'America/Sao_Paulo', label: 'São Paulo' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam' },
  { value: 'Europe/Madrid', label: 'Madrid' },
  { value: 'Europe/Rome', label: 'Rome' },
  { value: 'Europe/Stockholm', label: 'Stockholm' },
  { value: 'Europe/Warsaw', label: 'Warsaw' },
  { value: 'Europe/Moscow', label: 'Moscow' },
  { value: 'Europe/Istanbul', label: 'Istanbul' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Bangkok', label: 'Bangkok' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Seoul', label: 'Seoul' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'Australia/Melbourne', label: 'Melbourne' },
  { value: 'Australia/Perth', label: 'Perth' },
  { value: 'Pacific/Auckland', label: 'Auckland' },
];

const TOOL_NODE_KINDS: ToolNodeKind[] = ['gmail', 'outlook', 'slack', 'hubspot', 'shopify', 'googleads', 'googlecalendar', 'cal'];
const TRIGGER_SOURCE_ORDER: BuilderTriggerSource[] = [
  'user_message',
  'gmail_new_message',
];

function getAvailableTriggerSources(allowExternalTriggers: boolean): BuilderTriggerSource[] {
  return allowExternalTriggers ? TRIGGER_SOURCE_ORDER : ['user_message'];
}

function getStarterPromptFields(prompts: string[]) {
  return Array.from({ length: 3 }, (_, index) => prompts[index] ?? '');
}

function getNodeLibraryText(key: LibraryItemKey, t: Translate, automationMode = false) {
  switch (key) {
    case 'trigger':
      return {
        label: t('agentBuilder.nodeLibrary.trigger'),
        description: t('agentBuilder.nodeLibrary.triggerDescription'),
      };
    case 'agent':
      return {
        label: automationMode
          ? t('agentBuilder.nodeLibrary.automationAgent')
          : t('agentBuilder.nodeLibrary.agent'),
        description: automationMode
          ? t('agentBuilder.nodeLibrary.automationAgentDescription')
          : t('agentBuilder.nodeLibrary.agentDescription'),
      };
    case 'knowledge':
      return {
        label: t('agentBuilder.nodeLibrary.knowledge'),
        description: t('agentBuilder.nodeLibrary.knowledgeDescription'),
      };
    case 'tools':
      return {
        label: automationMode
          ? t('agentBuilder.nodeLibrary.automationTools')
          : t('agentBuilder.nodeLibrary.tools'),
        description: automationMode
          ? t('agentBuilder.nodeLibrary.automationToolsDescription')
          : t('agentBuilder.nodeLibrary.toolsDescription'),
      };
    case 'endchat':
      return {
        label: t('agentBuilder.nodeLibrary.endChat'),
        description: t('agentBuilder.nodeLibrary.endChatDescription'),
      };
    case 'annotation':
      return {
        label: t('agentBuilder.nodeLibrary.annotation'),
        description: t('agentBuilder.nodeLibrary.annotationDescription'),
      };
  }
}

function getBuilderNodeText(kind: BuilderNodeKind, t: Translate, automationMode = false) {
  switch (kind) {
    case 'trigger':
      return {
        label: t('agentBuilder.triggerLabel'),
        type: t('agentBuilder.triggerType'),
        description: t('agentBuilder.triggerDescription'),
      };
    case 'agent':
      return {
        label: automationMode
          ? t('agentBuilder.nodeLibrary.automationAgent')
          : t('agentBuilder.agentLabel'),
        type: automationMode
          ? t('agentBuilder.automationLogicType')
          : t('agentBuilder.coreType'),
        description: automationMode
          ? t('agentBuilder.nodeLibrary.automationAgentDescription')
          : t('agentBuilder.coreDescription'),
      };
    case 'knowledge':
      return {
        label: t('agentBuilder.nodeLibrary.knowledge'),
        type: t('agentBuilder.knowledgeType'),
        description: t('agentBuilder.nodeLibrary.knowledgeDescription'),
      };
    case 'gmail':
      return {
        label: 'Gmail',
        type: t('agentBuilder.toolType'),
        description: t('agentBuilder.gmailDescription'),
      };
    case 'outlook':
      return {
        label: 'Microsoft Outlook',
        type: t('agentBuilder.toolType'),
        description: t('agentBuilder.outlookDescription'),
      };
    case 'slack':
      return {
        label: 'Slack',
        type: t('agentBuilder.toolType'),
        description: t('agentBuilder.slackDescription'),
      };
    case 'hubspot':
      return {
        label: 'HubSpot',
        type: t('agentBuilder.toolType'),
        description: t('agentBuilder.hubspotDescription'),
      };
    case 'shopify':
      return {
        label: 'Shopify',
        type: t('agentBuilder.toolType'),
        description: t('agentBuilder.shopifyDescription'),
      };
    case 'googleads':
      return {
        label: 'Google Ads',
        type: t('agentBuilder.toolType'),
        description: t('agentBuilder.googleAdsDescription'),
      };
    case 'googlecalendar':
      return {
        label: 'Google Calendar',
        type: t('agentBuilder.toolType'),
        description: t('agentBuilder.googleCalendarDescription'),
      };
    case 'cal':
      return {
        label: 'Cal.com',
        type: t('agentBuilder.toolType'),
        description: t('agentBuilder.calDescription'),
      };
    case 'endchat':
      return {
        label: t('agentBuilder.endChatLabel'),
        type: t('agentBuilder.controlType'),
        description: t('agentBuilder.endChatNodeDescription'),
      };
    case 'annotation':
      return {
        label: t('agentBuilder.annotationLabel'),
        type: t('agentBuilder.annotationType'),
        description: t('agentBuilder.annotationDescription'),
      };
  }
}

function getTriggerSourceText(source: BuilderTriggerSource, t: Translate) {
  switch (source) {
    case 'user_message':
      return {
        label: t('agentBuilder.triggerSources.chatMessage'),
        description: t('agentBuilder.triggerSources.chatMessageDescription'),
        icon: 'chat',
      };
    case 'gmail_new_message':
      return {
        label: t('agentBuilder.triggerSources.gmailNewMessage'),
        description: t('agentBuilder.triggerSources.gmailNewMessageDescription'),
        icon: 'mail',
      };
  }
}

function translateConnectionStatus(status: string, t: Translate) {
  switch (status) {
    case 'connected':
      return t('statuses.connection.connected');
    case 'pending':
      return t('statuses.connection.pending');
    case 'error':
      return t('statuses.connection.error');
    case 'disconnected':
      return t('statuses.connection.disconnected');
    default:
      return status;
  }
}

function translateKnowledgeStatus(status: string, t: Translate) {
  switch (status) {
    case 'pending':
      return t('statuses.knowledge.pending');
    case 'processing':
      return t('statuses.knowledge.processing');
    case 'ready':
      return t('statuses.knowledge.ready');
    case 'failed':
      return t('statuses.knowledge.failed');
    case 'syncing':
      return t('statuses.knowledge.syncing');
    default:
      return status;
  }
}

function formatToolActionName(toolName: string) {
  return toolName
    .replace(/^(GMAIL|OUTLOOK|SLACK|HUBSPOT|SHOPIFY|GOOGLECALENDAR|CAL)_/, '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getEnabledToolNames(kind: ToolNodeKind, data?: { enabledTools?: unknown }) {
  const configuredTools = Array.isArray(data?.enabledTools)
    ? data.enabledTools.filter(
        (toolName): toolName is string =>
          typeof toolName === 'string' && isToolNameForToolkit(toolName, kind),
      )
    : null;

  return configuredTools ?? getRecommendedChatToolsForToolkit(kind);
}

function matchesToolActionQuery(action: ToolkitActionOption, query: string) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return (
    formatToolActionName(action.name).toLowerCase().includes(normalizedQuery) ||
    action.name.toLowerCase().includes(normalizedQuery) ||
    action.description.toLowerCase().includes(normalizedQuery)
  );
}

function formatBuilderStatusNote(
  statusNote: BuilderStatusNote,
  language: PlatformLanguage,
  t: Translate,
) {
  switch (statusNote.kind) {
    case 'draftInitial':
      return t('agentBuilder.draftInitial');
    case 'lastSaved':
      return t('agentBuilder.lastSaved', {
        date: formatLocaleDateTime(statusNote.date, language),
      });
    case 'publishedAt':
      return t('agentBuilder.publishedAt', {
        version: statusNote.version,
        date: formatLocaleDateTime(statusNote.date, language),
      });
    case 'rolledBackAt':
      return t('agentBuilder.rolledBackAt', {
        date: formatLocaleDateTime(statusNote.date, language),
      });
  }
}

function ActionDescriptionButton() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant/10 bg-surface text-on-surface-variant/60 transition-all hover:border-primary/20 hover:text-primary focus-visible:border-primary/30 focus-visible:text-primary focus-visible:outline-none">
      <span className="material-symbols-outlined text-base">info</span>
    </span>
  );
}

const AgentNode = memo(function AgentNode({ data, selected }: NodeProps<BuilderFlowNode>) {
  const { t } = useLanguage();
  const nodeText = getBuilderNodeText(
    data.kind,
    t,
    data.kind === 'agent' && data.automationMode === true,
  );
  
  const label = data.label || nodeText?.label;
  const type = data.type || nodeText?.type || 'Blueprint Node';
  const description = data.description || nodeText?.description;
  const isMiloAgent = data.kind === 'agent' && data.isMiloBrand === true;
  const noteText =
    data.kind === 'annotation' && typeof data.text === 'string'
      ? data.text.trim()
      : '';

  if (data.kind === 'annotation') {
    return (
      <div
        className={`group/node min-h-[168px] w-[288px] rotate-[-1deg] rounded-[10px] border bg-amber-50 px-5 py-4 text-slate-950 shadow-[0_18px_34px_rgba(15,23,42,0.10)] transition-all duration-200 dark:bg-[#2b2413] dark:text-amber-50 ${
          selected
            ? 'border-primary/55 ring-4 ring-primary/12 shadow-[0_22px_44px_rgba(15,23,42,0.14)]'
            : 'border-amber-200 hover:border-amber-300 hover:shadow-[0_22px_40px_rgba(15,23,42,0.13)] dark:border-amber-500/25 dark:hover:border-amber-400/45'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
              sticky_note_2
            </span>
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-200">
              {type}
            </span>
          </div>
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary/80 shadow-[0_0_0_4px_rgba(var(--primary-rgb),0.12)]" />
        </div>

        <p className="mt-4 line-clamp-6 whitespace-pre-wrap break-words text-[15px] font-semibold leading-6">
          {noteText || t('agentBuilder.annotationNodeEmpty')}
        </p>

        {!noteText ? (
          <p className="mt-3 text-xs font-medium text-amber-700/65 dark:text-amber-100/55">
            {t('agentBuilder.annotationNodeHint')}
          </p>
        ) : null}
      </div>
    );
  }

  const badgeToneClass = {
    default: 'bg-background text-on-surface-variant',
    success: 'bg-primary/10 text-primary',
    warning: 'bg-surface-container-high text-on-surface',
    error: 'bg-error-container text-on-error-container',
  }[data.badgeTone ?? 'default'];
  const iconTone =
    data.kind === 'trigger'
      ? 'bg-warning/10 text-warning'
      : data.kind === 'agent'
        ? 'bg-primary/10 text-primary'
        : 'bg-surface-container-high text-on-surface-variant';

  return (
    <div
      className={`group/node w-[244px] rounded-2xl border bg-surface shadow-sm transition-all duration-200 ${
        selected
          ? 'border-primary/45 ring-4 ring-primary/10 shadow-lg'
          : 'border-outline-variant/20 hover:border-outline-variant/40 hover:shadow-md'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!-left-[6px] !h-3 !w-3 !border-[3px] !border-surface !bg-primary"
      />
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">
          {type}
        </span>
        {data.badgeText ? (
          <span
            className={`max-w-[118px] truncate rounded-full px-2 py-0.5 text-[9px] font-semibold ${badgeToneClass}`}
          >
            {data.badgeText}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-3 px-4 pb-4">
        <div className={`flex shrink-0 items-center justify-center rounded-xl ${isMiloAgent ? 'h-10 w-10 bg-surface-container-low' : `h-9 w-9 ${iconTone}`}`}>
          {isMiloAgent ? (
            <MiloLogo size={36} className="h-9 w-9" />
          ) : (data as { simpleIcon?: string }).simpleIcon ? (
            <SimpleIcon
              iconKey={(data as { simpleIcon?: string }).simpleIcon}
              color={(data as { simpleIconColor?: string }).simpleIconColor}
              size={18}
            />
          ) : (
            <span className="material-symbols-outlined text-lg">{data.icon || 'smart_toy'}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold tracking-tight text-on-surface">{label}</p>
          <p className="mt-0.5 line-clamp-1 text-[10px] leading-4 text-on-surface-variant/60">
            {description}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!-right-[6px] !h-3 !w-3 !border-[3px] !border-surface !bg-primary"
      />
    </div>
  );
});

AgentNode.displayName = 'AgentNode';

const BUILDER_NODE_TYPES = { agentNode: AgentNode };

function isToolNodeKind(kind: BuilderNodeKind): kind is ToolNodeKind {
  return kind === 'gmail' || kind === 'outlook' || kind === 'slack' || kind === 'hubspot' || kind === 'shopify' || kind === 'googleads' || kind === 'googlecalendar' || kind === 'cal';
}

function isToolNodeData(data: BuilderNodeData): data is ToolNodeData {
  return isToolNodeKind(data.kind);
}

function isKnowledgeNodeData(data: BuilderNodeData): data is KnowledgeBuilderNodeData {
  return data.kind === 'knowledge';
}

function isEndChatNodeData(data: BuilderNodeData): data is EndChatBuilderNodeData {
  return data.kind === 'endchat';
}

function isTriggerNodeData(data: BuilderNodeData): data is TriggerBuilderNodeData {
  return data.kind === 'trigger';
}

function isTextAnnotationNodeData(
  data: BuilderNodeData,
): data is TextAnnotationBuilderNodeData {
  return data.kind === 'annotation';
}

function isBuilderNodeKind(value: unknown): value is BuilderNodeKind {
  return (
    value === 'trigger' ||
    value === 'agent' ||
    value === 'knowledge' ||
    value === 'gmail' ||
    value === 'outlook' ||
    value === 'slack' ||
    value === 'hubspot' ||
    value === 'shopify' ||
    value === 'googleads' ||
    value === 'googlecalendar' ||
    value === 'cal' ||
    value === 'endchat' ||
    value === 'annotation'
  );
}

function buildEdges(nodes: BuilderFlowNode[]): BuilderFlowEdge[] {
  const hasTrigger = nodes.some((node) => node.data.kind === 'trigger');
  const hasAgent = nodes.some((node) => node.data.kind === 'agent');
  const hasKnowledge = nodes.some((node) => node.data.kind === 'knowledge');
  const hasGmail = nodes.some((node) => node.data.kind === 'gmail');
  const hasOutlook = nodes.some((node) => node.data.kind === 'outlook');
  const hasSlack = nodes.some((node) => node.data.kind === 'slack');
  const hasHubSpot = nodes.some((node) => node.data.kind === 'hubspot');
  const hasShopify = nodes.some((node) => node.data.kind === 'shopify');
  const hasGoogleAds = nodes.some((node) => node.data.kind === 'googleads');
  const hasCalendar = nodes.some((node) => node.data.kind === 'googlecalendar');
  const hasCal = nodes.some((node) => node.data.kind === 'cal');
  const hasEndChat = nodes.some((node) => node.data.kind === 'endchat');

  const edges: BuilderFlowEdge[] = [];

  if (hasTrigger && hasAgent) {
    edges.push({
      id: 'e-trigger-agent',
      source: FIXED_NODE_IDS.trigger,
      target: FIXED_NODE_IDS.agent,
      animated: true,
      style: PRIMARY_EDGE_STYLE,
    });
  }

  if (hasAgent && hasKnowledge) {
    edges.push({
      id: 'e-agent-knowledge',
      source: FIXED_NODE_IDS.agent,
      target: 'knowledge',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasAgent && hasGmail) {
    edges.push({
      id: 'e-agent-gmail',
      source: FIXED_NODE_IDS.agent,
      target: 'gmail',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasAgent && hasOutlook) {
    edges.push({
      id: 'e-agent-outlook',
      source: FIXED_NODE_IDS.agent,
      target: 'outlook',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasAgent && hasSlack) {
    edges.push({
      id: 'e-agent-slack',
      source: FIXED_NODE_IDS.agent,
      target: 'slack',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasAgent && hasHubSpot) {
    edges.push({
      id: 'e-agent-hubspot',
      source: FIXED_NODE_IDS.agent,
      target: 'hubspot',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasAgent && hasShopify) {
    edges.push({
      id: 'e-agent-shopify',
      source: FIXED_NODE_IDS.agent,
      target: 'shopify',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasAgent && hasGoogleAds) {
    edges.push({
      id: 'e-agent-googleads',
      source: FIXED_NODE_IDS.agent,
      target: 'googleads',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasAgent && hasCalendar) {
    edges.push({
      id: 'e-agent-googlecalendar',
      source: FIXED_NODE_IDS.agent,
      target: 'googlecalendar',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasAgent && hasCal) {
    edges.push({
      id: 'e-agent-cal',
      source: FIXED_NODE_IDS.agent,
      target: 'cal',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasAgent && hasEndChat) {
    edges.push({
      id: 'e-agent-endchat',
      source: FIXED_NODE_IDS.agent,
      target: 'endchat',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  return edges;
}

function createTriggerNode(
  position = DEFAULT_POSITIONS.trigger,
  data?: Partial<BuilderNodeData>,
): BuilderFlowNode {
  return {
    id: FIXED_NODE_IDS.trigger,
    type: 'agentNode',
    position,
    data: {
      kind: 'trigger',
      label: 'User Message',
      type: 'Trigger',
      icon: 'input',
      description: 'Entry point for the current conversation.',
      status: 'idle',
      locked: true,
      triggerSource: 'user_message',
      provider: 'internal',
      toolkitSlug: null,
      triggerSlug: null,
      connectionId: null,
      triggerConfig: {},
      ...(data ?? {}),
    } as BuilderNodeData,
  };
}

function createAgentCoreNode(
  position = DEFAULT_POSITIONS.agent,
  data?: Partial<BuilderNodeData>,
): BuilderFlowNode {
  return {
    id: FIXED_NODE_IDS.agent,
    type: 'agentNode',
    position,
    data: {
      kind: 'agent',
      label: 'Agent',
      type: 'Core',
      icon: 'smart_toy',
      description: 'Controls the model, instructions, and live response behavior.',
      status: 'active',
      showConfidence: true,
      confidenceValue: 82,
      locked: true,
      ...(data ?? {}),
    } as BuilderNodeData,
  };
}

function createKnowledgeNode(
  position = DEFAULT_POSITIONS.knowledge,
  sourceIds: string[] = [],
  folderIds: string[] = [],
  data?: Partial<BuilderNodeData>,
): BuilderFlowNode {
  return {
    id: 'knowledge',
    type: 'agentNode',
    position,
    data: {
      kind: 'knowledge',
      label: 'Knowledge',
      type: 'Knowledge',
      icon: 'library_books',
      description: 'Retrieves relevant context from attached sources.',
      status: 'idle',
      sourceIds,
      folderIds,
      ...(data ?? {}),
    } as BuilderNodeData,
  };
}

function createGmailNode(
  position = DEFAULT_POSITIONS.gmail,
  connectionId: string | null = null,
  data?: Partial<GmailBuilderNodeData>,
): BuilderFlowNode {
  return {
    id: 'gmail',
    type: 'agentNode',
    position,
    data: {
      kind: 'gmail',
      label: 'Gmail',
      type: 'Tool',
      icon: 'mail',
      simpleIcon: 'siGmail',
      simpleIconColor: '#EA4335',
      description: 'Send emails during the current conversation.',
      status: 'idle',
      integrationSlug: 'gmail',
      connectionId,
      recipientMode: 'ai_decides',
      recipientEmail: null,
      enabledTools: getRecommendedChatToolsForToolkit('gmail'),
      ...(data ?? {}),
    } as BuilderNodeData,
  };
}

function createOutlookNode(
  position = DEFAULT_POSITIONS.outlook,
  connectionId: string | null = null,
  data?: Partial<OutlookBuilderNodeData>,
): BuilderFlowNode {
  return {
    id: 'outlook',
    type: 'agentNode',
    position,
    data: {
      kind: 'outlook',
      label: 'Microsoft Outlook',
      type: 'Tool',
      icon: 'mail',
      simpleIcon: 'siMicrosoftoutlook',
      simpleIconColor: '#0078D4',
      description: 'Send emails during the current conversation via Outlook.',
      status: 'idle',
      integrationSlug: 'outlook',
      connectionId,
      recipientMode: 'ai_decides',
      recipientEmail: null,
      enabledTools: getRecommendedChatToolsForToolkit('outlook'),
      ...(data ?? {}),
    } as BuilderNodeData,
  };
}

function createSlackNode(
  position = DEFAULT_POSITIONS.slack,
  connectionId: string | null = null,
  data?: Partial<SlackBuilderNodeData>,
): BuilderFlowNode {
  return {
    id: 'slack',
    type: 'agentNode',
    position,
    data: {
      kind: 'slack',
      label: 'Slack',
      type: 'Tool',
      icon: 'tag',
      simpleIcon: 'siSlack',
      simpleIconColor: '#4A154B',
      description: 'Send messages and search workspace context in Slack.',
      status: 'idle',
      integrationSlug: 'slack',
      connectionId,
      enabledTools: getRecommendedChatToolsForToolkit('slack'),
      ...(data ?? {}),
    } as BuilderNodeData,
  };
}

function createHubSpotNode(
  position = DEFAULT_POSITIONS.hubspot,
  connectionId: string | null = null,
  data?: Partial<HubSpotBuilderNodeData>,
): BuilderFlowNode {
  return {
    id: 'hubspot',
    type: 'agentNode',
    position,
    data: {
      kind: 'hubspot',
      label: 'HubSpot',
      type: 'Tool',
      icon: 'hub',
      simpleIcon: 'siHubspot',
      simpleIconColor: '#FF7A59',
      description: 'Create, search, and update CRM records in HubSpot.',
      status: 'idle',
      integrationSlug: 'hubspot',
      connectionId,
      enabledTools: getRecommendedChatToolsForToolkit('hubspot'),
      ...(data ?? {}),
    } as BuilderNodeData,
  };
}

function createShopifyNode(
  position = DEFAULT_POSITIONS.shopify,
  connectionId: string | null = null,
  data?: Partial<ShopifyBuilderNodeData>,
): BuilderFlowNode {
  return {
    id: 'shopify',
    type: 'agentNode',
    position,
    data: {
      kind: 'shopify',
      label: 'Shopify',
      type: 'Tool',
      icon: 'shopping_bag',
      simpleIcon: 'siShopify',
      simpleIconColor: '#7AB55C',
      description: 'Read and manage store products, customers, orders, and draft orders in Shopify.',
      status: 'idle',
      integrationSlug: 'shopify',
      connectionId,
      enabledTools: getRecommendedChatToolsForToolkit('shopify'),
      ...(data ?? {}),
    } as BuilderNodeData,
  };
}

function createGoogleAdsNode(
  position = DEFAULT_POSITIONS.googleads,
  connectionId: string | null = null,
  data?: Partial<GoogleAdsBuilderNodeData>,
): BuilderFlowNode {
  return {
    id: 'googleads',
    type: 'agentNode',
    position,
    data: {
      kind: 'googleads',
      label: 'Google Ads',
      type: 'Tool',
      icon: 'ads_click',
      simpleIcon: 'siGoogleads',
      simpleIconColor: '#4285F4',
      description: 'Inspect Google Ads accounts, campaigns, customer lists, and GAQL reports.',
      status: 'idle',
      integrationSlug: 'googleads',
      connectionId,
      enabledTools: getRecommendedChatToolsForToolkit('googleads'),
      ...(data ?? {}),
    } as BuilderNodeData,
  };
}

function createGoogleCalendarNode(
  position = DEFAULT_POSITIONS.googlecalendar,
  connectionId: string | null = null,
  timezone: string | null = null,
  data?: Partial<GoogleCalendarBuilderNodeData>,
): BuilderFlowNode {
  return {
    id: 'googlecalendar',
    type: 'agentNode',
    position,
    data: {
      kind: 'googlecalendar',
      label: 'Google Calendar',
      type: 'Tool',
      icon: 'calendar_month',
      simpleIcon: 'siGooglecalendar',
      simpleIconColor: '#4285F4',
      description: 'Check availability and book meetings.',
      status: 'idle',
      integrationSlug: 'googlecalendar',
      connectionId,
      timezone,
      calendarId: null,
      calendarLabel: null,
      includePrimaryCalendar: false,
      enabledTools: getRecommendedChatToolsForToolkit('googlecalendar'),
      ...(data ?? {}),
    } as BuilderNodeData,
  };
}

function createCalNode(
  position = DEFAULT_POSITIONS.cal,
  connectionId: string | null = null,
  timezone: string | null = null,
  data?: Partial<CalBuilderNodeData>,
): BuilderFlowNode {
  return {
    id: 'cal',
    type: 'agentNode',
    position,
    data: {
      kind: 'cal',
      label: 'Cal.com',
      type: 'Tool',
      icon: 'event_available',
      simpleIcon: 'siCalcom',
      simpleIconColor: '#22C55E',
      description: 'Check availability and book meetings with Cal.com.',
      status: 'idle',
      integrationSlug: 'cal',
      connectionId,
      timezone,
      eventTypeMode: 'ai_decides',
      eventTypeId: null,
      eventTypeLabel: null,
      enabledTools: getRecommendedChatToolsForToolkit('cal'),
      ...(data ?? {}),
    } as BuilderNodeData,
  };
}

function createEndChatNode(
  position = DEFAULT_POSITIONS.endchat,
  data?: Partial<EndChatBuilderNodeData>,
): BuilderFlowNode {
  return {
    id: 'endchat',
    type: 'agentNode',
    position,
    data: {
      kind: 'endchat',
      label: 'End Chat',
      type: 'Control',
      icon: 'stop_circle',
      description: 'Closes the session when end conditions are met.',
      status: 'idle',
      inactivityTimeoutSeconds: DEFAULT_END_CHAT_INACTIVITY_TIMEOUT_SECONDS,
      allowAssistantSuggestion: true,
      ...(data ?? {}),
    } as BuilderNodeData,
  };
}

function createTextAnnotationNode(
  position = DEFAULT_POSITIONS.annotation,
  data?: Partial<TextAnnotationBuilderNodeData>,
  id = `annotation-${crypto.randomUUID()}`,
): BuilderFlowNode {
  return {
    id,
    type: 'agentNode',
    position,
    data: {
      kind: 'annotation',
      label: 'Text annotation',
      type: 'Note',
      icon: 'sticky_note_2',
      description: 'Canvas-only documentation note.',
      status: 'idle',
      text: '',
      ...(data ?? {}),
    },
  };
}

function inferNodeKind(node: BuilderFlowNode) {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const rawKind = data.kind;

  if (isBuilderNodeKind(rawKind)) {
    return rawKind;
  }

  const label = String(data.label ?? '').toLowerCase();
  const type = String(data.type ?? '').toLowerCase();

  if (label === 'user message' || type === 'trigger') {
    return 'trigger';
  }

  if (label === 'agent' || type === 'core') {
    return 'agent';
  }

  if (label === 'knowledge' || type === 'knowledge') {
    return 'knowledge';
  }

  if (label === 'gmail') {
    return 'gmail';
  }

  if (label === 'microsoft outlook' || label === 'outlook') {
    return 'outlook';
  }

  if (label === 'slack') {
    return 'slack';
  }

  if (label === 'hubspot') {
    return 'hubspot';
  }

  if (label === 'shopify') {
    return 'shopify';
  }

  if (label === 'google ads' || label === 'googleads') {
    return 'googleads';
  }

  if (label === 'google calendar') {
    return 'googlecalendar';
  }

  if (label === 'end chat' || type === 'control') {
    return 'endchat';
  }

  if (label === 'connected tools' || type === 'tools' || type === 'tooling') {
    return 'legacy-tools';
  }

  return null;
}

function getToolConnectionsByKind(connections: ConnectionRecord[], kind: ToolNodeKind) {
  return connections
    .filter((connection) => connection.toolkit_slug === kind)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

function pickPreferredConnectionId(
  connections: ConnectionRecord[],
  attachedConnectionIds: string[],
  kind: ToolNodeKind,
  preferredConnectionId?: string | null,
) {
  const allMatching = getToolConnectionsByKind(connections, kind);
  const attachedMatching = allMatching.filter((connection) =>
    attachedConnectionIds.includes(connection.id),
  );

  if (preferredConnectionId) {
    const matched = allMatching.find((connection) => connection.id === preferredConnectionId);
    if (matched) {
      return matched.id;
    }
  }

  return attachedMatching[0]?.id ?? null;
}

function pickEnabledToolsFromNode(kind: ToolNodeKind, node: BuilderFlowNode | undefined) {
  return node && isToolNodeData(node.data)
    ? getEnabledToolNames(kind, node.data)
    : getRecommendedChatToolsForToolkit(kind);
}

function getDefaultNodeForSurface(
  surface: AgentRecord['surface'],
  kind: 'trigger' | 'agent',
) {
  const definition = buildInitialDefinition('custom', surface);
  return ((Array.isArray(definition.nodes) ? definition.nodes : []) as BuilderFlowNode[]).find(
    (node) => node.data.kind === kind,
  );
}

function normalizeDefinition(
  definition: BuilderDefinition,
  surface: AgentRecord['surface'],
  connections: ConnectionRecord[],
  attachedConnectionIds: string[],
  attachedKnowledgeSourceIds: string[],
  attachedKnowledgeFolderIds: string[],
): NormalizedBuilderDefinition {
  const rawNodes = (Array.isArray(definition.nodes) ? definition.nodes : []) as BuilderFlowNode[];
  const nodesByKind = new Map<BuilderNodeKind, BuilderFlowNode>();
  const annotationNodes: BuilderFlowNode[] = [];
  let hasLegacyToolsNode = false;

  for (const node of rawNodes) {
    const inferredKind = inferNodeKind(node);

    if (inferredKind === 'legacy-tools') {
      hasLegacyToolsNode = true;
      continue;
    }

    if (inferredKind === 'annotation') {
      annotationNodes.push(node);
      continue;
    }

    if (!inferredKind || nodesByKind.has(inferredKind)) {
      continue;
    }

    nodesByKind.set(inferredKind, node);
  }

  const knowledgeNode = nodesByKind.get('knowledge');
  const knowledgeSourceIds =
    knowledgeNode && isKnowledgeNodeData(knowledgeNode.data)
      ? knowledgeNode.data.sourceIds
      : attachedKnowledgeSourceIds;
  const knowledgeFolderIds =
    knowledgeNode && isKnowledgeNodeData(knowledgeNode.data)
      ? knowledgeNode.data.folderIds ?? []
      : attachedKnowledgeFolderIds;

  const gmailNode = nodesByKind.get('gmail');
  const outlookNode = nodesByKind.get('outlook');
  const slackNode = nodesByKind.get('slack');
  const hubspotNode = nodesByKind.get('hubspot');
  const shopifyNode = nodesByKind.get('shopify');
  const googleAdsNode = nodesByKind.get('googleads');
  const calendarNode = nodesByKind.get('googlecalendar');
  const calNode = nodesByKind.get('cal');
  const endChatNode = nodesByKind.get('endchat');
  const gmailConnectionId = pickPreferredConnectionId(
    connections,
    attachedConnectionIds,
    'gmail',
    gmailNode && isToolNodeData(gmailNode.data) ? gmailNode.data.connectionId : null,
  );
  const outlookConnectionId = pickPreferredConnectionId(
    connections,
    attachedConnectionIds,
    'outlook',
    outlookNode && isToolNodeData(outlookNode.data) ? outlookNode.data.connectionId : null,
  );
  const slackConnectionId = pickPreferredConnectionId(
    connections,
    attachedConnectionIds,
    'slack',
    slackNode && isToolNodeData(slackNode.data) ? slackNode.data.connectionId : null,
  );
  const hubspotConnectionId = pickPreferredConnectionId(
    connections,
    attachedConnectionIds,
    'hubspot',
    hubspotNode && isToolNodeData(hubspotNode.data) ? hubspotNode.data.connectionId : null,
  );
  const shopifyConnectionId = pickPreferredConnectionId(
    connections,
    attachedConnectionIds,
    'shopify',
    shopifyNode && isToolNodeData(shopifyNode.data) ? shopifyNode.data.connectionId : null,
  );
  const googleAdsConnectionId = pickPreferredConnectionId(
    connections,
    attachedConnectionIds,
    'googleads',
    googleAdsNode && isToolNodeData(googleAdsNode.data) ? googleAdsNode.data.connectionId : null,
  );
  const googleCalendarConnectionId = pickPreferredConnectionId(
    connections,
    attachedConnectionIds,
    'googlecalendar',
    calendarNode && isToolNodeData(calendarNode.data) ? calendarNode.data.connectionId : null,
  );
  const calConnectionId = pickPreferredConnectionId(
    connections,
    attachedConnectionIds,
    'cal',
    calNode && isToolNodeData(calNode.data) ? calNode.data.connectionId : null,
  );
  const persistedTrigger = definition.config?.trigger;
  const legacyAutomationTrigger = definition.config?.automation;
  const triggerDataFromConfig: Partial<TriggerBuilderNodeData> | undefined = persistedTrigger
    ? {
        triggerSource: persistedTrigger.source,
        provider: persistedTrigger.provider,
        toolkitSlug: persistedTrigger.toolkitSlug ?? null,
        triggerSlug: persistedTrigger.triggerSlug ?? null,
        connectionId: persistedTrigger.connectionId ?? null,
        triggerConfig: persistedTrigger.triggerConfig ?? {},
      }
    : legacyAutomationTrigger
      ? {
          triggerSource: 'gmail_new_message',
          provider: 'composio',
          toolkitSlug: 'gmail',
          triggerSlug: legacyAutomationTrigger.triggerSlug,
          connectionId: legacyAutomationTrigger.connectionId,
          triggerConfig: legacyAutomationTrigger.triggerConfig,
        }
      : undefined;

  const normalizedNodes: BuilderFlowNode[] = [];
  const triggerNode = nodesByKind.get('trigger');
  const agentNode = nodesByKind.get('agent');
  const defaultTriggerNode = getDefaultNodeForSurface(surface, 'trigger');
  const defaultAgentNode = getDefaultNodeForSurface(surface, 'agent');

  normalizedNodes.push(
    createTriggerNode(
      triggerNode?.position ?? defaultTriggerNode?.position ?? DEFAULT_POSITIONS.trigger,
      {
        ...((defaultTriggerNode?.data as Partial<TriggerBuilderNodeData> | undefined) ?? {}),
        ...(triggerDataFromConfig ?? {}),
        ...((triggerNode?.data as Partial<TriggerBuilderNodeData> | undefined) ?? {}),
        locked: true,
      } as Partial<BuilderNodeData>,
    ),
  );

  normalizedNodes.push(
    createAgentCoreNode(
      agentNode?.position ?? defaultAgentNode?.position ?? DEFAULT_POSITIONS.agent,
      {
        ...((defaultAgentNode?.data as Partial<BuilderNodeData> | undefined) ?? {}),
        ...((agentNode?.data as Partial<BuilderNodeData> | undefined) ?? {}),
        automationMode: surface === 'automation',
        locked: true,
      } as Partial<BuilderNodeData>,
    ),
  );

  if (knowledgeNode || knowledgeSourceIds.length > 0 || knowledgeFolderIds.length > 0) {
    normalizedNodes.push(
      createKnowledgeNode(
        knowledgeNode?.position ?? DEFAULT_POSITIONS.knowledge,
        knowledgeSourceIds,
        knowledgeFolderIds,
      ),
    );
  }

  if (gmailNode || gmailConnectionId) {
    normalizedNodes.push(
      createGmailNode(
        gmailNode?.position ?? DEFAULT_POSITIONS.gmail,
        gmailConnectionId,
        gmailNode && gmailNode.data.kind === 'gmail'
          ? {
              recipientMode:
                gmailNode.data.recipientMode === 'specific_email'
                  ? 'specific_email'
                  : 'ai_decides',
              recipientEmail:
                typeof gmailNode.data.recipientEmail === 'string'
                  ? gmailNode.data.recipientEmail
                  : null,
              enabledTools: pickEnabledToolsFromNode('gmail', gmailNode),
            }
          : undefined,
      ),
    );
  }

  if (outlookNode || outlookConnectionId) {
    normalizedNodes.push(
      createOutlookNode(
        outlookNode?.position ?? DEFAULT_POSITIONS.outlook,
        outlookConnectionId,
        outlookNode && outlookNode.data.kind === 'outlook'
          ? {
              recipientMode:
                outlookNode.data.recipientMode === 'specific_email'
                  ? 'specific_email'
                  : 'ai_decides',
              recipientEmail:
                typeof outlookNode.data.recipientEmail === 'string'
                  ? outlookNode.data.recipientEmail
                  : null,
              enabledTools: pickEnabledToolsFromNode('outlook', outlookNode),
            }
          : undefined,
      ),
    );
  }

  if (slackNode || slackConnectionId) {
    normalizedNodes.push(
      createSlackNode(
        slackNode?.position ?? DEFAULT_POSITIONS.slack,
        slackConnectionId,
        slackNode && slackNode.data.kind === 'slack'
          ? {
              enabledTools: pickEnabledToolsFromNode('slack', slackNode),
            }
          : undefined,
      ),
    );
  }

  if (hubspotNode || hubspotConnectionId) {
    normalizedNodes.push(
      createHubSpotNode(
        hubspotNode?.position ?? DEFAULT_POSITIONS.hubspot,
        hubspotConnectionId,
        hubspotNode && hubspotNode.data.kind === 'hubspot'
          ? {
              enabledTools: pickEnabledToolsFromNode('hubspot', hubspotNode),
            }
          : undefined,
      ),
    );
  }

  if (shopifyNode || shopifyConnectionId) {
    normalizedNodes.push(
      createShopifyNode(
        shopifyNode?.position ?? DEFAULT_POSITIONS.shopify,
        shopifyConnectionId,
        shopifyNode && shopifyNode.data.kind === 'shopify'
          ? {
              enabledTools: pickEnabledToolsFromNode('shopify', shopifyNode),
            }
          : undefined,
      ),
    );
  }

  if (googleAdsNode || googleAdsConnectionId) {
    normalizedNodes.push(
      createGoogleAdsNode(
        googleAdsNode?.position ?? DEFAULT_POSITIONS.googleads,
        googleAdsConnectionId,
        googleAdsNode && googleAdsNode.data.kind === 'googleads'
          ? {
              enabledTools: pickEnabledToolsFromNode('googleads', googleAdsNode),
            }
          : undefined,
      ),
    );
  }

  if (calendarNode || googleCalendarConnectionId) {
    const calendarTimezone = calendarNode && isToolNodeData(calendarNode.data) 
      ? (calendarNode.data as GoogleCalendarBuilderNodeData).timezone 
      : null;
    normalizedNodes.push(
      createGoogleCalendarNode(
        calendarNode?.position ?? DEFAULT_POSITIONS.googlecalendar,
        googleCalendarConnectionId,
        calendarTimezone,
        calendarNode && calendarNode.data.kind === 'googlecalendar'
          ? {
              timezone:
                typeof calendarNode.data.timezone === 'string'
                  ? calendarNode.data.timezone
                  : null,
              calendarId:
                typeof calendarNode.data.calendarId === 'string'
                  ? calendarNode.data.calendarId
                  : null,
              calendarLabel:
                typeof calendarNode.data.calendarLabel === 'string'
                  ? calendarNode.data.calendarLabel
                  : null,
              includePrimaryCalendar: calendarNode.data.includePrimaryCalendar === true,
              enabledTools: pickEnabledToolsFromNode('googlecalendar', calendarNode),
            }
          : undefined,
      ),
    );
  }

  if (calNode || calConnectionId) {
    const calTimezone = calNode && isToolNodeData(calNode.data) 
      ? (calNode.data as CalBuilderNodeData).timezone 
      : null;
    normalizedNodes.push(
      createCalNode(
        calNode?.position ?? DEFAULT_POSITIONS.cal,
        calConnectionId,
        calTimezone,
        calNode && calNode.data.kind === 'cal'
          ? {
              timezone:
                typeof calNode.data.timezone === 'string'
                  ? calNode.data.timezone
                  : null,
              eventTypeMode:
                calNode.data.eventTypeMode === 'specific_event_type'
                  ? 'specific_event_type'
                  : 'ai_decides',
              eventTypeId:
                typeof calNode.data.eventTypeId === 'string'
                  ? calNode.data.eventTypeId
                  : null,
              eventTypeLabel:
                typeof calNode.data.eventTypeLabel === 'string'
                  ? calNode.data.eventTypeLabel
                  : null,
              enabledTools: pickEnabledToolsFromNode('cal', calNode),
            }
          : undefined,
      ),
    );
  }

  if (surface !== 'automation' && endChatNode && isEndChatNodeData(endChatNode.data)) {
    normalizedNodes.push(
      createEndChatNode(
        endChatNode.position ?? DEFAULT_POSITIONS.endchat,
        {
          inactivityTimeoutSeconds:
            endChatNode.data.inactivityTimeoutSeconds ?? null,
          allowAssistantSuggestion:
            endChatNode.data.allowAssistantSuggestion ?? true,
        },
      ),
    );
  }

  normalizedNodes.push(
    ...annotationNodes.map((node) =>
      createTextAnnotationNode(
        node.position ?? DEFAULT_POSITIONS.annotation,
        {
          text:
            isTextAnnotationNodeData(node.data) && typeof node.data.text === 'string'
              ? node.data.text
              : '',
        },
        node.id,
      ),
    ),
  );

  const requiresToolReview =
    hasLegacyToolsNode &&
    TOOL_NODE_KINDS.some(
      (kind) =>
        getToolConnectionsByKind(
          connections.filter((connection) => attachedConnectionIds.includes(connection.id)),
          kind,
        ).length > 1,
    );

  return {
    nodes: normalizedNodes,
    edges: buildEdges(normalizedNodes),
    requiresToolReview,
  };
}

function enrichNodeForDisplay(
  node: BuilderFlowNode,
  connections: ConnectionRecord[],
  t: Translate,
  isPrimaryMilo: boolean,
): BuilderFlowNode {
  const localizedText = getBuilderNodeText(
    node.data.kind,
    t,
    node.data.kind === 'agent' && node.data.automationMode === true,
  );

  if (isTriggerNodeData(node.data)) {
    const sourceText = getTriggerSourceText(node.data.triggerSource ?? 'user_message', t);
    const providerLabel =
      node.data.provider === 'composio'
        ? t('agentBuilder.triggerProviderComposio')
        : isPrimaryMilo
          ? t('agentBuilder.triggerProviderWebsiteChat')
          : t('agentBuilder.triggerProviderInternal');

    return {
      ...node,
      data: {
        ...node.data,
        ...localizedText,
        label: sourceText.label,
        description: sourceText.description,
        icon: sourceText.icon,
        confidenceLabel: t('agentBuilder.confidence'),
        badgeText: providerLabel,
        badgeTone: node.data.provider === 'composio' ? 'warning' : 'success',
      },
    };
  }

  if (node.data.kind === 'knowledge') {
    const sourceCount = node.data.sourceIds.length;
    const folderCount = (node.data.folderIds ?? []).length;
    const attachedCount = sourceCount + folderCount;

    return {
      ...node,
      data: {
        ...node.data,
        ...localizedText,
        confidenceLabel: t('agentBuilder.confidence'),
        badgeText:
          attachedCount > 0
            ? t('agentBuilder.attachedBadge', { count: attachedCount })
            : t('agentBuilder.noSourcesBadge'),
        badgeTone: attachedCount > 0 ? 'success' : 'warning',
      },
    };
  }

  if (isToolNodeData(node.data)) {
    const selectedConnection = node.data.connectionId
      ? connections.find((connection) => connection.id === node.data.connectionId) ?? null
      : null;

    let badgeText = t('agentBuilder.needsSetup');
    let badgeTone: BuilderNodeData['badgeTone'] = 'warning';

    if (selectedConnection?.status === 'connected') {
      badgeText = selectedConnection.account_label || t('statuses.connection.connected');
      badgeTone = 'success';
    } else if (selectedConnection) {
      badgeText = translateConnectionStatus(selectedConnection.status, t);
      badgeTone = 'error';
    }

    return {
      ...node,
      data: {
        ...node.data,
        ...localizedText,
        confidenceLabel: t('agentBuilder.confidence'),
        badgeText,
        badgeTone,
      },
    };
  }

  if (isEndChatNodeData(node.data)) {
    const timeoutLabel =
      typeof node.data.inactivityTimeoutSeconds === 'number'
        ? t('agentBuilder.timeoutBadge', {
            count: node.data.inactivityTimeoutSeconds,
          })
        : t('agentBuilder.noInactivityTimeout');
    const suggestionLabel = node.data.allowAssistantSuggestion
      ? t('agentBuilder.aiCanSuggestEnd')
      : t('agentBuilder.systemOnlyEnding');

    return {
      ...node,
      data: {
        ...node.data,
        ...localizedText,
        confidenceLabel: t('agentBuilder.confidence'),
        badgeText: `${timeoutLabel} • ${suggestionLabel}`,
        badgeTone: 'success',
      },
    };
  }

  if (isTextAnnotationNodeData(node.data)) {
    return {
      ...node,
      data: {
        ...node.data,
        ...localizedText,
        description: node.data.text.trim() || localizedText.description,
        confidenceLabel: t('agentBuilder.confidence'),
      },
    };
  }

  return {
    ...node,
    data: {
      ...node.data,
      ...localizedText,
      label: node.data.kind === 'agent' && isPrimaryMilo ? 'Milo' : localizedText.label,
      confidenceLabel: t('agentBuilder.confidence'),
      isMiloBrand: node.data.kind === 'agent' && isPrimaryMilo,
    },
  };
}

function getKnowledgeSourceIdsFromNodes(nodes: BuilderFlowNode[]) {
  const knowledgeNode = nodes.find((node) => node.data.kind === 'knowledge');

  if (!knowledgeNode || !isKnowledgeNodeData(knowledgeNode.data)) {
    return [];
  }

  return knowledgeNode.data.sourceIds.filter(Boolean);
}

function getKnowledgeFolderIdsFromNodes(nodes: BuilderFlowNode[]) {
  const knowledgeNode = nodes.find((node) => node.data.kind === 'knowledge');

  if (!knowledgeNode || !isKnowledgeNodeData(knowledgeNode.data)) {
    return [];
  }

  return (knowledgeNode.data.folderIds ?? []).filter(Boolean);
}

function getSelectedConnectionIdsFromNodes(
  nodes: BuilderFlowNode[],
  connections: ConnectionRecord[],
) {
  const connectedConnectionIds = new Set(
    connections
      .filter((connection) => connection.status === 'connected')
      .map((connection) => connection.id),
  );

  return Array.from(
    new Set(
      nodes.flatMap((node) =>
        isToolNodeData(node.data) &&
        node.data.connectionId &&
        connectedConnectionIds.has(node.data.connectionId)
          ? [node.data.connectionId]
          : [],
      ),
    ),
  );
}

/**
 * Returns the single best connection for a given tool kind.
 * Priority: connected > pending > any.
 * We enforce one connection per toolkit per workspace, so this is
 * always the authoritative account.
 */
function getSingleConnection(
  connections: ConnectionRecord[],
  kind: ToolNodeKind,
): ConnectionRecord | null {
  return getSingleToolConnection(connections, kind);
}

/**
 * Read-only "Connected Account" display card used inside tool node panels.
 * Shows the account label / email with a colour-coded status indicator.
 * Replaces the old <select> dropdown — there is now exactly one account per
 * toolkit per workspace.
 */
function ConnectedAccountDisplay({
  connection,
  toolkitLabel,
  isConnecting = false,
  onConnect,
  onFix,
}: {
  connection: ConnectionRecord | null;
  toolkitLabel: string;
  isConnecting?: boolean;
  onConnect?: () => void;
  onFix?: () => void;
}) {
  if (!connection) {
    return (
      <div className="rounded-[2rem] border border-dashed border-outline-variant/20 bg-surface-container-low/50 px-6 py-8 text-center">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant/30 mb-3 block">account_circle</span>
        <p className="text-xs font-medium text-on-surface-variant/60 mb-5">
          No {toolkitLabel} account connected yet.
        </p>
        {onConnect ? (
          <button
            type="button"
            onClick={onConnect}
            disabled={isConnecting}
            className="app-primary-surface inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:cursor-wait disabled:opacity-70"
          >
            <span className={`material-symbols-outlined text-lg ${isConnecting ? 'animate-spin' : ''}`}>
              {isConnecting ? 'sync' : 'link'}
            </span>
            {isConnecting ? 'Opening...' : `Connect ${toolkitLabel}`}
          </button>
        ) : (
          <Link
            href="/connections"
            className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-primary transition-all hover:bg-primary/20 active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">link</span>
            Connect {toolkitLabel}
          </Link>
        )}
      </div>
    );
  }

  const isConnected = connection.status === 'connected';
  const isPending = connection.status === 'pending';

  const dotClass = isConnected
    ? 'bg-success'
    : isPending
      ? 'bg-amber-400'
      : 'bg-error';

  const cardClass = isConnected
    ? 'border-outline-variant/10 bg-surface-container-lowest'
    : isPending
      ? 'border-amber-500/20 bg-amber-500/5'
      : 'border-error/20 bg-error/5';

  const label =
    connection.account_label && connection.account_label !== 'default'
      ? connection.account_label
      : connection.display_name;

  return (
    <div className={`rounded-[1.5rem] border px-5 py-4 ${cardClass}`}>
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
        Connected Account
      </p>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
          <span className="text-sm font-bold text-on-surface truncate">{label}</span>
        </div>
        {!isConnected && onConnect ? (
          <button
            type="button"
            onClick={onConnect}
            disabled={isConnecting}
            className="shrink-0 text-[10px] font-black uppercase tracking-widest text-primary hover:underline disabled:cursor-wait disabled:opacity-60"
          >
            {isConnecting ? 'Opening...' : 'Fix'}
          </button>
        ) : !isConnected ? (
          <Link
            href="/connections"
            onClick={onFix}
            className="shrink-0 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
          >
            Fix →
          </Link>
        ) : null}
      </div>
      {!isConnected && (
        <p className="mt-1 ml-[22px] text-[11px] text-on-surface-variant/60">
          {isPending ? 'Awaiting authorisation' : 'Connection error — reconnect in Connections'}
        </p>
      )}
    </div>
  );
}

/**
 * PromptEditor — full-screen prompt editor with:
 *  - Slash command (/) to insert {{variables}} inline
 *  - Right sidebar to create & preview variables
 */
interface PromptEditorProps {
  instructions: string;
  setInstructions: (value: string) => void;
  isOptimizingPrompt: boolean;
  handleOptimizePrompt: () => void;
  stopBuilderFieldKeyDown: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  name: string;
  t: (key: string) => string;
  onClose: () => void;
}

function PromptEditor({
  instructions,
  setInstructions,
  isOptimizingPrompt,
  handleOptimizePrompt,
  stopBuilderFieldKeyDown,
  name,
  t,
  onClose,
}: PromptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Track the cursor position + scroll offset so sidebar inserts land in the right place
  const lastCursorPos = useRef(0);
  const lastScrollTop = useRef(0);

  // Slash-command state
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashAnchor, setSlashAnchor] = useState(0); // position of '/' character in string
  const [slashIdx, setSlashIdx] = useState(0);

  // Right sidebar: preview values keyed by variable key
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
  const [newVarDraft, setNewVarDraft] = useState('');
  const newVarRef = useRef<HTMLInputElement>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Preview mode: show the prompt with variables replaced by their filled values
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // All {{variables}} detected in the prompt in real-time
  const detectedVars = useMemo(() => parseVariableKeys(instructions), [instructions]);

  // Slash menu filtered options — existing vars matching query + "create new" if query is non-empty
  const slashOptions = useMemo(() => {
    const q = slashQuery.toLowerCase().replace(/\s+/g, '_');
    const filtered = detectedVars.filter((k) => k.includes(q));
    const isNew = q.length > 0 && !detectedVars.includes(q);
    return [...filtered, ...(isNew ? [`__new__:${q}`] : [])];
  }, [detectedVars, slashQuery]);

  /** Insert {{token}} at position pos in the string, removing the `/query` prefix */
  function insertVariableAt(key: string, slashPos: number, queryLen: number) {
    const token = `{{${key}}}`;
    const before = instructions.slice(0, slashPos); // cut before '/'
    const after = instructions.slice(slashPos + 1 + queryLen); // skip /query
    const next = before + token + after;
    setInstructions(next);
    setSlashOpen(false);
    setSlashQuery('');

    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const pos = slashPos + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  /** Insert {{token}} at the saved cursor position (used from sidebar — textarea may not be focused) */
  function insertAtCursor(key: string) {
    const el = textareaRef.current;
    // Use the saved position; fall back to end of string if nothing was ever tracked
    const pos = lastCursorPos.current;
    const savedScroll = lastScrollTop.current;
    const token = `{{${key}}}`;
    const next = instructions.slice(0, pos) + token + instructions.slice(pos);
    setInstructions(next);
    // After React re-renders, restore scroll and move cursor to just after the token
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const newPos = pos + token.length;
      el.setSelectionRange(newPos, newPos);
      // Restore scroll so the view doesn't jump to the insertion point
      el.scrollTop = savedScroll;
      // Update tracking refs to the new cursor position
      lastCursorPos.current = newPos;
    });
  }

  /** Handle textarea keydown — detect '/' to open slash menu */
  function handleTextareaKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (slashOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIdx((i) => (i + 1) % Math.max(slashOptions.length, 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIdx((i) => (i - 1 + Math.max(slashOptions.length, 1)) % Math.max(slashOptions.length, 1));
        return;
      }
      if (e.key === 'Enter' && slashOptions.length > 0) {
        e.preventDefault();
        const raw = slashOptions[slashIdx] ?? slashOptions[0];
        const key = raw.startsWith('__new__:') ? raw.slice(8) : raw;
        insertVariableAt(key, slashAnchor, slashQuery.length);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSlashOpen(false);
        setSlashQuery('');
        return;
      }
      if (e.key === 'Backspace' && slashQuery.length === 0) {
        setSlashOpen(false);
        setSlashQuery('');
      }
    }

    if (e.key === 'Escape' && !slashOpen && !isOptimizingPrompt) {
      onClose();
    }

    // Detect '/' to open the slash command menu
    if (e.key === '/' && !slashOpen && !isOptimizingPrompt) {
      const el = textareaRef.current;
      if (el) {
        // Use setTimeout so the '/' is written first, then we anchor after it
        setTimeout(() => {
          setSlashAnchor(el.selectionStart - 1);
          setSlashQuery('');
          setSlashIdx(0);
          setSlashOpen(true);
        }, 0);
      }
    }

    stopBuilderFieldKeyDown(e);
  }

  /** Handle textarea onChange — update slash query if menu is open */
  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInstructions(val);

    if (slashOpen) {
      // Grab everything the user typed after the '/'
      const afterSlash = val.slice(slashAnchor + 1, e.target.selectionStart);

      // Only close if the cursor moved back behind the '/' (e.g. user deleted it)
      if (e.target.selectionStart <= slashAnchor) {
        setSlashOpen(false);
        setSlashQuery('');
      } else {
        // Keep the raw query including spaces — normalisation to _ happens in slashOptions
        setSlashQuery(afterSlash);
        setSlashIdx(0);
      }
    }
  }


  /** Create a new variable from sidebar draft and insert it */
  function handleCreateVar() {
    const key = newVarDraft.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!key) return;
    insertAtCursor(key);
    setNewVarDraft('');
  }

  /** Count how many variables have been filled in */
  const filledCount = useMemo(
    () => detectedVars.filter((k) => (previewValues[k] ?? '').trim().length > 0).length,
    [detectedVars, previewValues],
  );

  /** Build the highlighted overlay text — renders variable tokens as styled chips */
  const overlayContent = useMemo(() => {
    if (!instructions) return null;
    const TOKEN_RE = /\{\{([a-z][a-z0-9_]*)\}\}/gi;
    const parts: { type: 'text' | 'var'; value: string; key?: string }[] = [];
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(instructions)) !== null) {
      if (m.index > lastIdx) {
        parts.push({ type: 'text', value: instructions.slice(lastIdx, m.index) });
      }
      parts.push({ type: 'var', value: m[0], key: m[1].toLowerCase() });
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < instructions.length) {
      parts.push({ type: 'text', value: instructions.slice(lastIdx) });
    }
    return parts;
  }, [instructions]);

  /** Sync overlay scroll with textarea scroll */
  function handleEditorScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    lastScrollTop.current = e.currentTarget.scrollTop;
    if (overlayRef.current) {
      overlayRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: 'var(--color-surface)', animation: 'peIn 0.2s ease both' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        @keyframes peIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slashIn { from { opacity:0; transform:translateY(6px) scale(0.97) } to { opacity:1; transform:none } }
        @keyframes sideIn { from { opacity:0; transform:translateX(12px) } to { opacity:1; transform:none } }
        @keyframes varChipPulse { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb,var(--color-primary) 20%,transparent); } 50% { box-shadow: 0 0 0 4px color-mix(in srgb,var(--color-primary) 0%,transparent); } }
        @keyframes filledPop { from { transform: scale(0.92); opacity: 0.6; } to { transform: scale(1); opacity: 1; } }
        .pe-textarea {
          font-family: 'Inter', -apple-system, sans-serif;
          font-size: 1.05rem; line-height: 1.9;
          letter-spacing: 0.012em; font-weight: 400;
          caret-color: var(--color-primary);
          -webkit-font-smoothing: antialiased;
        }
        .pe-textarea::placeholder { font-style: italic; opacity: 0.25; }
        .pe-textarea:focus { outline: none; }
        .pe-textarea::-webkit-scrollbar { display: none; }
        .pe-overlay {
          font-family: 'Inter', -apple-system, sans-serif;
          font-size: 1.05rem; line-height: 1.9;
          letter-spacing: 0.012em; font-weight: 400;
          -webkit-font-smoothing: antialiased;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .pe-var-chip {
          display: inline;
          position: relative;
          border-radius: 6px;
          padding: 1px 6px;
          font-weight: 600;
          font-size: 0.95rem;
          pointer-events: auto;
          cursor: default;
          transition: all 0.2s ease;
        }
        .pe-var-chip--empty {
          background: color-mix(in srgb,var(--color-primary) 12%,transparent);
          color: transparent;
          border: 1.5px dashed color-mix(in srgb,var(--color-primary) 35%,transparent);
        }
        .pe-var-chip--filled {
          background: color-mix(in srgb,var(--color-primary) 15%,transparent);
          color: transparent;
          border: 1.5px solid color-mix(in srgb,var(--color-primary) 30%,transparent);
          animation: filledPop 0.2s ease both;
        }
        /* Tooltip on hover — shows the filled preview value */
        .pe-var-chip[data-preview]::after {
          content: attr(data-preview);
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%) translateY(4px);
          opacity: 0;
          pointer-events: none;
          background: var(--color-surface-container-high, var(--color-surface-container));
          color: var(--color-primary);
          padding: 6px 14px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
          white-space: nowrap;
          max-width: 280px;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: 0.01em;
          box-shadow: 0 8px 24px -4px rgba(0,0,0,0.18), 0 2px 8px -2px rgba(0,0,0,0.1);
          border: 1px solid color-mix(in srgb,var(--color-primary) 20%,transparent);
          transition: opacity 0.18s cubic-bezier(0.16,1,0.3,1), transform 0.18s cubic-bezier(0.16,1,0.3,1);
          z-index: 50;
        }
        .pe-var-chip[data-preview]::before {
          content: '';
          position: absolute;
          bottom: calc(100% + 2px);
          left: 50%;
          transform: translateX(-50%) translateY(4px);
          opacity: 0;
          pointer-events: none;
          width: 8px;
          height: 8px;
          background: var(--color-surface-container-high, var(--color-surface-container));
          border-right: 1px solid color-mix(in srgb,var(--color-primary) 20%,transparent);
          border-bottom: 1px solid color-mix(in srgb,var(--color-primary) 20%,transparent);
          rotate: 45deg;
          transition: opacity 0.18s cubic-bezier(0.16,1,0.3,1), transform 0.18s cubic-bezier(0.16,1,0.3,1);
          z-index: 50;
        }
        .pe-var-chip[data-preview]:hover::after {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        .pe-var-chip[data-preview]:hover::before {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        .pe-var-chip:hover {
          filter: brightness(1.08);
        }
        .pe-preview-text {
          font-family: 'Inter', -apple-system, sans-serif;
          font-size: 1.05rem; line-height: 1.9;
          letter-spacing: 0.012em; font-weight: 400;
          -webkit-font-smoothing: antialiased;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .pe-preview-replaced {
          background: color-mix(in srgb,var(--color-primary) 12%,transparent);
          color: var(--color-primary);
          font-weight: 600;
          border-radius: 4px;
          padding: 1px 4px;
          border-bottom: 2px solid color-mix(in srgb,var(--color-primary) 40%,transparent);
        }
      `}</style>

      {/* ─── Top bar ─── */}
      <header
        className="flex shrink-0 items-center justify-between px-6 py-3.5"
        style={{ borderBottom: '1px solid color-mix(in srgb,var(--color-on-surface) 7%,transparent)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={isOptimizingPrompt}
            className="group flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold text-on-surface-variant/60 transition-colors hover:text-on-surface active:scale-95 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[15px] transition-transform group-hover:-translate-x-0.5">arrow_back</span>
            Back
          </button>
          <span className="h-4 w-px opacity-10" style={{ background: 'currentColor' }} />
          <span className="text-[11px] font-medium text-on-surface-variant/40">
            {name ? `${name} — ` : ''}{t('agentBuilder.operationalInstructions')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="mr-1 text-[10px] tabular-nums text-on-surface-variant/25">
            {instructions.trim().split(/\s+/).filter(Boolean).length}w
          </span>
          {/* Preview mode toggle — only show if there are variables detected */}
          {detectedVars.length > 0 && (
            <button
              onClick={() => setIsPreviewMode((p) => !p)}
              disabled={isOptimizingPrompt}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                isPreviewMode
                  ? 'text-on-surface'
                  : 'text-on-surface-variant/60 hover:text-on-surface'
              }`}
              style={{
                background: isPreviewMode
                  ? 'color-mix(in srgb,var(--color-primary) 18%,transparent)'
                  : 'color-mix(in srgb,var(--color-on-surface) 6%,transparent)',
                color: isPreviewMode ? 'var(--color-primary)' : undefined,
              }}
              title={isPreviewMode ? 'Back to editing' : 'Preview with variable values'}
            >
              <span className="material-symbols-outlined text-[14px]">
                {isPreviewMode ? 'edit' : 'visibility'}
              </span>
              {isPreviewMode ? 'Edit' : 'Preview'}
            </button>
          )}
          <button
            onClick={handleOptimizePrompt}
            disabled={isOptimizingPrompt}
            className="flex h-8 items-center gap-2 rounded-full px-4 text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'color-mix(in srgb,var(--color-primary) 12%,transparent)', color: 'var(--color-primary)' }}
          >
            <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
            {t('agentBuilder.optimizePrompt')}
          </button>
          <button
            onClick={onClose}
            disabled={isOptimizingPrompt}
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant/40 transition-colors hover:text-on-surface active:scale-95 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </header>

      {/* ─── Body: editor + sidebar ─── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Writing area */}
        <div className="relative flex min-h-0 flex-1 overflow-y-auto">
          {/* Preview mode — read-only rendered view with variables replaced */}
          {isPreviewMode ? (
            <div
              className="pe-preview-text block w-full flex-1 text-on-surface px-12 py-10 md:px-20 lg:px-32 xl:px-48 overflow-y-auto"
              style={{ minHeight: 'calc(100vh - 120px)' }}
            >
              {overlayContent?.map((part, i) => {
                if (part.type === 'text') {
                  return <span key={i}>{part.value}</span>;
                }
                const filled = part.key ? (previewValues[part.key] ?? '').trim() : '';
                return (
                  <span
                    key={i}
                    className="pe-preview-replaced"
                    title={part.value}
                  >
                    {filled || part.value}
                  </span>
                );
              })}
            </div>
          ) : (
            <>
              {/* Highlight overlay — sits above the textarea; text is invisible so you see
                  the textarea text underneath, but variable chips are visible and hoverable
                  to show their preview value as a tooltip */}
              {detectedVars.length > 0 && (
                <div
                  ref={overlayRef}
                  aria-hidden
                  className="pe-overlay pointer-events-none absolute inset-0 z-[3] text-transparent px-12 py-10 md:px-20 lg:px-32 xl:px-48 overflow-hidden"
                  style={{ minHeight: 'calc(100vh - 120px)' }}
                >
                  {overlayContent?.map((part, i) => {
                    if (part.type === 'text') {
                      return <span key={i}>{part.value}</span>;
                    }
                    const filled = part.key ? (previewValues[part.key] ?? '').trim() : '';
                    return (
                      <span
                        key={i}
                        className={`pe-var-chip ${filled ? 'pe-var-chip--filled' : 'pe-var-chip--empty'}`}
                        {...(filled ? { 'data-preview': filled } : {})}
                      >
                        {part.value}
                      </span>
                    );
                  })}
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={instructions}
                onChange={handleTextareaChange}
                onKeyDown={handleTextareaKeyDown}
                // Track cursor position + scroll so sidebar inserts always land in the right spot
                onSelect={(e) => {
                  lastCursorPos.current = e.currentTarget.selectionStart;
                }}
                onMouseUp={(e) => {
                  lastCursorPos.current = e.currentTarget.selectionStart;
                }}
                onBlur={(e) => {
                  // Save both cursor and scroll before focus leaves
                  lastCursorPos.current = e.currentTarget.selectionStart;
                  lastScrollTop.current = e.currentTarget.scrollTop;
                }}
                onScroll={handleEditorScroll}
                disabled={isOptimizingPrompt}
                placeholder={"Start writing your agent's instructions…\n\nTip: type  /  to insert a variable like {{company_name}}"}
                className={`pe-textarea relative z-[2] block w-full flex-1 resize-none border-0 bg-transparent text-on-surface transition-opacity px-12 py-10 md:px-20 lg:px-32 xl:px-48 ${
                  isOptimizingPrompt ? 'opacity-20 pointer-events-none cursor-not-allowed' : 'opacity-100'
                }`}
                style={{ minHeight: 'calc(100vh - 120px)', display: 'block' }}
                autoFocus
                spellCheck
              />
            </>
          )}

          {/* Slash menu — floats near the bottom of the textarea */}
          {slashOpen && (
            <div
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 w-72 overflow-hidden rounded-2xl shadow-2xl"
              style={{
                background: 'var(--color-surface-container)',
                border: '1px solid color-mix(in srgb,var(--color-outline-variant) 25%,transparent)',
                animation: 'slashIn 0.16s cubic-bezier(0.16,1,0.3,1) both',
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid color-mix(in srgb,var(--color-outline-variant) 12%,transparent)' }}>

                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">
                  Insert variable
                </span>
                {slashQuery && (
                  <span className="ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary" style={{ background: 'color-mix(in srgb,var(--color-primary) 10%,transparent)' }}>
                    /{slashQuery.toLowerCase().replace(/\s+/g, '_')}
                  </span>
                )}
              </div>

              {/* Options */}
              <div className="py-1.5 max-h-52 overflow-y-auto">
                {slashOptions.length === 0 && (
                  <p className="px-4 py-3 text-[12px] text-on-surface-variant/40 italic">
                    Type a name to create a new variable…
                  </p>
                )}
                {slashOptions.map((opt, i) => {
                  const isNew = opt.startsWith('__new__:');
                  const key = isNew ? opt.slice(8) : opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => insertVariableAt(key, slashAnchor, slashQuery.length)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i === slashIdx
                          ? 'bg-primary/10 text-on-surface'
                          : 'text-on-surface-variant/80 hover:bg-surface-container-low'
                      }`}
                    >
                      {isNew && (
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[11px]"
                          style={{ background: 'color-mix(in srgb,var(--color-secondary) 12%,transparent)', color: 'var(--color-secondary)' }}
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold truncate">
                          {isNew ? `Create "{{${key}}}"` : `{{${key}}}`}
                        </p>
                        <p className="text-[10px] text-on-surface-variant/45">
                          {isNew ? 'New variable' : 'Insert existing'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 px-4 py-2" style={{ borderTop: '1px solid color-mix(in srgb,var(--color-outline-variant) 10%,transparent)' }}>
                <span className="text-[10px] text-on-surface-variant/35">
                  <kbd className="rounded px-1 py-0.5 text-[9px] font-bold" style={{ background: 'color-mix(in srgb,var(--color-on-surface) 8%,transparent)' }}>↑↓</kbd> navigate
                </span>
                <span className="text-[10px] text-on-surface-variant/35">
                  <kbd className="rounded px-1 py-0.5 text-[9px] font-bold" style={{ background: 'color-mix(in srgb,var(--color-on-surface) 8%,transparent)' }}>Enter</kbd> insert
                </span>
                <span className="text-[10px] text-on-surface-variant/35">
                  <kbd className="rounded px-1 py-0.5 text-[9px] font-bold" style={{ background: 'color-mix(in srgb,var(--color-on-surface) 8%,transparent)' }}>Esc</kbd> close
                </span>
              </div>
            </div>
          )}

          {/* Optimizing overlay */}
          {isOptimizingPrompt && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative">
                <div className="h-11 w-11 animate-spin rounded-full border-2 border-primary/15 border-t-primary" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm text-primary">auto_fix_high</span>
                </div>
              </div>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.35em] text-primary/60 animate-pulse">
                {t('agentBuilder.optimizing')}
              </p>
            </div>
          )}
        </div>

        {/* ─── Right sidebar: Variables ─── */}
        <aside
          className="flex shrink-0 flex-col overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            width: sidebarCollapsed ? '40px' : '19rem',
            borderLeft: '1px solid color-mix(in srgb,var(--color-on-surface) 7%,transparent)',
            animation: 'sideIn 0.25s cubic-bezier(0.16,1,0.3,1) 0.05s both',
          }}
        >
          {/* Sidebar header */}
          <div
            className="flex shrink-0 items-center px-3 py-4"
            style={{ borderBottom: '1px solid color-mix(in srgb,var(--color-on-surface) 7%,transparent)', justifyContent: sidebarCollapsed ? 'center' : 'space-between' }}
          >
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="material-symbols-outlined text-[14px] text-primary/60">data_object</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 whitespace-nowrap">
                  Variables
                </span>
                {detectedVars.length > 0 && (
                  <span
                    className="flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-black"
                    style={{
                      background: filledCount === detectedVars.length && detectedVars.length > 0
                        ? 'color-mix(in srgb,#22c55e 15%,transparent)'
                        : 'color-mix(in srgb,var(--color-primary) 15%,transparent)',
                      color: filledCount === detectedVars.length && detectedVars.length > 0
                        ? '#22c55e'
                        : 'var(--color-primary)',
                    }}
                  >
                    {filledCount === detectedVars.length && detectedVars.length > 0 && (
                      <span className="material-symbols-outlined text-[11px]">check</span>
                    )}
                    {filledCount}/{detectedVars.length}
                  </span>
                )}
              </div>
            )}

            {/* Collapse / expand toggle */}
            <button
              onClick={() => setSidebarCollapsed((c) => !c)}
              title={sidebarCollapsed ? 'Expand variables panel' : 'Collapse variables panel'}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-on-surface-variant/40 transition-all hover:bg-surface-container hover:text-on-surface active:scale-90"
            >
              <span className="material-symbols-outlined text-[16px]">
                {sidebarCollapsed ? 'chevron_left' : 'chevron_right'}
              </span>
            </button>
          </div>

          {/* Collapsed state: show variable count badge vertically */}
          {sidebarCollapsed && (
            <div className="flex flex-1 flex-col items-center gap-3 pt-4">
              <span className="material-symbols-outlined text-[16px] text-primary/40">data_object</span>
              {detectedVars.length > 0 && (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black"
                  style={{
                    background: filledCount === detectedVars.length
                      ? 'color-mix(in srgb,#22c55e 15%,transparent)'
                      : 'color-mix(in srgb,var(--color-primary) 15%,transparent)',
                    color: filledCount === detectedVars.length ? '#22c55e' : 'var(--color-primary)',
                  }}
                >
                  {detectedVars.length}
                </span>
              )}
            </div>
          )}

          {!sidebarCollapsed && (
            <>
              {/* Variable list */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
                {detectedVars.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 rounded-2xl px-4 py-10 text-center" style={{ border: '1px dashed color-mix(in srgb,var(--color-outline-variant) 20%,transparent)' }}>
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{ background: 'color-mix(in srgb,var(--color-primary) 8%,transparent)' }}
                    >
                      <span className="material-symbols-outlined text-xl text-primary/40">data_object</span>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-on-surface-variant/50">No variables yet</p>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-on-surface-variant/35">
                        Type <kbd className="rounded px-1 py-0.5 text-[10px] font-bold" style={{ background: 'color-mix(in srgb,var(--color-on-surface) 8%,transparent)' }}>/</kbd> in the editor to insert one, or create one below
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Hint text when some are unfilled */}
                    {filledCount < detectedVars.length && (
                      <p className="mb-1 text-[10px] leading-relaxed text-on-surface-variant/40 px-1">
                        Fill in values below to see them in the <button onClick={() => setIsPreviewMode(true)} className="font-bold text-primary/70 hover:text-primary underline decoration-primary/30 underline-offset-2 transition-colors">preview</button>.
                      </p>
                    )}
                    {detectedVars.map((key) => {
                      const val = (previewValues[key] ?? '').trim();
                      const isFilled = val.length > 0;
                      return (
                        <div
                          key={key}
                          className="group rounded-2xl p-3.5 transition-all duration-200"
                          style={{
                            background: isFilled
                              ? 'color-mix(in srgb,var(--color-primary) 4%,transparent)'
                              : 'color-mix(in srgb,var(--color-on-surface) 3%,transparent)',
                            border: isFilled
                              ? '1px solid color-mix(in srgb,var(--color-primary) 18%,transparent)'
                              : '1px solid color-mix(in srgb,var(--color-outline-variant) 10%,transparent)',
                          }}
                        >
                          {/* Variable name badge + status */}
                          <div className="mb-2.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold truncate"
                                style={{
                                  background: 'color-mix(in srgb,var(--color-primary) 10%,transparent)',
                                  color: 'var(--color-primary)',
                                }}
                              >
                                <span className="material-symbols-outlined text-[11px]">data_object</span>
                                {key}
                              </span>
                              {/* Filled indicator */}
                              {isFilled && (
                                <span
                                  className="flex h-4 w-4 items-center justify-center rounded-full"
                                  style={{ background: 'color-mix(in srgb,#22c55e 18%,transparent)' }}
                                  title="Value set"
                                >
                                  <span className="material-symbols-outlined text-[10px]" style={{ color: '#22c55e' }}>check</span>
                                </span>
                              )}
                            </div>
                            {/* Insert at cursor button */}
                            <button
                              onClick={() => { setIsPreviewMode(false); insertAtCursor(key); }}
                              title="Insert at cursor"
                              className="opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-lg text-on-surface-variant/50 transition-all hover:text-primary active:scale-90"
                              style={{ background: 'color-mix(in srgb,var(--color-on-surface) 6%,transparent)' }}
                            >
                              <span className="material-symbols-outlined text-[12px]">add_circle</span>
                            </button>
                          </div>

                          {/* Fill-in value input with inline label */}
                          <div className="relative">
                            <input
                              type="text"
                              value={previewValues[key] ?? ''}
                              onChange={(e) => setPreviewValues((prev) => ({ ...prev, [key]: e.target.value }))}
                              placeholder={`Enter value for ${key.split('_').join(' ')}…`}
                              className={`w-full rounded-xl border bg-surface-container-lowest px-3 py-2.5 text-[12px] font-medium text-on-surface outline-none transition-all placeholder:text-on-surface-variant/25 focus:ring-2 focus:ring-primary/10 ${
                                isFilled
                                  ? 'border-primary/25 focus:border-primary/45'
                                  : 'border-outline-variant/10 focus:border-primary/40'
                              }`}
                            />
                            {/* Clear button when filled */}
                            {isFilled && (
                              <button
                                onClick={() => setPreviewValues((prev) => ({ ...prev, [key]: '' }))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-on-surface-variant/30 transition-all hover:text-on-surface-variant/60 active:scale-90"
                                title="Clear value"
                              >
                                <span className="material-symbols-outlined text-[12px]">close</span>
                              </button>
                            )}
                          </div>

                          {/* Show preview of what it resolves to */}
                          {isFilled && (
                            <p className="mt-2 px-1 text-[10px] text-on-surface-variant/45 truncate">
                              <span className="font-semibold text-on-surface-variant/55">Resolves to:</span>{' '}
                              <span className="text-primary/70 font-medium">&ldquo;{val}&rdquo;</span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Create new variable */}
              <div className="shrink-0 px-4 py-4" style={{ borderTop: '1px solid color-mix(in srgb,var(--color-on-surface) 7%,transparent)' }}>
                <label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/40">
                  Create variable
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={newVarRef}
                    type="text"
                    value={newVarDraft}
                    onChange={(e) => setNewVarDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleCreateVar(); }
                      if (e.key === 'Escape') setNewVarDraft('');
                    }}
                    placeholder="company_name"
                    className="flex-1 rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-3 py-2.5 text-[12px] font-medium text-on-surface outline-none transition-all placeholder:text-on-surface-variant/25 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                  <button
                    onClick={handleCreateVar}
                    disabled={!newVarDraft.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all active:scale-90 disabled:opacity-30"
                    style={{ background: 'color-mix(in srgb,var(--color-primary) 15%,transparent)', color: 'var(--color-primary)' }}
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                  </button>
                </div>
                <p className="mt-2.5 text-[10px] leading-relaxed text-on-surface-variant/35">
                  Or type <kbd className="rounded px-1 py-0.5 text-[9px] font-bold" style={{ background: 'color-mix(in srgb,var(--color-on-surface) 8%,transparent)' }}>/</kbd> anywhere in the editor
                </p>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function AgentBuilderClient() {
  const [supabase] = useState(() => createClient());
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { membership, user, workspace, subscription } = useAppContext();
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const agentId = params.id;
  const isPrimaryMilo =
    process.env.NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED !== 'false' &&
    workspace.product_experience === 'milo' &&
    workspace.primary_customer_agent_id === agentId;
  const builderBootstrapUrl = `/api/agents/${agentId}/builder`;
  const {
    data: builderBootstrap,
    error: builderBootstrapError,
    mutate: mutateBuilderBootstrap,
  } = useSWR<AgentBuilderBootstrapResponse>(
    workspaceSWRKey(user.id, workspace.id, builderBootstrapUrl),
    jsonFetcher,
  );
  const automationHealthUrl =
    builderBootstrap?.agent.surface === 'automation'
      ? `/api/agents/${agentId}/automation`
      : null;
  const {
    data: automationHealthPayload,
    mutate: mutateAutomationHealth,
  } = useSWR<{
    providerTriggerHealth: ComposioTriggerHealth | null;
    providerTriggerHealthError: string | null;
  }>(
    workspaceSWRKey(user.id, workspace.id, automationHealthUrl),
    jsonFetcher,
    { refreshInterval: 60_000 },
  );
  const hydratedAgentIdRef = useRef<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BuilderFlowEdge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowInstance, setFlowInstance] =
    useState<ReactFlowInstance<BuilderFlowNode, BuilderFlowEdge> | null>(null);
  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [draftVersion, setDraftVersion] = useState(1);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSourceRecord[]>([]);
  const [knowledgeFolders, setKnowledgeFolders] = useState<KnowledgeFolderWithSources[]>([]);
  const [versions, setVersions] = useState<AgentVersionRecord[]>([]);
  const [automationRecord, setAutomationRecord] = useState<AgentAutomationRecord | null>(null);
  const [automationEvents, setAutomationEvents] = useState<AutomationEventRecord[]>([]);
  const [automationRuns, setAutomationRuns] = useState<RunRecord[]>([]);
  const [automationProviderHealth, setAutomationProviderHealth] =
    useState<ComposioTriggerHealth | null>(null);
  const [automationEnvironment, setAutomationEnvironment] =
    useState<AutomationEnvironmentStatus | null>(null);
  const [calendarOptionsByConnectionId, setCalendarOptionsByConnectionId] = useState<
    Record<string, GoogleCalendarListItem[]>
  >({});
  const [calendarOptionsStatusByConnectionId, setCalendarOptionsStatusByConnectionId] = useState<
    Record<string, 'idle' | 'loading' | 'ready' | 'error'>
  >({});
  const calendarOptionsStatusRef = useRef<Record<string, 'idle' | 'loading' | 'ready' | 'error'>>(
    {},
  );
  const [calEventTypesByConnectionId, setCalEventTypesByConnectionId] = useState<
    Record<string, CalEventTypeListItem[]>
  >({});
  const [calEventTypesStatusByConnectionId, setCalEventTypesStatusByConnectionId] = useState<
    Record<string, 'idle' | 'loading' | 'ready' | 'error'>
  >({});
  const calEventTypesStatusRef = useRef<Record<string, 'idle' | 'loading' | 'ready' | 'error'>>(
    {},
  );
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
  const [model, setModel] = useState(OPENROUTER_DEFAULT_AGENT_MODEL);
  const [modelSections, setModelSections] = useState<OpenRouterModelSection[]>(
    getFallbackOpenRouterModelSections,
  );
  const [isModelCatalogLoading, setIsModelCatalogLoading] = useState(true);
  const [modelCatalogSource, setModelCatalogSource] = useState<'openrouter' | 'fallback' | null>(
    null,
  );
  const [timezone, setTimezone] = useState('UTC');
  const [starterPromptFields, setStarterPromptFields] = useState<string[]>(['', '', '']);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSubmittingLibrary, setIsSubmittingLibrary] = useState(false);
  const [automationStatusAction, setAutomationStatusAction] =
    useState<'activate' | 'pause' | null>(null);
  const [isRollingBackVersionId, setIsRollingBackVersionId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<BuilderStatusNote>({ kind: 'draftInitial' });
  const [isToolPickerOpen, setIsToolPickerOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [connectingToolKind, setConnectingToolKind] = useState<ToolNodeKind | null>(null);
  const [pendingToolConnectionKind, setPendingToolConnectionKind] = useState<ToolNodeKind | null>(null);
  const [shouldClearExternalTrigger, setShouldClearExternalTrigger] = useState(false);
  const [actionEditorNodeId, setActionEditorNodeId] = useState<string | null>(null);
  const [actionSearchQuery, setActionSearchQuery] = useState('');
  const [activeActionDescription, setActiveActionDescription] = useState<string | null>(null);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const [toolkitActionsBySlug, setToolkitActionsBySlug] = useState<
    Record<string, ToolkitActionOption[]>
  >({});
  const [toolkitActionsStatusBySlug, setToolkitActionsStatusBySlug] = useState<
    Record<string, 'idle' | 'loading' | 'ready' | 'error'>
  >({});
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [pastStates, setPastStates] = useState<{ nodes: BuilderFlowNode[]; edges: BuilderFlowEdge[] }[]>([]);
  const [futureStates, setFutureStates] = useState<{ nodes: BuilderFlowNode[]; edges: BuilderFlowEdge[] }[]>([]);

  // --- Autosave state ---
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedSnapshotRef = useRef<string>('');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutosavingRef = useRef(false);
  const AUTOSAVE_DEBOUNCE_MS = 30_000;

  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;
  const resolveCalendarOption = useCallback(
    (items: GoogleCalendarListItem[], calendarId: string | null) => {
      if (calendarId) {
        return items.find((calendar) => calendar.id === calendarId) ?? null;
      }

      return items.find((calendar) => calendar.primary) ?? null;
    },
    [],
  );
  const stopBuilderFieldKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const legacyModelOption = useMemo(() => {
    if (!model || getOpenRouterModelOptionById(modelSections, model)) {
      return null;
    }

    return createLegacyOpenRouterModelOption(model);
  }, [model, modelSections]);

  const updateNode = useCallback(
    (nodeId: string, updater: (node: BuilderFlowNode) => BuilderFlowNode) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.id === nodeId ? updater(node) : node)),
      );
    },
    [setNodes],
  );

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          { ...params, style: DEFAULT_EDGE_STYLE } as unknown as BuilderFlowEdge,
          eds,
        ),
      ),
    [setEdges],
  );

  const updateGoogleCalendarSettings = useCallback(
    (
      nodeId: string,
      updates: Partial<
        Pick<
          GoogleCalendarBuilderNodeData,
          'timezone' | 'calendarId' | 'calendarLabel' | 'includePrimaryCalendar'
        >
      >,
    ) => {
      updateNode(nodeId, (node) => {
        if (node.data.kind !== 'googlecalendar') {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            ...updates,
          },
        };
      });
    },
    [updateNode],
  );

  const saveToHistory = useCallback(() => {
    setPastStates((prev) => [...prev.slice(-19), { nodes: [...nodes], edges: [...edges] }]);
    setFutureStates([]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (pastStates.length === 0) return;
    const previous = pastStates[pastStates.length - 1];
    setFutureStates((prev) => [{ nodes: [...nodes], edges: [...edges] }, ...prev]);
    setPastStates((prev) => prev.slice(0, -1));
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [pastStates, nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (futureStates.length === 0) return;
    const next = futureStates[0];
    setPastStates((prev) => [...prev, { nodes: [...nodes], edges: [...edges] }]);
    setFutureStates((prev) => prev.slice(1));
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [futureStates, nodes, edges, setNodes, setEdges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const nodeLibraryItems = useMemo(
    () =>
      NODE_LIBRARY
        .filter((item) => agent?.surface !== 'automation' || item.key !== 'endchat')
        .map((item) => ({
          ...item,
          ...getNodeLibraryText(item.key, t, agent?.surface === 'automation'),
          disabled: item.key === 'tools' && !subscription?.integrations_enabled,
        })),
    [agent?.surface, subscription?.integrations_enabled, t],
  );
  const hasKnowledgeNode = useMemo(
    () => nodes.some((node) => node.data.kind === 'knowledge'),
    [nodes],
  );
  const hasTriggerNode = useMemo(
    () => nodes.some((node) => node.data.kind === 'trigger'),
    [nodes],
  );
  const hasAgentNode = useMemo(
    () => nodes.some((node) => node.data.kind === 'agent'),
    [nodes],
  );
  const hasEndChatNode = useMemo(
    () => nodes.some((node) => node.data.kind === 'endchat'),
    [nodes],
  );
  const hasConfiguredKnowledge = useMemo(
    () =>
      nodes.some(
        (node) =>
          node.data.kind === 'knowledge' &&
          ((node.data as KnowledgeBuilderNodeData).sourceIds.length > 0 ||
            ((node.data as KnowledgeBuilderNodeData).folderIds ?? []).length > 0),
      ),
    [nodes],
  );
  const hasConfiguredTools = useMemo(
    () =>
      nodes.some(
        (node) =>
          isToolNodeData(node.data) &&
          Boolean(
            node.data.connectionId &&
              connections.some(
                (connection) =>
                  connection.id === node.data.connectionId &&
                  connection.status === 'connected',
              ),
          ),
      ),
    [connections, nodes],
  );
  const displayNodes = useMemo(() => {
    const agentTitleFallback = t('agentBuilder.agentTitleFallback');
    const hasStarterPrompt = starterPromptFields.some((prompt) => prompt.trim().length > 0);

    return nodes.map((node) => {
      const enriched = enrichNodeForDisplay(node, connections, t, isPrimaryMilo);

      if (enriched.data.kind !== 'agent') {
        return enriched;
      }

      let score = 0;

      if (name && name !== 'Agent' && name !== agentTitleFallback) {
        score += 20;
      }
      if (description.trim().length > 0) {
        score += 10;
      }
      if (instructions.trim().length > 50) {
        score += 40;
      }
      if (agent?.surface === 'automation' || hasStarterPrompt) {
        score += 10;
      }
      if (hasConfiguredKnowledge || hasConfiguredTools) {
        score += 20;
      }

      return {
        ...enriched,
        data: {
          ...enriched.data,
          confidenceValue: Math.min(100, score),
          confidenceLabel: t('agentBuilder.setupReadiness'),
        },
      };
    });
  }, [
    connections,
    description,
    hasConfiguredKnowledge,
    hasConfiguredTools,
    instructions,
    isPrimaryMilo,
    name,
    nodes,
    agent?.surface,
    starterPromptFields,
    t,
  ]);
  const selectedNode = useMemo(
    () => displayNodes.find((node) => node.id === selectedNodeId) ?? null,
    [displayNodes, selectedNodeId],
  );
  const automationTriggerNode = useMemo(
    () =>
      nodes.find(
        (node): node is BuilderFlowNode & { data: TriggerBuilderNodeData } =>
          node.data.kind === 'trigger' &&
          isTriggerNodeData(node.data) &&
          node.data.provider === 'composio',
      ) ?? null,
    [nodes],
  );
  const automationConnectionId =
    automationTriggerNode?.data.connectionId ?? null;
  const automationSelectedConnection = automationConnectionId
    ? connections.find((connection) => connection.id === automationConnectionId) ?? null
    : null;
  const automationCanActivate = Boolean(
    automationConnectionId &&
      automationSelectedConnection?.status === 'connected' &&
      automationEnvironment?.hasComposio &&
      automationEnvironment?.hasWebhookSecret,
  );
  const automationProviderPollingStale = Boolean(
    automationProviderHealth?.lastSyncedAt &&
      Date.now() - new Date(automationProviderHealth.lastSyncedAt).getTime() > 45 * 60 * 1_000,
  );
  const automationProviderHealthy = Boolean(
    automationProviderHealth?.found &&
      automationProviderHealth.active &&
      !automationProviderPollingStale,
  );
  const canEditCurrentAgent = agent
    ? canEditAgentRecord(agent, user.id, membership.role)
    : true;

  const syncSelectedConnections = async (nextNodes: BuilderFlowNode[]) => {
    const selectedConnectionIds = getSelectedConnectionIdsFromNodes(nextNodes, connections);

    const { error } = await supabase.rpc('replace_agent_connections', {
      p_agent_id: agentId,
      p_connection_ids: selectedConnectionIds,
    });

    if (error) {
      throw error;
    }
  };

  const syncSelectedKnowledgeSources = async (nextNodes: BuilderFlowNode[]) => {
    const response = await fetch(`/api/agents/${agentId}/knowledge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceIds: getKnowledgeSourceIdsFromNodes(nextNodes),
        folderIds: getKnowledgeFolderIdsFromNodes(nextNodes),
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? t('agentBuilder.saveKnowledgeError'));
    }
  };

  const hydrateBuilder = useCallback((payload: AgentBuilderBootstrapResponse) => {
    const chatConnections = payload.connections;
    const attachedConnectionIds = payload.selectedConnectionIds;
    const attachedKnowledgeSourceIds = payload.attachedKnowledgeSources.map((item) => item.id);
    const attachedKnowledgeFolderIds = payload.attachedKnowledgeFolders.map((item) => item.id);
    const loadedAgent = payload.agent;
    const fallbackDefinition = buildInitialDefinition('custom', loadedAgent.surface);
    const definition = (payload.draft?.definition ?? fallbackDefinition) as BuilderDefinition;
    const normalized = normalizeDefinition(
      definition,
      loadedAgent.surface,
      chatConnections,
      attachedConnectionIds,
      attachedKnowledgeSourceIds,
      attachedKnowledgeFolderIds,
    );
    let normalizedNodes = normalized.nodes;
    const automationPayload = payload.automation;

    if (automationPayload?.automation?.connection_id) {
      normalizedNodes = normalizedNodes.map((node) => {
        if (
          node.data.kind !== 'trigger' ||
          !isTriggerNodeData(node.data) ||
          node.data.provider !== 'composio' ||
          node.data.connectionId
        ) {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            connectionId: automationPayload.automation?.connection_id ?? null,
          },
        };
      });
    }

    const hydratedNodes = normalizedNodes.map((node) => {
      if (!isToolNodeData(node.data)) {
        return node;
      }

      const resolved = resolveToolNodeConnection(node.data, chatConnections);
      return resolved.changed ? { ...node, data: resolved.data } : node;
    });

    setAgent(loadedAgent);
    setName(loadedAgent.name);
    setDescription(loadedAgent.description);
    setInstructions(definition.config?.instructions ?? loadedAgent.instructions);
    setModel(definition.config?.model ?? loadedAgent.model);
    setTimezone(definition.config?.timezone ?? loadedAgent.timezone ?? 'UTC');
    setStarterPromptFields(
      loadedAgent.surface === 'automation'
        ? getStarterPromptFields([])
        : getStarterPromptFields(
            definition.config?.starterPrompts ?? loadedAgent.starter_prompts,
          ),
    );
    setDraftVersion(payload.draft?.version ?? 1);
    setNodes(hydratedNodes);
    setEdges(buildEdges(hydratedNodes));
    setVersions(payload.versions);
    setConnections(chatConnections);
    setKnowledgeSources(payload.knowledgeSources);
    setKnowledgeFolders(payload.availableKnowledgeFolders);
    setAutomationRecord(automationPayload?.automation ?? null);
    setAutomationEvents(automationPayload?.events ?? []);
    setAutomationRuns(automationPayload?.runs ?? []);
    setAutomationEnvironment(automationPayload?.environment ?? null);
    setCurrentUserId(payload.currentUserId);
    setSelectedNodeId(null);
    setStatusNote(
      payload.draft?.updated_at
        ? { kind: 'lastSaved', date: payload.draft.updated_at }
        : { kind: 'draftInitial' },
    );
    setIsDirty(false);

    if (normalized.requiresToolReview) {
      showToast(t('agentBuilder.multipleOldConnections'), 'error');
    }
  }, [setNodes, setEdges, showToast, t]);

  useEffect(() => {
    hydratedAgentIdRef.current = null;
    setAutomationProviderHealth(null);
    setIsLoading(true);
  }, [agentId]);

  useEffect(() => {
    if (automationHealthPayload) {
      setAutomationProviderHealth(automationHealthPayload.providerTriggerHealth ?? null);
    }
  }, [automationHealthPayload]);

  useEffect(() => {
    if (!builderBootstrap || hydratedAgentIdRef.current === agentId) {
      return;
    }

    hydrateBuilder(builderBootstrap);
    hydratedAgentIdRef.current = agentId;
    setIsLoading(false);
  }, [agentId, builderBootstrap, hydrateBuilder]);

  // --- Autosave: capture baseline snapshot once hydration completes ---
  useEffect(() => {
    if (isLoading || !agent) {
      return;
    }

    // Only capture a baseline when the ref is empty (first hydration or reload)
    if (!lastSavedSnapshotRef.current) {
      lastSavedSnapshotRef.current = JSON.stringify({
        name, description, instructions, model, timezone,
        starterPromptFields,
        nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, data: n.data, position: n.position })),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, agent]);

  // --- Autosave: dirty detection ---
  useEffect(() => {
    if (isLoading || !agent || !lastSavedSnapshotRef.current) {
      return;
    }

    const current = JSON.stringify({
      name, description, instructions, model, timezone,
      starterPromptFields,
      nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, data: n.data, position: n.position })),
    });

    if (current !== lastSavedSnapshotRef.current) {
      setIsDirty(true);
    } else {
      setIsDirty(false);
    }
  }, [isLoading, agent, name, description, instructions, model, timezone, starterPromptFields, nodes]);

  // --- Autosave: debounced save ---
  useEffect(() => {
    if (!isDirty || isSaving || isPublishing || isLoading || !agent || !canEditCurrentAgent) {
      return;
    }

    autosaveTimerRef.current = setTimeout(() => {
      // Guard: don't autosave if a manual save is already in progress
      if (isAutosavingRef.current || isSaving) {
        return;
      }

      isAutosavingRef.current = true;

      void (async () => {
        try {
          await saveDraft();
        } catch {
          // saveDraft already shows error toast
        } finally {
          isAutosavingRef.current = false;
        }
      })();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, isSaving, isPublishing, isLoading, agent, canEditCurrentAgent]);

  // --- Autosave: beforeunload warning ---
  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    if (!builderBootstrapError) {
      return;
    }

    const message =
      builderBootstrapError instanceof Error
        ? builderBootstrapError.message
        : t('agentBuilder.loadError');
    showToast(message, 'error');
    setIsLoading(false);
  }, [builderBootstrapError, showToast, t]);

  const reloadBuilder = useCallback(async () => {
    const next = await mutateBuilderBootstrap();

    if (next) {
      hydrateBuilder(next);
      hydratedAgentIdRef.current = agentId;
    }
  }, [agentId, hydrateBuilder, mutateBuilderBootstrap]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadModelCatalog = async () => {
      try {
        const response = await fetch('/api/openrouter/models', {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to load model catalog.');
        }

        const payload = (await response.json()) as OpenRouterModelsApiResponse;
        const nextSections =
          Array.isArray(payload.sections) && payload.sections.length > 0
            ? payload.sections
            : getFallbackOpenRouterModelSections();
        const nextSource = payload.source === 'openrouter' ? 'openrouter' : 'fallback';

        if (!isMounted) {
          return;
        }

        startTransition(() => {
          setModelSections(nextSections);
          setModelCatalogSource(nextSource);
        });
      } catch {
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setModelSections(getFallbackOpenRouterModelSections());
          setModelCatalogSource('fallback');
        });
      } finally {
        if (isMounted) {
          setIsModelCatalogLoading(false);
        }
      }
    };

    void loadModelCatalog();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!agent || agent.surface !== 'assistant' || hasInternalAssistantsEnabled(workspace)) {
      return;
    }

    showToast(t('agentBuilder.internalAssistantsDisabled'), 'error');
    router.replace('/dashboard');
  }, [agent, router, showToast, t, workspace]);

  useEffect(() => {
    if (!agent || agent.surface !== 'automation' || hasAutomationsEnabled(workspace)) {
      return;
    }

    showToast('Automations are not enabled for this workspace.', 'error');
    router.replace('/dashboard');
  }, [agent, router, showToast, t, workspace]);

  useEffect(() => {
    if (!agent || agent.surface !== 'assistant' || canEditCurrentAgent) {
      return;
    }

    showToast(
      t('agentBuilder.managedByAnotherEditor'),
      'info',
    );
    router.replace(`/assistants/${agent.id}`);
  }, [agent, canEditCurrentAgent, router, showToast, t]);

  useEffect(() => {
    if (nodes.length === 0) {
      return;
    }

    setEdges(buildEdges(nodes));
  }, [nodes, setEdges]);

  useEffect(() => {
    if (agent?.surface !== 'automation') {
      return;
    }

    setNodes((currentNodes) => {
      if (!currentNodes.some((node) => node.data.kind === 'endchat')) {
        return currentNodes;
      }

      return currentNodes.filter((node) => node.data.kind !== 'endchat');
    });
    setSelectedNodeId((currentId) => {
      const selectedIsEndChat = nodes.some(
        (node) => node.id === currentId && node.data.kind === 'endchat',
      );
      return selectedIsEndChat ? null : currentId;
    });
  }, [agent?.surface, nodes, setNodes]);

  useEffect(() => {
    calendarOptionsStatusRef.current = calendarOptionsStatusByConnectionId;
  }, [calendarOptionsStatusByConnectionId]);

  useEffect(() => {
    calEventTypesStatusRef.current = calEventTypesStatusByConnectionId;
  }, [calEventTypesStatusByConnectionId]);

  const selectedGoogleCalendarConnectionId =
    selectedNode?.data.kind === 'googlecalendar' ? selectedNode.data.connectionId : null;
  const selectedGoogleCalendarConnection = selectedGoogleCalendarConnectionId
    ? connections.find((connection) => connection.id === selectedGoogleCalendarConnectionId) ?? null
    : null;

  useEffect(() => {
    if (!selectedGoogleCalendarConnectionId || selectedNode?.data.kind !== 'googlecalendar') {
      return;
    }

    const selectedCalendarNodeId = selectedNode.id;
    const connectionId = selectedGoogleCalendarConnectionId;
    if (!connectionId) {
      return;
    }

    if (!selectedGoogleCalendarConnection || selectedGoogleCalendarConnection.status !== 'connected') {
      setCalendarOptionsByConnectionId((current) => ({
        ...current,
        [connectionId]: [],
      }));
      setCalendarOptionsStatusByConnectionId((current) => ({
        ...current,
        [connectionId]: 'idle',
      }));
      return;
    }

    const currentStatus = calendarOptionsStatusRef.current[connectionId];
    if (currentStatus === 'ready' || currentStatus === 'loading') {
      return;
    }

    setCalendarOptionsStatusByConnectionId((current) => ({
      ...current,
      [connectionId]: 'loading',
    }));

    const loadCalendars = async () => {
      try {
        const response = await fetch(
          `/api/connections/googlecalendar/calendars?connectionId=${encodeURIComponent(
            connectionId,
          )}`,
          {
            cache: 'no-store',
          },
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? t('agentBuilder.loadCalendarsError'));
        }

        const calendars = Array.isArray(payload.calendars)
          ? (payload.calendars as GoogleCalendarListItem[])
          : [];

        setCalendarOptionsByConnectionId((current) => ({
          ...current,
          [connectionId]: calendars,
        }));
        setCalendarOptionsStatusByConnectionId((current) => ({
          ...current,
          [connectionId]: 'ready',
        }));

        updateNode(selectedCalendarNodeId, (node) => {
          if (node.data.kind !== 'googlecalendar' || node.data.connectionId !== connectionId) {
            return node;
          }

          const selectedCalendar = resolveCalendarOption(calendars, node.data.calendarId);
          const nextTimezone = selectedCalendar?.timezone ?? null;
          const nextCalendarLabel = node.data.calendarId
            ? selectedCalendar?.summary ?? null
            : null;

          if (
            node.data.timezone === nextTimezone &&
            node.data.calendarLabel === nextCalendarLabel
          ) {
            return node;
          }

          return {
            ...node,
            data: {
              ...node.data,
              timezone: nextTimezone,
              calendarLabel: nextCalendarLabel,
            },
          };
        });
      } catch (error) {
        setCalendarOptionsStatusByConnectionId((current) => ({
          ...current,
          [connectionId]: 'error',
        }));
        showToast(
          error instanceof Error ? error.message : t('agentBuilder.loadCalendarsError'),
          'error',
        );
      }
    };

    void loadCalendars();
  }, [
    resolveCalendarOption,
    selectedGoogleCalendarConnection,
    selectedGoogleCalendarConnectionId,
    selectedNode,
    showToast,
    t,
    updateNode,
  ]);

  const selectedCalConnectionId =
    selectedNode?.data.kind === 'cal' ? selectedNode.data.connectionId : null;
  const selectedCalConnection = selectedCalConnectionId
    ? connections.find((connection) => connection.id === selectedCalConnectionId) ?? null
    : null;

  useEffect(() => {
    if (!selectedCalConnectionId || selectedNode?.data.kind !== 'cal') {
      return;
    }


    const connectionId = selectedCalConnectionId;
    if (!connectionId) {
      return;
    }

    if (!selectedCalConnection || selectedCalConnection.status !== 'connected') {
      setCalEventTypesByConnectionId((current) => ({
        ...current,
        [connectionId]: [],
      }));
      setCalEventTypesStatusByConnectionId((current) => ({
        ...current,
        [connectionId]: 'idle',
      }));
      return;
    }

    const currentStatus = calEventTypesStatusRef.current[connectionId];
    // Only skip if actively loading or successfully ready — NOT if previously errored,
    // because the user may have fixed their connection and re-selected the node.
    if (currentStatus === 'ready' || currentStatus === 'loading') {
      return;
    }

    setCalEventTypesStatusByConnectionId((current) => ({
      ...current,
      [connectionId]: 'loading',
    }));

    const loadEventTypes = async () => {
      try {
        const response = await fetch(
          `/api/connections/cal/event-types?connectionId=${encodeURIComponent(
            connectionId,
          )}`,
          {
            cache: 'no-store',
          },
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? t('agentBuilder.loadEventTypesError'));
        }

        const eventTypes = Array.isArray(payload.eventTypes)
          ? (payload.eventTypes as CalEventTypeListItem[])
          : [];

        setCalEventTypesByConnectionId((current) => ({
          ...current,
          [connectionId]: eventTypes,
        }));
        // Always mark as 'ready' even if the list is empty — returning 0 event types
        // is a valid state and should NOT be treated as an error, otherwise the guard
        // above blocks any future retry for that connection.
        setCalEventTypesStatusByConnectionId((current) => ({
          ...current,
          [connectionId]: 'ready',
        }));
      } catch (error) {
        setCalEventTypesByConnectionId((current) => ({
          ...current,
          [connectionId]: [],
        }));
        setCalEventTypesStatusByConnectionId((current) => ({
          ...current,
          [connectionId]: 'error',
        }));
        showToast(
          error instanceof Error ? error.message : t('agentBuilder.loadEventTypesError'),
          'error',
        );
      }
    };

    void loadEventTypes();
  }, [
    selectedCalConnection,
    selectedCalConnectionId,
    selectedNode,
    showToast,
    t,
  ]);

  useEffect(() => {
    if (nodes.length === 0) {
      return;
    }

    if (selectedNodeId && !nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [nodes, selectedNodeId]);

  const actionEditorNode =
    actionEditorNodeId
      ? nodes.find((node) => node.id === actionEditorNodeId && isToolNodeData(node.data)) ?? null
      : null;
  const actionEditorToolkitSlug =
    actionEditorNode && isToolNodeData(actionEditorNode.data)
      ? actionEditorNode.data.kind
      : null;
  const deferredActionSearchQuery = useDeferredValue(actionSearchQuery);

  useEffect(() => {
    setActionSearchQuery('');
    setActiveActionDescription(null);
    setIsMoreActionsOpen(false);
  }, [actionEditorNodeId]);

  useEffect(() => {
    if (!actionEditorToolkitSlug) {
      return;
    }

    const currentStatus = toolkitActionsStatusBySlug[actionEditorToolkitSlug] ?? 'idle';

    if (currentStatus === 'ready' || currentStatus === 'loading') {
      return;
    }

    setToolkitActionsStatusBySlug((current) => ({
      ...current,
      [actionEditorToolkitSlug]: 'loading',
    }));

    const loadActions = async () => {
      try {
        const response = await fetch(
          `/api/connections/toolkits/${actionEditorToolkitSlug}/tools`,
          { cache: 'no-store' },
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? t('agentBuilder.loadActionsError'));
        }

        const actions = Array.isArray(payload.actions)
          ? (payload.actions as ToolkitActionOption[])
          : [];

        setToolkitActionsBySlug((current) => ({
          ...current,
          [actionEditorToolkitSlug]: actions,
        }));
        setToolkitActionsStatusBySlug((current) => ({
          ...current,
          [actionEditorToolkitSlug]: 'ready',
        }));
      } catch (error) {
        setToolkitActionsStatusBySlug((current) => ({
          ...current,
          [actionEditorToolkitSlug]: 'error',
        }));
        showToast(
          error instanceof Error ? error.message : t('agentBuilder.loadActionsError'),
          'error',
        );
      }
    };

    void loadActions();
  }, [actionEditorToolkitSlug, showToast, t, toolkitActionsStatusBySlug]);

  const closeActionEditor = () => {
    setActionEditorNodeId(null);
    setActionSearchQuery('');
  };

  const handleAddTriggerNode = () => {
    if (nodes.some((node) => node.data.kind === 'trigger')) {
      showToast(t('agentBuilder.triggerAlreadyOnCanvas'), 'error');
      return;
    }

    saveToHistory();
    const node = createTriggerNode();
    setNodes((currentNodes) => [...currentNodes, node]);
    setSelectedNodeId(node.id);
  };

  const handleAddAgentNode = () => {
    if (nodes.some((node) => node.data.kind === 'agent')) {
      showToast(t('agentBuilder.agentAlreadyOnCanvas'), 'error');
      return;
    }

    saveToHistory();
    const node = createAgentCoreNode();
    setNodes((currentNodes) => [...currentNodes, node]);
    setSelectedNodeId(node.id);
  };

  const handleAddKnowledgeNode = () => {
    if (nodes.some((node) => node.data.kind === 'knowledge')) {
      showToast(t('agentBuilder.knowledgeAlreadyOnCanvas'), 'error');
      return;
    }

    saveToHistory();
    const node = createKnowledgeNode();
    setNodes((currentNodes) => [...currentNodes, node]);
    setSelectedNodeId(node.id);
  };

  const handleAddEndChatNode = () => {
    if (nodes.some((node) => node.data.kind === 'endchat')) {
      showToast(t('agentBuilder.endChatAlreadyOnCanvas'), 'error');
      return;
    }

    saveToHistory();
    const node = createEndChatNode();
    setNodes((currentNodes) => [...currentNodes, node]);
    setSelectedNodeId(node.id);
  };

  const handleAddAnnotationNode = () => {
    saveToHistory();
    const annotationCount = nodes.filter(
      (node) => node.data.kind === 'annotation',
    ).length;
    const node = createTextAnnotationNode({
      x: DEFAULT_POSITIONS.annotation.x + annotationCount * 24,
      y: DEFAULT_POSITIONS.annotation.y + annotationCount * 24,
    });
    setNodes((currentNodes) => [...currentNodes, node]);
    setSelectedNodeId(node.id);
  };

  const handleAddToolNode = (kind: ToolNodeKind) => {
    if (nodes.some((node) => node.data.kind === kind)) {
      showToast(
        t('agentBuilder.toolAlreadyOnCanvas', {
          tool: getSupportedIntegration(kind)?.displayName ?? kind,
        }),
        'error',
      );
      return;
    }

    saveToHistory();
    const defaultConnection = getSingleConnection(connections, kind);
    const connectionId = defaultConnection?.status === 'connected' ? defaultConnection.id : null;
    const nextNode =
      kind === 'gmail' ? createGmailNode(DEFAULT_POSITIONS.gmail, connectionId) :
      kind === 'outlook' ? createOutlookNode(DEFAULT_POSITIONS.outlook, connectionId) :
      kind === 'slack' ? createSlackNode(DEFAULT_POSITIONS.slack, connectionId) :
      kind === 'hubspot' ? createHubSpotNode(DEFAULT_POSITIONS.hubspot, connectionId) :
      kind === 'shopify' ? createShopifyNode(DEFAULT_POSITIONS.shopify, connectionId) :
      kind === 'googleads' ? createGoogleAdsNode(DEFAULT_POSITIONS.googleads, connectionId) :
      kind === 'cal' ? createCalNode(DEFAULT_POSITIONS.cal, connectionId) :
      createGoogleCalendarNode(DEFAULT_POSITIONS.googlecalendar, connectionId);
    setNodes((currentNodes) => [...currentNodes, nextNode]);
    setSelectedNodeId(nextNode.id);
    setIsToolPickerOpen(false);
  };

  const refreshBuilderConnections = useCallback(async () => {
    const response = await fetch('/api/connections/toolkits', {
      cache: 'no-store',
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? t('connections.loadError'));
    }

    const chatConnections = ((payload.connections ?? []) as ConnectionRecord[])
      .map((connection) => ({
        ...connection,
        status: getEffectiveConnectionStatus(connection),
      }))
      .filter((connection) => isChatIntegrationSlug(connection.toolkit_slug));

    setConnections(chatConnections);
    void mutateBuilderBootstrap();
    return chatConnections;
  }, [mutateBuilderBootstrap, t]);

  const handleConnectToolNode = async (kind: ToolNodeKind) => {
    const integration = getSupportedIntegration(kind);
    setConnectingToolKind(kind);

    try {
      const response = await fetch('/api/connections/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toolkitSlug: kind }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t('connections.startFlowError'));
      }

      if (payload.redirectUrl) {
        window.open(payload.redirectUrl, '_blank', 'noopener,noreferrer');
        setPendingToolConnectionKind(kind);
        showToast(
          t('agentBuilder.finishToolConnection', {
            tool: integration?.displayName ?? kind,
          }),
          'info',
        );
      }

      await refreshBuilderConnections();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('connections.startFlowError');
      showToast(message, 'error');
    } finally {
      setConnectingToolKind(null);
    }
  };

  const handleToolPickerAction = async (kind: ToolNodeKind) => {
    const connection = getSingleConnection(connections, kind);

    if (connection?.status === 'connected') {
      handleAddToolNode(kind);
      return;
    }

    await handleConnectToolNode(kind);
  };

  useEffect(() => {
    if (!pendingToolConnectionKind || !isToolPickerOpen) {
      return;
    }

    let cancelled = false;

    const pollConnection = async () => {
      try {
        const nextConnections = await refreshBuilderConnections();
        const connected = nextConnections.some(
          (connection) =>
            connection.toolkit_slug === pendingToolConnectionKind &&
            connection.status === 'connected',
        );

        if (connected && !cancelled) {
          showToast(
            t('agentBuilder.toolConnectionReady', {
              tool: getSupportedIntegration(pendingToolConnectionKind)?.displayName ?? pendingToolConnectionKind,
            }),
            'success',
          );
          setPendingToolConnectionKind(null);
        }
      } catch {
        // Keep polling; transient auth/sync failures should not break the picker.
      }
    };

    void pollConnection();
    const intervalId = window.setInterval(() => void pollConnection(), 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isToolPickerOpen, pendingToolConnectionKind, refreshBuilderConnections, showToast, t]);

  const updateKnowledgeSources = (sourceId: string, checked: boolean) => {
    const knowledgeNode = nodes.find((node) => node.data.kind === 'knowledge');

    if (!knowledgeNode || !isKnowledgeNodeData(knowledgeNode.data)) {
      return;
    }

    updateNode(knowledgeNode.id, (node) => {
      const currentSourceIds = isKnowledgeNodeData(node.data) ? node.data.sourceIds : [];
      return {
        ...node,
        data: {
          ...node.data,
          sourceIds: checked
            ? Array.from(new Set([...currentSourceIds, sourceId]))
            : currentSourceIds.filter((id) => id !== sourceId),
        },
      };
    });
  };

  const updateKnowledgeFolders = (folderId: string, checked: boolean) => {
    const knowledgeNode = nodes.find((node) => node.data.kind === 'knowledge');

    if (!knowledgeNode || !isKnowledgeNodeData(knowledgeNode.data)) {
      return;
    }

    updateNode(knowledgeNode.id, (node) => {
      const currentFolderIds = isKnowledgeNodeData(node.data)
        ? node.data.folderIds ?? []
        : [];
      return {
        ...node,
        data: {
          ...node.data,
          folderIds: checked
            ? Array.from(new Set([...currentFolderIds, folderId]))
            : currentFolderIds.filter((id) => id !== folderId),
        },
      };
    });
  };

  const updateEmailRecipientSettings = (
    nodeId: string,
    updates: Partial<Pick<GmailBuilderNodeData | OutlookBuilderNodeData, 'recipientMode' | 'recipientEmail'>>,
  ) => {
    updateNode(nodeId, (node) => {
      if (node.data.kind !== 'gmail' && node.data.kind !== 'outlook') {
        return node;
      }

      return {
        ...node,
        data: {
          ...node.data,
          ...updates,
        },
      };
    });
  };

  const updateToolActions = (nodeId: string, enabledTools: string[]) => {
    updateNode(nodeId, (node) => {
      if (!isToolNodeData(node.data)) {
        return node;
      }

      return {
        ...node,
        data: {
          ...node.data,
          enabledTools: enabledTools.filter((toolName) =>
            isToolNameForToolkit(toolName, node.data.kind),
          ),
        },
      };
    });
  };

  const removeOptionalNode = (kind: BuilderNodeKind) => {
    saveToHistory();
    setNodes((currentNodes) => currentNodes.filter((node) => node.data.kind !== kind));
    setSelectedNodeId(null);
  };

  const removeNodeById = (nodeId: string) => {
    saveToHistory();
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
    setSelectedNodeId(null);
  };

  const resolveToolConnectionNodes = (sourceNodes: BuilderFlowNode[]) =>
    sourceNodes.map((node) => {
      if (!isToolNodeData(node.data)) {
        return node;
      }

      const resolved = resolveToolNodeConnection(node.data, connections);
      return resolved.changed ? { ...node, data: resolved.data } : node;
    });

  const buildDefinition = (definitionNodes = nodes): BuilderDefinition => {
    const triggerNode = definitionNodes.find((node) => node.data.kind === 'trigger');
    const triggerData =
      triggerNode && isTriggerNodeData(triggerNode.data) ? triggerNode.data : null;

    return {
      nodes: definitionNodes,
      edges: buildEdges(definitionNodes),
      viewport: flowInstance?.getViewport(),
      config: {
        model,
        instructions,
        starterPrompts: agent?.surface === 'automation'
          ? []
          : starterPromptFields
              .map((item) => item.trim())
              .filter(Boolean),
        timezone,
        trigger: {
          source: triggerData?.triggerSource ?? 'user_message',
          provider: triggerData?.provider ?? 'internal',
          toolkitSlug: triggerData?.toolkitSlug ?? null,
          triggerSlug: triggerData?.triggerSlug ?? null,
          triggerConfig: triggerData?.triggerConfig ?? {},
          connectionId: triggerData?.connectionId ?? null,
        },
      },
    };
  };

  const syncExternalTriggerBinding = async (definition: BuilderDefinition) => {
    if (!agent || (agent.surface !== 'widget' && agent.surface !== 'automation')) {
      return;
    }

    const trigger = definition.config.trigger;
    const endpoint = `/api/agents/${agentId}/automation`;

    if (trigger?.provider === 'composio' && trigger.triggerSlug) {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          model,
          instructions,
          timezone,
          connectionId: trigger.connectionId ?? null,
          triggerSlug: trigger.triggerSlug,
          triggerConfig: trigger.triggerConfig ?? {},
          definition,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload.error === 'string' ? payload.error : t('agentBuilder.saveError'),
        );
      }

      setShouldClearExternalTrigger(false);
      return;
    }

    if (!shouldClearExternalTrigger) {
      return;
    }

    const response = await fetch(endpoint, { method: 'DELETE' });

    if (!response.ok && response.status !== 404) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(
        typeof payload.error === 'string' ? payload.error : t('agentBuilder.saveError'),
      );
    }

    setShouldClearExternalTrigger(false);
  };

  const saveDraft = async () => {
    if (!agent) {
      return;
    }

    setIsSaving(true);

    try {
      const resolvedNodes = resolveToolConnectionNodes(nodes);
      const definition = buildDefinition(resolvedNodes);
      const nextSurface =
        agent.surface === 'assistant'
          ? 'assistant'
          : definition.config.trigger?.provider === 'composio'
            ? 'automation'
            : 'widget';

      const [agentResult, draftResult] = await Promise.all([
        supabase
          .from('agents')
          .update({
            name,
            description,
            instructions,
            model,
            surface: nextSurface,
            starter_prompts: definition.config.starterPrompts,
            timezone,
            ...(agent.surface === 'assistant' && agent.status === 'draft'
              ? { status: 'active' }
              : {}),
          })
          .eq('id', agentId),
        supabase.from('agent_drafts').upsert(
          {
            agent_id: agentId,
            workspace_id: agent.workspace_id,
            updated_by: currentUserId ?? agent.created_by,
            definition,
            version: draftVersion,
          },
          {
            onConflict: 'agent_id',
          },
        ),
      ]);

      if (agentResult.error) {
        throw agentResult.error;
      }

      if (draftResult.error) {
        throw draftResult.error;
      }

      await syncSelectedConnections(resolvedNodes);
      await syncSelectedKnowledgeSources(resolvedNodes);
      await syncExternalTriggerBinding(definition);
      setNodes(resolvedNodes);
      setEdges(buildEdges(resolvedNodes));
      setAgent((current) =>
        current
          ? {
              ...current,
              name,
              description,
              instructions,
              model,
              surface: nextSurface,
              starter_prompts: definition.config.starterPrompts,
              timezone,
              status:
                current.surface === 'assistant' && current.status === 'draft'
                  ? 'active'
                  : current.status,
            }
          : current,
      );
      setStatusNote({ kind: 'lastSaved', date: new Date().toISOString() });
      // Update autosave baseline and clear dirty flag
      lastSavedSnapshotRef.current = JSON.stringify({
        name, description, instructions, model, timezone,
        starterPromptFields,
        nodes: resolvedNodes.map((n) => ({ id: n.id, kind: n.data.kind, data: n.data, position: n.position })),
      });
      setIsDirty(false);
      // Only show toast for manual saves, not autosave
      if (!isAutosavingRef.current) {
        showToast(t('agentBuilder.draftSaved'), 'success');
      }
      void mutateBuilderBootstrap();
    } catch (error) {
      await reloadBuilder().catch(() => undefined);
      const message = error instanceof Error ? error.message : t('agentBuilder.saveError');
      showToast(message, 'error');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const publishVersion = async () => {
    if (!agent || agent.surface === 'assistant') {
      return;
    }

    setIsPublishing(true);

    try {
      await saveDraft();
      const definition = buildDefinition();

      const { data: latestVersion } = await supabase
        .from('agent_versions')
        .select('version')
        .eq('agent_id', agentId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      const versionNumber = (latestVersion?.version ?? 0) + 1;
      const { data: version, error: versionError } = await supabase
        .from('agent_versions')
        .insert({
          agent_id: agentId,
          workspace_id: agent.workspace_id,
          version: versionNumber,
          definition,
          published_by: currentUserId ?? agent.created_by,
        })
        .select()
        .single();

      if (versionError || !version) {
        throw versionError ?? new Error(t('agentBuilder.publishError'));
      }

      const { error: updateError } = await supabase
        .from('agents')
        .update({
          status: 'active',
          published_version_id: version.id,
          name,
          description,
          instructions,
          model,
          starter_prompts: definition.config.starterPrompts,
        })
        .eq('id', agentId);

      if (updateError) {
        throw updateError;
      }

      setDraftVersion(versionNumber + 1);
      setStatusNote({
        kind: 'publishedAt',
        date: new Date().toISOString(),
        version: versionNumber,
      });
      showToast(t('agentBuilder.publishSuccess', { version: versionNumber }), 'success');
      await reloadBuilder();
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('agentBuilder.publishError');
      showToast(message, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const submitToAgentLibrary = async () => {
    if (!agent || !canEditCurrentAgent) {
      return;
    }

    setIsSubmittingLibrary(true);

    try {
      await saveDraft();
      const response = await fetch('/api/agent-library/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t('agentBuilder.submitLibraryError'));
      }

      showToast(t('agentBuilder.submitLibrarySuccess'), 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('agentBuilder.submitLibraryError');
      showToast(message, 'error');
    } finally {
      setIsSubmittingLibrary(false);
    }
  };

  const updateAutomationStatus = async (action: 'activate' | 'pause') => {
    if (!agent || agent.surface !== 'automation') {
      return;
    }

    setAutomationStatusAction(action);

    try {
      if (action === 'activate') {
        await saveDraft();
      }

      const response = await fetch(`/api/agents/${agentId}/automation/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string' ? payload.error : t('agentBuilder.saveError'),
        );
      }

      await reloadBuilder();
      await mutateAutomationHealth();
      router.refresh();
      showToast(
        action === 'activate'
          ? t('agentBuilder.triggerActivated')
          : t('agentBuilder.triggerPaused'),
        'success',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t('agentBuilder.saveError');
      showToast(message, 'error');
    } finally {
      setAutomationStatusAction(null);
    }
  };

  const rollbackVersion = async (versionId: string) => {
    setIsRollingBackVersionId(versionId);

    try {
      const response = await fetch(`/api/agents/${agentId}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          versionId,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t('agentBuilder.rollbackError'));
      }

      await reloadBuilder();
      showToast(t('agentBuilder.rollbackSuccess'), 'success');
      setStatusNote({ kind: 'rolledBackAt', date: new Date().toISOString() });
      setIsHistoryOpen(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('agentBuilder.rollbackError');
      showToast(message, 'error');
    } finally {
      setIsRollingBackVersionId(null);
    }
  };

  const handleOptimizePrompt = async () => {
    if (!instructions.trim()) {
      showToast(t('agentBuilder.optimizeEmptyWarning'), 'warning');
      return;
    }

    setIsOptimizingPrompt(true);

    try {
      const response = await fetch(`/api/agents/${agentId}/optimize-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instructions,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t('common.errors'));
      }

      setInstructions(payload.optimizedInstructions);
      showToast(t('agentBuilder.optimizeSuccess'), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.errors');
      showToast(message, 'error');
    } finally {
      setIsOptimizingPrompt(false);
    }
  };

  if (isLoading) {
    if (isPrimaryMilo) {
      return <MiloLoadingScreen />;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-24 w-24 animate-spin rounded-full border-4 border-outline-variant/20 border-t-primary" />
      </div>
    );
  }

  const knowledgeNode = selectedNode?.data.kind === 'knowledge' ? selectedNode : null;
  const toolNode = selectedNode && isToolNodeData(selectedNode.data) ? selectedNode : null;
  const endChatNode = selectedNode && isEndChatNodeData(selectedNode.data) ? selectedNode : null;
  const toolOptions = TOOL_NODE_KINDS.map((kind) => {
    const integration = getSupportedIntegration(kind);
    const connectedCount = connections.filter(
      (connection) => connection.toolkit_slug === kind && connection.status === 'connected',
    ).length;
    const isAdded = nodes.some((node) => node.data.kind === kind);
    const isConnecting = connectingToolKind === kind;
    const isWaiting = pendingToolConnectionKind === kind;

    return {
      kind,
      displayName: integration?.displayName ?? kind,
      description:
        kind === 'gmail'
          ? t('agentBuilder.gmailDescription')
          : kind === 'outlook'
            ? t('agentBuilder.outlookDescription')
            : kind === 'slack'
              ? t('agentBuilder.slackDescription')
              : kind === 'hubspot'
                ? t('agentBuilder.hubspotDescription')
                : kind === 'shopify'
                  ? t('agentBuilder.shopifyDescription')
                  : kind === 'googleads'
                    ? t('agentBuilder.googleAdsDescription')
                    : kind === 'cal'
                      ? t('agentBuilder.calDescription')
                      : t('agentBuilder.googleCalendarDescription'),
      icon: integration?.icon ?? 'extension',
      simpleIcon: integration?.simpleIcon,
      simpleIconColor: integration?.simpleIconColor,
      isAdded,
      isConnecting,
      isWaiting,
      canAdd: connectedCount > 0 && !isAdded,
      stateLabel: isAdded
        ? t('common.added')
        : isConnecting
          ? t('common.processing')
          : isWaiting
            ? t('agentBuilder.waitingForConnection')
            : connectedCount > 0
          ? t('statuses.connection.connected')
          : t('connections.connect'),
    };
  });

  const renderInspectorBody = () => {
    if (!selectedNode) {
      return null;
    }

    if (selectedNode.data.kind === 'trigger') {
      const triggerNode = selectedNode as BuilderFlowNode & { data: TriggerBuilderNodeData };
      const externalTriggersEnabled = hasAutomationsEnabled(workspace);
      const selectedSource =
        externalTriggersEnabled ? triggerNode.data.triggerSource ?? 'user_message' : 'user_message';
      const triggerSourceOptions: BuilderTriggerSource[] =
        agent?.surface === 'automation'
          ? ['gmail_new_message']
          : getAvailableTriggerSources(externalTriggersEnabled);

      return (
        <div className="space-y-7">
          {agent?.surface === 'automation' ? (
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-on-surface-variant/45">
                {t('agentBuilder.selectedTrigger')}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 text-warning">
                  <span className="material-symbols-outlined text-lg">mail</span>
                </span>
                <div>
                  <p className="text-sm font-bold text-on-surface">
                    {getTriggerSourceText('gmail_new_message', t).label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-on-surface-variant/60">
                    {t('agentBuilder.composioTriggerHelp')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-lowest p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">
                  {t('agentBuilder.triggerSetupTitle')}
                </p>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                  {t('agentBuilder.triggerSetupDescription')}
                </p>
              </div>

              <div className="space-y-3">
                {triggerSourceOptions.map((source) => {
              const sourceText = getTriggerSourceText(source, t);
              const isSelected = selectedSource === source;
              const isExternal = source === 'gmail_new_message';

              return (
                <button
                  key={source}
                  type="button"
                  onClick={() => {
                    if (isExternal && !externalTriggersEnabled) return;
                    if (selectedSource === 'gmail_new_message' && source !== 'gmail_new_message') {
                      setShouldClearExternalTrigger(true);
                    }

                    setAgent((current) =>
                      current && current.surface !== 'assistant'
                        ? { ...current, surface: isExternal ? 'automation' : 'widget' }
                        : current,
                    );
                    updateNode(triggerNode.id, (node) => ({
                      ...node,
                      data: {
                        ...node.data,
                        label: sourceText.label,
                        description: sourceText.description,
                        icon: sourceText.icon,
                        triggerSource: source,
                        provider: isExternal ? 'composio' : 'internal',
                        toolkitSlug: isExternal ? 'gmail' : null,
                        triggerSlug: isExternal ? AUTOMATION_GMAIL_TRIGGER_SLUG : null,
                        connectionId:
                          isExternal && isTriggerNodeData(node.data)
                            ? node.data.connectionId ?? getSingleConnection(connections, 'gmail')?.id ?? null
                            : null,
                        triggerConfig: isExternal
                          ? { ...AUTOMATION_GMAIL_TRIGGER_CONFIG }
                          : {},
                      } as TriggerBuilderNodeData,
                    }));
                  }}
                  className={`group flex w-full items-start gap-4 rounded-[1.5rem] border p-4 text-left transition-all ${
                    isSelected
                      ? 'border-primary/35 bg-primary/5 shadow-sm'
                      : 'border-outline-variant/10 bg-surface-container-lowest hover:border-primary/25 hover:bg-surface-container-low'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      isSelected
                        ? 'app-selected-icon'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {sourceText.icon}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-on-surface">{sourceText.label}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] ${
                          isExternal
                            ? 'bg-warning/10 text-warning'
                            : 'bg-success/10 text-success'
                        }`}
                      >
                        {isExternal
                          ? t('agentBuilder.triggerProviderComposio')
                          : isPrimaryMilo
                            ? t('agentBuilder.triggerProviderWebsiteChat')
                            : t('agentBuilder.triggerProviderInternal')}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant/65">
                      {sourceText.description}
                    </p>
                  </div>
                </button>
              );
                })}
              </div>
            </>
          )}

          {selectedSource === 'gmail_new_message' ? (
            <div className="space-y-3 rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-lowest p-5">
              <ConnectedAccountDisplay
                connection={automationSelectedConnection}
                toolkitLabel="Gmail"
                isConnecting={connectingToolKind === 'gmail'}
                onConnect={() => void handleConnectToolNode('gmail')}
              />
            </div>
          ) : null}

          {selectedSource === 'gmail_new_message' ? (
            <div className="space-y-4 rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-lowest p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">
                    {t('agentBuilder.automationReadiness')}
                  </p>
                  <p className="mt-1 text-xs font-bold text-on-surface-variant/60">
                    {automationRecord?.status === 'active'
                      ? t('agentBuilder.automationActive')
                      : automationCanActivate
                        ? t('agentBuilder.activationReady')
                        : t('agentBuilder.activationBlocked')}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] ${
                    automationRecord?.status === 'active'
                      ? 'bg-success/10 text-success'
                      : 'bg-warning/10 text-warning'
                  }`}
                >
                  {automationRecord?.status ?? 'draft'}
                </span>
              </div>

              <div className="space-y-3 rounded-[1rem] bg-surface-container-low p-4">
                {[
                  {
                    label: t('agentBuilder.selectedTrigger'),
                    value: getTriggerSourceText('gmail_new_message', t).label,
                  },
                  {
                    label: t('agentBuilder.selectedAccount'),
                    value:
                      automationSelectedConnection?.account_label ??
                      automationSelectedConnection?.external_id ??
                      t('agentBuilder.noTriggerAccount'),
                  },
                  {
                    label: t('agentBuilder.webhookConfigured'),
                    value: automationEnvironment?.hasWebhookSecret
                      ? t('agentBuilder.webhookConfigured')
                      : t('agentBuilder.webhookMissing'),
                  },
                  {
                    label: t('agentBuilder.providerPolling'),
                    value: automationRecord?.status !== 'active'
                      ? t('agentBuilder.providerPollingInactive')
                      : automationProviderHealthy
                        ? t('agentBuilder.providerPollingHealthy')
                        : t('agentBuilder.providerPollingAttention'),
                  },
                  {
                    label: t('agentBuilder.lastAutomationEvent'),
                    value: automationEvents[0]?.created_at
                      ? formatLocaleDateTime(automationEvents[0].created_at, language)
                      : 'Never',
                  },
                  {
                    label: t('agentBuilder.lastAutomationError'),
                    value: automationRecord?.last_error ?? 'None',
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-on-surface-variant/45">
                      {item.label}
                    </span>
                    <span className="max-w-[12rem] truncate text-right text-xs font-bold text-on-surface">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              {automationRuns[0] ? (
                <p className="text-[11px] font-medium text-on-surface-variant/60">
                  Latest run: {automationRuns[0].status}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }

    if (selectedNode.data.kind === 'agent') {
      const confidence = selectedNode.data.confidenceValue ?? 0;
      
      return (
        <div className="space-y-8">
          {/* Setup Readiness Indicator */}
          <div className="relative overflow-hidden rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">
                    {selectedNode.data.confidenceLabel}
                  </span>
                  <span className="mt-1 text-lg font-bold text-on-surface">
                    {confidence === 100 ? t('common.complete') : `${confidence}%`}
                  </span>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 text-primary">
                  <span className="material-symbols-outlined text-xl">
                    {confidence === 100 ? 'check_circle' : 'bolt'}
                  </span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                <div 
                  className="h-full bg-primary transition-all duration-1000 ease-out"
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
            {/* Background Accent */}
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
          </div>

          <div className="space-y-6">
            {!isPrimaryMilo ? (
              <div>
                <label className="mb-2.5 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
                  {t('agentBuilder.identity')}
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={stopBuilderFieldKeyDown}
                  placeholder={t('agents.createModal.agentNamePlaceholder')}
                  className="w-full rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-lowest px-5 py-4 text-sm font-bold text-on-surface shadow-sm outline-none transition-all placeholder:text-on-surface-variant/40 focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
                />
              </div>
            ) : null}

            <div>
              <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
                {t('agentBuilder.contextualNote')}
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                onKeyDown={stopBuilderFieldKeyDown}
                rows={3}
                placeholder={t('common.description')}
                className="w-full resize-none rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-lowest px-5 py-4 text-sm font-medium leading-relaxed text-on-surface shadow-sm outline-none transition-all placeholder:text-on-surface-variant/40 focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
              />
            </div>

            <div>
              <AgentModelPicker
                value={model}
                sections={modelSections}
                legacyOption={legacyModelOption}
                isLoading={isModelCatalogLoading}
                source={modelCatalogSource}
                onChange={setModel}
                onKeyDown={stopBuilderFieldKeyDown}
                milo={isPrimaryMilo}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2.5 ml-1">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
                  {t('agentBuilder.operationalInstructions')}
                </label>
                <button
                  onClick={() => setIsInstructionsModalOpen(true)}
                  className="flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1.5 text-primary transition-all hover:bg-primary/10 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_full</span>
                  <span className="text-[10px] font-black uppercase tracking-wider">{t('common.expand')}</span>
                </button>
              </div>
              <textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                onKeyDown={stopBuilderFieldKeyDown}
                rows={10}
                placeholder={t('agentBuilder.operationalInstructions')}
                className="min-h-[250px] w-full resize-y rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-lowest px-6 py-6 text-sm font-medium leading-relaxed text-on-surface shadow-sm outline-none transition-all placeholder:text-on-surface-variant/40 focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
              />
              <div className="mt-3 flex items-start gap-2 px-1">
                <span className="material-symbols-outlined text-sm text-primary/60 mt-0.5">info</span>
                <p className="text-[11px] leading-relaxed text-on-surface-variant/60 font-medium">
                  {agent?.surface === 'automation'
                    ? t('agentBuilder.automationInstructionsHelp')
                    : t('agentBuilder.operationalInstructionsHelp')}
                </p>
              </div>

              {/* Full-screen immersive prompt editor */}
              {isInstructionsModalOpen && typeof document !== 'undefined' && createPortal(
                <PromptEditor
                  instructions={instructions}
                  setInstructions={setInstructions}
                  isOptimizingPrompt={isOptimizingPrompt}
                  handleOptimizePrompt={handleOptimizePrompt}
                  stopBuilderFieldKeyDown={stopBuilderFieldKeyDown}
                  name={name}
                  t={t}
                  onClose={() => setIsInstructionsModalOpen(false)}
                />,
                document.body,
              )}
            </div>

            <div>
              <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
                {t('agentBuilder.temporalOrientation')}
              </label>
              <div className="relative">
                <select
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  onKeyDown={stopBuilderFieldKeyDown}
                  className="w-full appearance-none rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-lowest px-5 py-4 text-sm font-bold text-on-surface shadow-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/5 cursor-pointer"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
                  unfold_more
                </span>
              </div>
            </div>

            {agent?.surface !== 'automation' ? <div>
              <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
                {t('agentBuilder.conversationStarters')}
              </label>
              <div className="space-y-3">
                {starterPromptFields.map((prompt, index) => (
                  <div key={`starter-prompt-${index}`} className="relative group">
                    <input
                      value={prompt}
                      onChange={(event) =>
                        setStarterPromptFields((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      onKeyDown={stopBuilderFieldKeyDown}
                      className="w-full rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-lowest px-5 py-4 pl-12 text-sm font-medium text-on-surface shadow-sm outline-none transition-all placeholder:text-on-surface-variant/40 focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
                      placeholder={t('agentBuilder.starterChipPlaceholder', {
                        index: index + 1,
                      })}
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg text-primary/30 group-focus-within:text-primary transition-colors">
                      chat_bubble
                    </span>
                  </div>
                ))}
              </div>
            </div> : null}
          </div>
        </div>
      );
    }

    if (isTextAnnotationNodeData(selectedNode.data)) {
      return (
        <div className="space-y-6">
          <div>
            <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
              {t('agentBuilder.annotationText')}
            </label>
            <textarea
              value={selectedNode.data.text}
              onChange={(event) =>
                updateNode(selectedNode.id, (node) => ({
                  ...node,
                  data: {
                    ...node.data,
                    text: event.target.value,
                  } as TextAnnotationBuilderNodeData,
                }))
              }
              onKeyDown={stopBuilderFieldKeyDown}
              rows={8}
              placeholder={t('agentBuilder.annotationPlaceholder')}
              className="min-h-56 w-full resize-y rounded-[10px] border border-amber-200 bg-amber-50 px-5 py-4 text-[15px] font-semibold leading-6 text-slate-950 shadow-[0_16px_34px_rgba(15,23,42,0.08)] outline-none transition-all placeholder:text-amber-700/55 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 dark:border-amber-500/25 dark:bg-[#2b2413] dark:text-amber-50 dark:placeholder:text-amber-100/45"
            />
          </div>
          <p className="text-xs leading-5 text-on-surface-variant/60">
            {t('agentBuilder.annotationHelp')}
          </p>
          <button
            onClick={() => removeNodeById(selectedNode.id)}
            className="w-full flex items-center justify-center gap-3 rounded-[1.25rem] bg-error/5 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-error transition-all hover:bg-error hover:text-on-error hover:shadow-lg hover:shadow-error/20 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
            {t('agentBuilder.removeNode')}
          </button>
        </div>
      );
    }

    if (knowledgeNode && isKnowledgeNodeData(knowledgeNode.data)) {
      const attachedSourceIds = knowledgeNode.data.sourceIds;
      const attachedFolderIds = knowledgeNode.data.folderIds ?? [];
      const validAttachedSourceIds = attachedSourceIds.filter((id) =>
        knowledgeSources.some((source) => source.id === id)
      );
      const validAttachedFolderIds = attachedFolderIds.filter((id) =>
        knowledgeFolders.some((folder) => folder.id === id)
      );
      const effectiveSourceIds = Array.from(
        new Set([
          ...validAttachedSourceIds,
          ...knowledgeFolders
            .filter((folder) => validAttachedFolderIds.includes(folder.id))
            .flatMap((folder) => folder.sourceIds),
        ]),
      ).filter((id) => knowledgeSources.some((source) => source.id === id));

      return (
          <div className="space-y-10">
            <div className="relative overflow-hidden rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">{t('agentBuilder.dataSources')}</h3>
                  <div className="flex shrink-0 items-center gap-2 rounded-full ring-1 ring-inset ring-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    {effectiveSourceIds.length === 1
                      ? t('agentBuilder.sourceCount', { count: effectiveSourceIds.length })
                      : t('agentBuilder.sourceCountPlural', { count: effectiveSourceIds.length })}
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-on-surface-variant/70 font-medium">
                  {t('agentBuilder.semanticSourcesDescription')}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-on-surface-variant/50">
                  <span>{t('agentBuilder.folderCount', { count: validAttachedFolderIds.length })}</span>
                  <span>{t('agentBuilder.effectiveSourceCount', { count: effectiveSourceIds.length })}</span>
                </div>
              </div>
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
            </div>
            
            <div className="space-y-4">
              {knowledgeFolders.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
                      {t('agentBuilder.knowledgeFolders')}
                    </h4>
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-on-surface-variant/35">
                      {t('agentBuilder.liveFolders')}
                    </span>
                  </div>
                  {knowledgeFolders.map((folder) => {
                    const checked = attachedFolderIds.includes(folder.id);
                    const readySourceCount = folder.sourceIds.filter((id) =>
                      knowledgeSources.some((source) => source.id === id && isReadyKnowledgeSource(source)),
                    ).length;

                    return (
                      <label
                        key={folder.id}
                        className={`group relative flex items-center justify-between gap-4 rounded-[1.75rem] border p-5 transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] cursor-pointer ${
                          checked
                            ? 'border-primary/40 bg-primary/[0.04] ring-1 ring-inset ring-primary/10 shadow-lg shadow-primary/5'
                            : 'border-outline-variant/10 bg-surface-container-lowest hover:border-outline-variant/30 hover:bg-surface-container-low hover:shadow-xl hover:shadow-black/5'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pl-1">
                          <p className={`text-sm font-bold tracking-tight truncate pr-4 transition-colors ${checked ? 'text-primary' : 'text-on-surface'}`}>
                            {folder.name}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="rounded-full bg-primary/5 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-primary">
                              {t('agentBuilder.liveFolder')}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/30">
                              {t('agentBuilder.readySourceCount', { count: readySourceCount })}
                            </span>
                          </div>
                        </div>
                        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => updateKnowledgeFolders(folder.id, event.target.checked)}
                            className="peer absolute h-full w-full opacity-0 cursor-pointer z-10"
                          />
                          <div className={`h-7 w-7 rounded-xl border-2 transition-all duration-300 ${
                            checked 
                              ? 'border-primary bg-primary scale-110' 
                              : 'border-outline-variant/20 bg-background group-hover:border-primary/50'
                          }`} />
                          <span className={`material-symbols-outlined absolute text-white text-[18px] transition-all duration-300 ${
                            checked ? 'scale-100 opacity-100 rotate-0' : 'scale-50 opacity-0 rotate-12'
                          }`}>check</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between px-1 pt-2">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
                  {t('agentBuilder.individualSources')}
                </h4>
              </div>

              {knowledgeSources.length === 0 ? (
                <div className="flex flex-col items-center gap-4 rounded-[2.5rem] border border-dashed border-outline-variant/20 bg-surface-container-low/50 px-8 py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 text-primary/40">
                    <span className="material-symbols-outlined text-4xl">library_books</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-on-surface">{t('agentBuilder.noIndexedSources')}</p>
                    <p className="text-xs text-on-surface-variant/60">{t('agentBuilder.noSourcesBadge')}</p>
                  </div>
                </div>
              ) : (
                knowledgeSources.map((source) => {
                  const checked = attachedSourceIds.includes(source.id);
                  const isReady = isReadyKnowledgeSource(source);

                  return (
                    <label
                      key={source.id}
                      className={`group relative flex items-center justify-between gap-4 rounded-[1.75rem] border p-5 transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] cursor-pointer ${
                        isReady
                          ? checked 
                            ? 'border-primary/40 bg-primary/[0.04] ring-1 ring-inset ring-primary/10 shadow-lg shadow-primary/5' 
                            : 'border-outline-variant/10 bg-surface-container-lowest hover:border-outline-variant/30 hover:bg-surface-container-low hover:shadow-xl hover:shadow-black/5'
                          : 'border-outline-variant/5 bg-surface-container-high/20 grayscale opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pl-1">
                        <p className={`text-sm font-bold tracking-tight truncate pr-4 transition-colors ${checked ? 'text-primary' : 'text-on-surface'}`}>
                          {source.name}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] ${getKnowledgeStatusTone(source.status)}`}
                          >
                            {translateKnowledgeStatus(source.status, t)}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/30">
                            {t('agentBuilder.knowledgeChunks', {
                              count: source.chunk_count,
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!isReady}
                          onChange={(event) => updateKnowledgeSources(source.id, event.target.checked)}
                          className="peer absolute h-full w-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                        />
                        <div className={`h-7 w-7 rounded-xl border-2 transition-all duration-300 ${
                          checked 
                            ? 'border-primary bg-primary scale-110' 
                            : 'border-outline-variant/20 bg-background group-hover:border-primary/50'
                        }`} />
                        <span className={`material-symbols-outlined absolute text-white text-[18px] transition-all duration-300 ${
                          checked ? 'scale-100 opacity-100 rotate-0' : 'scale-50 opacity-0 rotate-12'
                        }`}>check</span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
            
            <div className="flex flex-col gap-3 pt-8 border-t border-outline-variant/10">
              <Link
                href="/knowledge"
                className="flex items-center justify-center gap-3 rounded-[1.25rem] border border-outline-variant/15 bg-surface-container-lowest px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-on-surface transition-all hover:bg-surface-container-low hover:border-outline-variant/30 hover:shadow-md active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-lg">sync</span>
                {t('agentBuilder.syncOperations')}
              </Link>
              <button
                onClick={() => removeOptionalNode('knowledge')}
                className="flex items-center justify-center gap-3 rounded-[1.25rem] bg-error/5 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-error transition-all hover:bg-error hover:text-on-error hover:shadow-lg hover:shadow-error/20 active:scale-[0.98]"
                title={t('agentBuilder.removeNode')}
              >
                <span className="material-symbols-outlined text-lg">delete</span>
                {t('agentBuilder.removeNode')}
              </button>
            </div>
          </div>
      );
    }

    if (toolNode && isToolNodeData(toolNode.data)) {
      const resolvedToolConnection = resolveToolNodeConnection(toolNode.data, connections);
      const toolData = resolvedToolConnection.data;
      const selectedConnection = resolvedToolConnection.displayConnection;
      const emailRecipientEmail =
        toolData.kind === 'gmail' || toolData.kind === 'outlook' ? toolData.recipientEmail ?? '' : '';
      const selectedCalendarConnectionId =
        toolData.kind === 'googlecalendar' ? toolData.connectionId : null;
      const calendarOptions = selectedCalendarConnectionId
        ? calendarOptionsByConnectionId[selectedCalendarConnectionId] ?? []
        : [];
      const resolvedCalendar =
        toolData.kind === 'googlecalendar'
          ? resolveCalendarOption(
              calendarOptions,
              (toolData as GoogleCalendarBuilderNodeData).calendarId,
            )
          : null;
      const resolvedCalendarTimezone =
        toolData.kind === 'googlecalendar'
          ? resolvedCalendar?.timezone ?? (toolData as GoogleCalendarBuilderNodeData).timezone
          : null;
      const calendarOptionsStatus = selectedCalendarConnectionId
        ? calendarOptionsStatusByConnectionId[selectedCalendarConnectionId] ?? 'idle'
        : 'idle';
      const selectedCalConnectionId =
        toolData.kind === 'cal' ? toolData.connectionId : null;
      const calEventTypes = selectedCalConnectionId
        ? calEventTypesByConnectionId[selectedCalConnectionId] ?? []
        : [];
      const calEventTypesStatus = selectedCalConnectionId
        ? calEventTypesStatusByConnectionId[selectedCalConnectionId] ?? 'idle'
        : 'idle';
      const hasValidSpecificRecipient =
        (toolData.kind === 'gmail' || toolData.kind === 'outlook') &&
        toolData.recipientMode === 'specific_email' &&
        Boolean(normalizeGmailRecipientEmail(toolData.recipientEmail));
      const enabledToolNames = getEnabledToolNames(toolData.kind, toolData);
      const enabledActionLabels = enabledToolNames.map(formatToolActionName);

      return (
        <div className="space-y-8">
          <div className="rounded-[2rem] border border-outline-variant/10 bg-primary/5 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-xl">info</span>
              </div>
              <p className="text-sm leading-relaxed text-on-surface-variant font-medium">
                {toolData.kind === 'gmail'
                  ? t('agentBuilder.useGmail')
                  : toolData.kind === 'outlook'
                    ? t('agentBuilder.useOutlook')
                    : toolData.kind === 'slack'
                      ? t('agentBuilder.useSlack')
                      : toolData.kind === 'hubspot'
                        ? t('agentBuilder.useHubSpot')
                        : toolData.kind === 'shopify'
                          ? t('agentBuilder.useShopify')
                          : toolData.kind === 'googleads'
                            ? t('agentBuilder.useGoogleAds')
                            : toolData.kind === 'cal'
                              ? t('agentBuilder.useCal')
                              : t('agentBuilder.useCalendar')}
              </p>
            </div>
          </div>

          {/* ── Connected account display card (read-only, no dropdown) ── */}
          <div className="space-y-6">
            <ConnectedAccountDisplay
              connection={selectedConnection}
              toolkitLabel={toolData.label}
              isConnecting={connectingToolKind === toolData.kind}
              onConnect={() => void handleConnectToolNode(toolData.kind)}
            />

            {(toolData.kind === 'gmail' || toolData.kind === 'outlook') && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
                    {t('agentBuilder.sendEmailTo')}
                  </label>
                  <div className="relative">
                    <select
                      value={toolData.recipientMode}
                      onChange={(event) =>
                        updateEmailRecipientSettings(toolNode.id, {
                          recipientMode:
                            event.target.value === 'specific_email'
                              ? 'specific_email'
                              : 'ai_decides',
                        })
                      }
                      className="w-full appearance-none rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-lowest px-5 py-4 text-sm font-bold text-on-surface shadow-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/5 cursor-pointer"
                    >
                      <option value="ai_decides">{t('agentBuilder.aiDecides')}</option>
                      <option value="specific_email">{t('agentBuilder.specificEmail')}</option>
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
                      expand_more
                    </span>
                  </div>
                </div>
                
                {toolData.recipientMode === 'specific_email' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div>
                      <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
                        {t('agentBuilder.specificEmailLabel')}
                      </label>
                      <input
                        type="email"
                        value={emailRecipientEmail}
                        onChange={(event) =>
                          updateEmailRecipientSettings(toolNode.id, {
                            recipientEmail: event.target.value || null,
                          })
                        }
                        placeholder={t('agentBuilder.specificEmailPlaceholder')}
                        className="w-full rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-lowest px-5 py-4 text-sm font-bold text-on-surface shadow-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
                      />
                    </div>
                    {!hasValidSpecificRecipient ? (
                      <div className="rounded-[1.25rem] border border-amber-500/20 bg-amber-500/5 px-5 py-4 flex items-start gap-3">
                        <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">warning</span>
                        <p className="text-xs leading-relaxed text-on-surface-variant/70 font-medium">
                          {t('agentBuilder.specificEmailWarning')}
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">
                    {t('agentBuilder.enabledActions')}
                  </span>
                  <span className="mt-1 text-lg font-bold text-on-surface">
                    {enabledToolNames.length} {enabledToolNames.length === 1 ? 'action' : 'actions'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionEditorNodeId(toolNode.id)}
                  className="flex h-12 items-center gap-3 rounded-2xl border border-outline-variant/15 px-5 text-xs font-black uppercase tracking-widest text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface hover:border-outline-variant/30 active:scale-95"
                >
                  <span className="material-symbols-outlined text-xl">tune</span>
                  {t('agentBuilder.editActions')}
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2.5">
                {enabledActionLabels.length > 0 ? (
                  <>
                    {enabledActionLabels.slice(0, 4).map((action) => (
                      <span
                        key={action}
                        className="rounded-full bg-primary/5 px-4 py-1.5 text-[11px] font-bold text-primary border border-primary/10"
                      >
                        {action}
                      </span>
                    ))}
                    {enabledActionLabels.length > 4 ? (
                      <span className="rounded-full bg-surface-container px-4 py-1.5 text-[11px] font-bold text-on-surface-variant border border-outline-variant/10">
                        +{enabledActionLabels.length - 4}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs font-medium text-on-surface-variant/40 italic py-2">
                    {t('agentBuilder.noMatchingActions')}
                  </p>
                )}
              </div>
            </div>

            {toolData.kind === 'googlecalendar' && (
              <div className="space-y-6 pt-2">
                <div>
                  <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
                    {t('agentBuilder.bookingCalendar')}
                  </label>
                  <div className="relative">
                    <select
                      value={(toolData as GoogleCalendarBuilderNodeData).calendarId ?? ''}
                      onChange={(event) => {
                        const nextCalendarId = event.target.value || null;
                        const selectedCalendar = resolveCalendarOption(calendarOptions, nextCalendarId);
                        updateGoogleCalendarSettings(toolNode.id, {
                          calendarId: nextCalendarId,
                          calendarLabel: nextCalendarId ? selectedCalendar?.summary ?? null : null,
                          timezone: selectedCalendar?.timezone ?? null,
                        });
                      }}
                      onKeyDown={stopBuilderFieldKeyDown}
                      disabled={!selectedCalendarConnectionId || calendarOptionsStatus === 'loading'}
                      className="w-full appearance-none rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-lowest px-5 py-4 text-sm font-bold text-on-surface shadow-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/5 cursor-pointer disabled:opacity-50"
                    >
                      <option value="">{t('agentBuilder.primaryCalendar')}</option>
                      {calendarOptions.map((calendar) => (
                        <option key={calendar.id} value={calendar.id}>
                          {calendar.primary
                            ? `${calendar.summary} (${t('agentBuilder.primaryCalendarSuffix')})`
                            : calendar.summary}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
                      expand_more
                    </span>
                  </div>
                  <div className="mt-3 flex items-start gap-2 px-1">
                    <span className="material-symbols-outlined text-sm text-primary/60 mt-0.5">
                      {calendarOptionsStatus === 'loading' ? 'sync' : calendarOptionsStatus === 'error' ? 'error' : 'help'}
                    </span>
                    <p className={`text-[11px] leading-relaxed font-medium ${calendarOptionsStatus === 'error' ? 'text-error' : 'text-on-surface-variant/60'}`}>
                      {calendarOptionsStatus === 'loading'
                        ? t('agentBuilder.loadingCalendars')
                        : calendarOptionsStatus === 'error'
                          ? t('agentBuilder.loadCalendarsFailed')
                          : t('agentBuilder.bookingCalendarDescription')}
                    </p>
                  </div>
                </div>

                {(toolData as GoogleCalendarBuilderNodeData).calendarId ? (
                  <label className="group flex items-start gap-4 rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-5 transition-all hover:bg-surface-container-low cursor-pointer shadow-sm">
                    <div className="relative flex h-6 w-6 shrink-0 items-center justify-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={(toolData as GoogleCalendarBuilderNodeData).includePrimaryCalendar}
                        onChange={(event) => {
                          updateGoogleCalendarSettings(toolNode.id, {
                            includePrimaryCalendar: event.target.checked,
                          });
                        }}
                        onKeyDown={stopBuilderFieldKeyDown}
                        className="peer absolute h-full w-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="h-6 w-6 rounded-lg border-2 border-outline-variant/20 transition-all peer-checked:border-primary peer-checked:bg-primary group-hover:border-primary/50" />
                      <span className="material-symbols-outlined absolute scale-0 text-white text-[16px] transition-transform peer-checked:scale-100">check</span>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-bold text-on-surface">
                        {t('agentBuilder.alsoBookPrimary')}
                      </p>
                      <p className="text-xs leading-relaxed text-on-surface-variant/60 font-medium">
                        {t('agentBuilder.alsoBookPrimaryDescription')}
                      </p>
                    </div>
                  </label>
                ) : null}

                <div className="rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1 mb-3">
                    {t('agentBuilder.bookingTimezone')}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 text-primary">
                      <span className="material-symbols-outlined text-xl">schedule</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-on-surface truncate">
                        {resolvedCalendarTimezone ?? timezone}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant/60 font-medium">
                        {resolvedCalendarTimezone
                          ? resolvedCalendar?.primary && !(toolData as GoogleCalendarBuilderNodeData).calendarId
                            ? t('agentBuilder.primaryCalendarResolved')
                            : t('agentBuilder.selectedCalendarResolved')
                          : t('agentBuilder.bookingTimezoneFallback')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {toolData.kind === 'cal' && (
              <div className="space-y-6 pt-2">
                <div>
                  <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
                    {t('agentBuilder.schedulingMode')}
                  </label>
                  <div className="relative">
                    <select
                      value={(toolData as CalBuilderNodeData).eventTypeMode}
                      onChange={(event) => {
                        const nextMode = event.target.value === 'specific_event_type' 
                          ? 'specific_event_type' 
                          : 'ai_decides';
                        updateNode(toolNode.id, (node) => {
                          if (node.data.kind !== 'cal') {
                            return node;
                          }
                          return {
                            ...node,
                            data: {
                              ...node.data,
                              eventTypeMode: nextMode,
                              eventTypeId: nextMode === 'ai_decides' ? null : node.data.eventTypeId,
                              eventTypeLabel: nextMode === 'ai_decides' ? null : node.data.eventTypeLabel,
                            } as CalBuilderNodeData,
                          };
                        });
                      }}
                      onKeyDown={stopBuilderFieldKeyDown}
                      className="w-full appearance-none rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-lowest px-5 py-4 text-sm font-bold text-on-surface shadow-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/5 cursor-pointer"
                    >
                      <option value="ai_decides">{t('agentBuilder.aiDecides')}</option>
                      <option value="specific_event_type">{t('agentBuilder.specificEventType')}</option>
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
                      expand_more
                    </span>
                  </div>
                  <div className="mt-3 flex items-start gap-2 px-1">
                    <span className="material-symbols-outlined text-sm text-primary/60 mt-0.5">info</span>
                    <p className="text-[11px] leading-relaxed text-on-surface-variant/60 font-medium">
                      {(toolData as CalBuilderNodeData).eventTypeMode === 'specific_event_type'
                        ? t('agentBuilder.specificEventTypeDesc')
                        : t('agentBuilder.aiDecidesEventTypeDesc')}
                    </p>
                  </div>
                </div>

                {(toolData as CalBuilderNodeData).eventTypeMode === 'specific_event_type' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
                      {t('agentBuilder.eventType')}
                    </label>
                    <div className="relative">
                      {calEventTypes.length > 0 ? (
                        <select
                          value={(toolData as CalBuilderNodeData).eventTypeId ?? ''}
                          onChange={(event) => {
                            const nextEventTypeId = event.target.value || null;
                            const selectedEventType = calEventTypes.find(et => et.id === nextEventTypeId);
                            updateNode(toolNode.id, (node) => {
                              if (node.data.kind !== 'cal') {
                                return node;
                              }
                              return {
                                ...node,
                                data: {
                                  ...node.data,
                                  eventTypeId: nextEventTypeId,
                                  eventTypeLabel: nextEventTypeId && selectedEventType ? selectedEventType.title : null,
                                } as CalBuilderNodeData,
                              };
                            });
                          }}
                          onKeyDown={stopBuilderFieldKeyDown}
                          disabled={calEventTypesStatus === 'loading'}
                          className="w-full appearance-none rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-lowest px-5 py-4 text-sm font-bold text-on-surface shadow-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/5 cursor-pointer disabled:opacity-50"
                        >
                          <option value="">{t('agentBuilder.selectEventType')}</option>
                          {calEventTypes.map((eventType) => (
                            <option key={eventType.id} value={eventType.id}>
                              {eventType.title}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={(toolData as CalBuilderNodeData).eventTypeId ?? ''}
                          onChange={(event) => {
                            const nextEventTypeId = event.target.value || null;
                            updateNode(toolNode.id, (node) => {
                              if (node.data.kind !== 'cal') {
                                return node;
                              }
                              return {
                                ...node,
                                data: {
                                  ...node.data,
                                  eventTypeId: nextEventTypeId,
                                } as CalBuilderNodeData,
                              };
                            });
                          }}
                          onKeyDown={stopBuilderFieldKeyDown}
                          placeholder={t('agentBuilder.eventTypeIdPlaceholder')}
                          className="w-full rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-lowest px-5 py-4 text-sm font-bold text-on-surface shadow-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
                        />
                      )}
                      <span className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
                        {calEventTypes.length > 0 ? 'expand_more' : 'edit'}
                      </span>
                    </div>
                    {calEventTypesStatus === 'loading' && (
                      <div className="mt-3 flex items-center gap-2 px-1 text-[11px] text-primary font-medium animate-pulse">
                        <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                        {t('agentBuilder.loadingEventTypes')}
                      </div>
                    )}
                    {calEventTypesStatus === 'error' && calEventTypes.length === 0 && (
                      <div className="mt-3 rounded-[1.25rem] border border-outline-variant/10 bg-surface-container px-5 py-4 text-[11px] leading-relaxed text-on-surface-variant/60 font-medium">
                        <span className="material-symbols-outlined text-sm text-primary/60 inline-block align-middle mr-1">info</span>
                        {t('agentBuilder.eventTypeManualHint')}{' '}
                        <a
                          href={t('agentBuilder.eventTypeHelpUrl')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline font-bold"
                        >
                          {t('agentBuilder.eventTypeManualHintLink')}
                        </a>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1 mb-3">
                    {t('agentBuilder.bookingTimezone')}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 text-primary">
                      <span className="material-symbols-outlined text-xl">schedule</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-on-surface truncate">
                        {(toolData as CalBuilderNodeData).timezone ?? timezone}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={() => removeOptionalNode(toolData.kind)}
              className="w-full flex items-center justify-center gap-3 rounded-[1.25rem] bg-error/5 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-error transition-all hover:bg-error hover:text-on-error hover:shadow-lg hover:shadow-error/20 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              {t('agentBuilder.removeNode')}
            </button>
          </div>
        </div>
      );
    }

    if (endChatNode && isEndChatNodeData(endChatNode.data)) {
      const timeoutValue =
        typeof endChatNode.data.inactivityTimeoutSeconds === 'number'
          ? String(endChatNode.data.inactivityTimeoutSeconds)
          : '';

      return (
        <div className="space-y-8">
          <div className="rounded-[2rem] border border-outline-variant/10 bg-primary/5 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-xl">info</span>
              </div>
              <p className="text-sm leading-relaxed text-on-surface-variant font-medium">
                {t('agentBuilder.endChatDescription')}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <label className="group flex items-start gap-4 rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-6 transition-all hover:bg-surface-container-low cursor-pointer shadow-sm">
              <div className="relative flex h-6 w-6 shrink-0 items-center justify-center mt-0.5">
                <input
                  type="checkbox"
                  checked={endChatNode.data.allowAssistantSuggestion}
                  onChange={(event) =>
                    updateNode(endChatNode.id, (node) => ({
                      ...node,
                      data: {
                        ...node.data,
                        allowAssistantSuggestion: event.target.checked,
                      },
                    }))
                  }
                  className="peer absolute h-full w-full opacity-0 cursor-pointer z-10"
                />
                <div className="h-6 w-6 rounded-lg border-2 border-outline-variant/20 transition-all peer-checked:border-primary peer-checked:bg-primary group-hover:border-primary/50" />
                <span className="material-symbols-outlined absolute scale-0 text-white text-[16px] transition-transform peer-checked:scale-100">check</span>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold text-on-surface">
                  {t('agentBuilder.assistantMaySuggestEnding')}
                </p>
                <p className="text-xs leading-relaxed text-on-surface-variant/60 font-medium">
                  {t('agentBuilder.assistantMaySuggestEndingDescription')}
                </p>
              </div>
            </label>

            <div>
              <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
                {t('agentBuilder.inactivityTimeout')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={timeoutValue}
                  onChange={(event) => {
                    const rawValue = event.target.value.trim();
                    updateNode(endChatNode.id, (node) => ({
                      ...node,
                      data: {
                        ...node.data,
                        inactivityTimeoutSeconds: rawValue
                          ? Math.max(1, Math.round(Number(rawValue) || 0))
                          : null,
                      },
                    }));
                  }}
                  onKeyDown={stopBuilderFieldKeyDown}
                  placeholder={t('agentBuilder.inactivityTimeoutPlaceholder')}
                  className="w-full rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-lowest px-5 py-4 text-sm font-bold text-on-surface shadow-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant/40">
                  {t('common.seconds')}
                </span>
              </div>
              <div className="mt-3 flex items-start gap-2 px-1">
                <span className="material-symbols-outlined text-sm text-primary/60 mt-0.5">help</span>
                <p className="text-[11px] leading-relaxed text-on-surface-variant/60 font-medium">
                  {t('agentBuilder.inactivityTimeoutHelp')}
                </p>
              </div>
            </div>

            <button
              onClick={() => removeOptionalNode('endchat')}
              className="w-full flex items-center justify-center gap-3 rounded-[1.25rem] bg-error/5 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-error transition-all hover:bg-error hover:text-on-error hover:shadow-lg hover:shadow-error/20 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              {t('agentBuilder.removeNode')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-on-surface-variant">
          {t('agentBuilder.finalMessageDescription')}
        </p>
      </div>
    );
  };

  return (
    <div className="animate-builder-enter flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant/10 bg-surface/90 px-5 backdrop-blur-xl lg:px-7">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/dashboard"
            aria-label={t('common.back')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-outline-variant/15 bg-surface-container-low text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </Link>
          
          <div className="flex min-w-0 items-center gap-4">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/45">
                {agent?.surface === 'automation'
                  ? t('agents.automation')
                  : isPrimaryMilo
                    ? t('agentBuilder.miloBuilder')
                    : t('agentBuilder.blueprint')}
              </p>
              <h1 className="truncate text-sm font-semibold tracking-tight text-on-surface sm:max-w-56">
                {isPrimaryMilo ? 'Milo' : name || agent?.name || t('agentBuilder.agentTitleFallback')}
              </h1>
            </div>

            <div className="h-4 w-[1px] bg-outline-variant/20" />

            <AgentViewTabs agentId={agentId} current="builder" surface={agent?.surface} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden flex-col items-end xl:flex">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 line-clamp-1">
              {t('agentBuilder.lastUpdate')}
            </span>
            <div className="flex items-center gap-1.5">
              {isDirty && !isSaving ? (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              ) : null}
              <p className="text-[10px] font-medium tracking-wide text-on-surface-variant whitespace-nowrap">
                {isSaving
                  ? t('agentBuilder.savingDraft')
                  : isDirty
                    ? t('agentBuilder.unsavedChanges')
                    : formatBuilderStatusNote(statusNote, language, t)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl bg-surface-container-low p-1 border border-outline-variant/10">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface disabled:opacity-20 active:scale-95"
                title={t('common.undo')}
              >
                <span className="material-symbols-outlined text-base">undo</span>
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface disabled:opacity-20 active:scale-95"
                title={t('common.redo')}
              >
                <span className="material-symbols-outlined text-base">redo</span>
              </button>
            </div>
            
            <button
              onClick={() => void saveDraft()}
              disabled={isSaving || !canEditCurrentAgent}
              className={`px-5 py-2.5 text-xs font-bold transition-all disabled:opacity-40 ${
                !isDirty && !isSaving
                  ? 'text-primary/70'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {isSaving
                ? t('agentBuilder.savingDraft')
                : isDirty
                  ? isPrimaryMilo ? t('agentBuilder.saveMiloChanges') : t('agentBuilder.saveDraft')
                  : t('agentBuilder.saved')}
            </button>

            {agent?.surface !== 'automation' && !isPrimaryMilo ? (
              <button
                onClick={() => void submitToAgentLibrary()}
                disabled={isSaving || isSubmittingLibrary || !canEditCurrentAgent}
                className="h-9 rounded-xl border border-outline-variant/15 bg-surface-container-low px-4 text-xs font-bold text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface active:scale-95 disabled:opacity-50"
              >
                {isSubmittingLibrary
                  ? t('agentBuilder.submittingLibrary')
                  : t('agentBuilder.publishToLibrary')}
              </button>
            ) : null}

            {agent?.surface === 'widget' ? (
              <button
                onClick={() => void publishVersion()}
                disabled={isPublishing}
                className="signature-gradient h-10 rounded-full px-6 text-xs font-bold shadow-xl shadow-black/25 transition-all hover:border-primary/25 hover:bg-primary/8 hover:shadow-2xl active:scale-95 disabled:opacity-60"
              >
                {isPublishing
                  ? t('agentBuilder.publishing')
                  : isPrimaryMilo
                    ? t('agentBuilder.updateMilo')
                    : t('agentBuilder.deployBlueprint')}
              </button>
            ) : null}

            {agent?.surface === 'automation' ? (
              automationRecord?.status === 'active' ? (
                <button
                  onClick={() => void updateAutomationStatus('pause')}
                  disabled={automationStatusAction !== null || !canEditCurrentAgent}
                  className="h-10 rounded-full border border-outline-variant/15 bg-surface-container-low px-6 text-xs font-bold text-on-surface-variant shadow-sm transition-all hover:bg-surface-container hover:text-on-surface active:scale-95 disabled:opacity-50"
                >
                  {automationStatusAction === 'pause'
                    ? t('agentBuilder.pausingTrigger')
                    : t('agentBuilder.pauseTrigger')}
                </button>
              ) : (
                <button
                  onClick={() => void updateAutomationStatus('activate')}
                  disabled={
                    automationStatusAction !== null ||
                    isSaving ||
                    !canEditCurrentAgent ||
                    !automationCanActivate
                  }
                  className="signature-gradient h-10 rounded-full px-6 text-xs font-bold shadow-xl shadow-black/25 transition-all hover:border-primary/25 hover:bg-primary/8 hover:shadow-2xl active:scale-95 disabled:opacity-50"
                  title={
                    automationCanActivate
                      ? t('agentBuilder.activationReady')
                      : t('agentBuilder.activationBlocked')
                  }
                >
                  {automationStatusAction === 'activate'
                    ? t('agentBuilder.activatingTrigger')
                    : t('agentBuilder.activateTrigger')}
                </button>
              )
            ) : null}
          </div>
        </div>
      </header>

      <div
        className={`relative grid min-h-0 flex-1 overflow-hidden ${
          selectedNode
            ? 'xl:grid-cols-[minmax(0,1fr)_24rem]'
            : 'xl:grid-cols-[minmax(0,1fr)]'
        }`}
      >
        <section
          className={`h-full min-h-0 border-b border-outline-variant/10 xl:border-b-0 ${
            selectedNode ? 'xl:border-r' : ''
          }`}
        >
          <div className="relative h-full w-full">
            <ReactFlow
              nodes={displayNodes}
              edges={edges}
              nodeTypes={BUILDER_NODE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => { setSelectedNodeId(null); setIsAddMenuOpen(false); }}
              onInit={setFlowInstance}
              fitView
              proOptions={{ hideAttribution: true }}
              className="bg-surface-container-lowest"
            >
              {displayNodes.length === 0 ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
                  <div className="max-w-md rounded-[2rem] border border-outline-variant/10 bg-surface/85 p-8 text-center shadow-premium backdrop-blur-xl">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-2xl">add_circle</span>
                    </div>
                    <h2 className="mt-5 text-lg font-black tracking-tight text-on-surface">
                      {t('agentBuilder.emptyCanvasTitle')}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-on-surface-variant/70">
                      {t('agentBuilder.emptyCanvasDescription')}
                    </p>
                  </div>
                </div>
              ) : null}
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
              <Controls className="!bottom-4 !left-4 !top-auto !right-auto" />
            
            </ReactFlow>

            {/* Bottom Floating Bar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
              {isAddMenuOpen && (
                <div className="mb-4 w-72 overflow-hidden rounded-[2rem] border border-outline-variant/10 bg-surface/95 shadow-premium backdrop-blur-3xl p-3 origin-bottom animate-slide-up-fade">
                  <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto pr-1">
                    {nodeLibraryItems.map((item, index) => {
                      const isTriggerAdded = item.key === 'trigger' && hasTriggerNode;
                      const isAgentAdded = item.key === 'agent' && hasAgentNode;
                      const isKnowledgeAdded = item.key === 'knowledge' && hasKnowledgeNode;
                      const isEndChatAdded = item.key === 'endchat' && hasEndChatNode;
                      const isFixed = item.fixed;
                      const isDisabled =
                        isFixed ||
                        isTriggerAdded ||
                        isAgentAdded ||
                        isKnowledgeAdded ||
                        isEndChatAdded ||
                        item.disabled;

                      return (
                        <button
                          key={item.key}
                          style={{ animationDelay: `${index * 50}ms` }}
                          onClick={() => {
                            if (item.disabled) {
                              showToast(t('settings.billing.featureLocked') || 'Please upgrade your plan to unlock this feature.', 'error');
                              return;
                            }
                            if (isFixed) return;
                            
                            if (item.key === 'trigger') handleAddTriggerNode();
                            else if (item.key === 'agent') handleAddAgentNode();
                            else if (item.key === 'knowledge') handleAddKnowledgeNode();
                            else if (item.key === 'endchat') handleAddEndChatNode();
                            else if (item.key === 'annotation') handleAddAnnotationNode();
                            else if (item.key === 'tools') setIsToolPickerOpen(true);
                            
                            setIsAddMenuOpen(false);
                          }}
                          disabled={isDisabled && !item.disabled}
                          className={`group/item flex items-center gap-3 rounded-2xl p-2.5 text-left transition-colors duration-200 animate-stagger-item ${
                            item.disabled
                              ? 'opacity-50 grayscale cursor-not-allowed'
                              : isFixed
                              ? 'bg-surface-container-lowest/30'
                              : isDisabled
                              ? 'opacity-60 cursor-not-allowed'
                              : 'hover:bg-surface-container-low hover:text-primary active:scale-[0.98]'
                          }`}
                        >
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
                            item.disabled || isFixed || isDisabled 
                            ? 'bg-surface-container-high text-on-surface-variant/40' 
                            : 'bg-primary/10 text-primary group-hover/item:bg-on-surface group-hover/item:text-surface'
                          }`}>
                            <span className="material-symbols-outlined text-lg">
                              {item.icon}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-[13px] font-bold tracking-tight truncate ${
                                item.disabled || isFixed || isDisabled ? 'text-on-surface-variant' : 'text-on-surface'
                              }`}>
                                {item.label}
                              </p>
                              {item.disabled && (
                                <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.15em] text-on-surface-variant/60">
                                  {t('common.locked')}
                                </span>
                              )}
                              {isFixed && !item.disabled && (
                                <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.15em] text-on-surface-variant/60">
                                  {t('common.fixed')}
                                </span>
                              )}
                              {(isTriggerAdded || isAgentAdded || isKnowledgeAdded || isEndChatAdded) && !isFixed && (
                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.15em] text-primary">
                                  {t('common.added')}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[10px] text-on-surface-variant/60 line-clamp-1">
                              {item.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                className={`flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full shadow-premium transition-all duration-300 hover:scale-105 active:scale-95 ${
                  isAddMenuOpen ? 'bg-surface text-primary border border-outline-variant/20' : 'app-primary-surface'
                }`}
                aria-label={t('agentBuilder.nodeLibraryTitle')}
              >
                <span className={`material-symbols-outlined text-2xl transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)] ${isAddMenuOpen ? 'rotate-45 scale-110' : ''}`}>
                  add
                </span>
              </button>
            </div>
          </div>

        </section>

        {selectedNode ? (
          <aside className="border-l border-outline-variant/10 overflow-y-auto bg-surface/90 backdrop-blur-3xl flex flex-col">
            {/* ── Compact node header ── */}
            <div className="shrink-0 sticky top-0 z-10 border-b border-outline-variant/10 bg-surface/95 backdrop-blur-xl px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Small icon chip */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {isPrimaryMilo && selectedNode.data.kind === 'agent' ? (
                      <MiloLogo size={28} className="h-7 w-7" />
                    ) : (
                      <span className="material-symbols-outlined text-base">
                        {selectedNode.data.icon || 'smart_toy'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <p className="text-[9px] font-black uppercase tracking-[0.28em] text-primary/60 leading-none">
                        {selectedNode.data.type}
                      </p>
                    </div>
                    <h2 className="mt-0.5 text-sm font-black tracking-tight text-on-surface truncate">
                      {selectedNode.data.label}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNodeId(null)}
                  className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-outline-variant/15 text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface active:scale-90"
                  aria-label={t('common.close')}
                  title={t('common.close')}
                >
                  <span className="material-symbols-outlined text-base transition-transform group-hover:rotate-90">close</span>
                </button>
              </div>
              {/* description strip */}
              {selectedNode.data.description ? (
                <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant/60 font-medium line-clamp-2 pl-11">
                  {selectedNode.data.description}
                </p>
              ) : null}
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto p-6">
              {renderInspectorBody()}
            </div>
          </aside>
        ) : null}
      </div>

      {isToolPickerOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/70 p-4 backdrop-blur-md sm:p-6">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[34rem] flex-col overflow-hidden rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-lowest shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
            <div className="shrink-0 border-b border-outline-variant/10 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                    {t('agentBuilder.nodeLibrary.tools')}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-on-surface">
                    {t('agentBuilder.chooseToolNode')}
                  </h3>
                </div>
                <button
                  onClick={() => setIsToolPickerOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant/15 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                  aria-label={t('common.close')}
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-4">
              {toolOptions.map((option) => (
                <button
                  key={option.kind}
                  onClick={() => void handleToolPickerAction(option.kind)}
                  disabled={option.isAdded || option.isConnecting}
                  className={`flex w-full items-start gap-3 rounded-[1.15rem] border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    option.canAdd
                      ? 'border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10'
                      : option.isWaiting
                        ? 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30'
                        : 'border-outline-variant/10 bg-background hover:border-primary/30 hover:bg-surface-container'
                  }`}
                >
                  {option.simpleIcon ? (
                    <SimpleIcon 
                      iconKey={option.simpleIcon} 
                      color={option.simpleIconColor}
                      size={24} 
                      className="mt-0.5 shrink-0 text-primary"
                    />
                  ) : (
                    <span className="material-symbols-outlined mt-0.5 shrink-0 text-primary">{option.icon}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm font-semibold leading-5 text-on-surface">
                        {option.displayName}
                      </p>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] ${
                          option.canAdd
                            ? 'bg-success/10 text-success'
                            : option.isWaiting
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {option.isConnecting ? (
                          <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
                        ) : null}
                        {option.stateLabel}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">
                      {option.description}
                    </p>
                    {!option.isAdded && !option.canAdd ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary">
                        <span className="material-symbols-outlined text-sm">
                          {option.isWaiting ? 'sync' : 'open_in_new'}
                        </span>
                        {option.isWaiting
                          ? t('agentBuilder.connectionPollingHint')
                          : t('agentBuilder.connectFromBuilderHint')}
                      </p>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {actionEditorNode && isToolNodeData(actionEditorNode.data) ? (() => {
        const toolkitSlug = actionEditorNode.data.kind;
        const actions = toolkitActionsBySlug[toolkitSlug] ?? [];
        const actionStatus = toolkitActionsStatusBySlug[toolkitSlug] ?? 'idle';
        const enabledTools = getEnabledToolNames(toolkitSlug, actionEditorNode.data);
        const enabledSet = new Set(enabledTools);
        const filteredActions = actions.filter((action) =>
          matchesToolActionQuery(action, deferredActionSearchQuery),
        );
        const recommendedActions = filteredActions.filter((action) => action.recommended);
        const allRecommendedActionNames = actions
          .filter((action) => action.recommended)
          .map((action) => action.name);
        const hasDisabledRecommendedActions = allRecommendedActionNames.some(
          (toolName) => !enabledSet.has(toolName),
        );
        const moreActions = filteredActions.filter((action) => !action.recommended);
        const availableMoreActions = moreActions.filter((action) => !enabledSet.has(action.name));
        const enabledMoreActions = moreActions.filter((action) => enabledSet.has(action.name));
        const shouldShowMoreActions = isMoreActionsOpen || Boolean(deferredActionSearchQuery);
        const toggleAction = (toolName: string, checked: boolean) => {
          updateToolActions(
            actionEditorNode.id,
            checked
              ? Array.from(new Set([...enabledTools, toolName]))
              : enabledTools.filter((item) => item !== toolName),
          );
        };
        const enableRecommendedActions = () => {
          updateToolActions(
            actionEditorNode.id,
            Array.from(new Set([...enabledTools, ...allRecommendedActionNames])),
          );
        };

        return (
          <div className="absolute inset-0 z-50 flex justify-end bg-background/40 backdrop-blur-sm transition-all animate-in fade-in duration-300">
            <div className="flex h-full w-full max-w-md flex-col border-l border-outline-variant/10 bg-surface/90 shadow-[0_0_100px_rgba(0,0,0,0.2)] backdrop-blur-3xl animate-in slide-in-from-right duration-500 ease-[cubic-bezier(0.2,0,0,1)]">
              <div className="shrink-0 border-b border-outline-variant/10 bg-surface-container-lowest/50 p-8">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-sm">construction</span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70">
                        {actionEditorNode.data.label}
                      </span>
                    </div>
                    <h3 className="mt-3 text-2xl font-black tracking-tight text-on-surface">
                      {t('agentBuilder.enabledActions')}
                    </h3>
                  </div>
                  <button
                    onClick={closeActionEditor}
                    className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/15 bg-surface-container-low text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface active:scale-90"
                  >
                    <span className="material-symbols-outlined text-lg transition-transform group-hover:rotate-90">close</span>
                  </button>
                </div>
                
                {actionStatus === 'ready' && (
                  <div className="mt-8 flex flex-col gap-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                        {t('agentBuilder.actionsSelectedSummary', {
                          enabled: enabledTools.length,
                          total: actions.length,
                        })}
                      </span>
                      {enabledTools.length > 0 && (
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>
                    <label className="relative flex items-center group">
                      <span className="material-symbols-outlined absolute left-4 text-xl text-on-surface-variant/40 group-focus-within:text-primary transition-colors">
                        search
                      </span>
                      <input
                        type="search"
                        value={actionSearchQuery}
                        onChange={(event) => setActionSearchQuery(event.target.value)}
                        placeholder={t('agentBuilder.searchActionsPlaceholder')}
                        className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container-low py-4 pl-12 pr-6 text-sm font-bold text-on-surface shadow-inner outline-none transition-all placeholder:text-on-surface-variant/30 focus:border-primary/30 focus:bg-surface-container-lowest focus:ring-4 focus:ring-primary/5"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-x-visible overflow-y-auto p-6 space-y-3">
                {actionStatus === 'loading' || actionStatus === 'idle' ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4 text-on-surface-variant">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                    <p className="text-xs font-black uppercase tracking-widest animate-pulse">{t('agentBuilder.loadingActions')}</p>
                  </div>
                ) : actionStatus === 'error' ? (
                  <div className="flex flex-col items-center gap-4 rounded-3xl border border-error/20 bg-error/5 p-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
                      <span className="material-symbols-outlined text-2xl">error</span>
                    </div>
                    <p className="text-sm font-bold text-error">{t('agentBuilder.loadActionsError')}</p>
                  </div>
                ) : (
                  <div className="space-y-6 pb-8">
                    {filteredActions.length > 0 ? (
                      <>
                        {recommendedActions.length > 0 || !deferredActionSearchQuery ? (
                          <section className="space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">
                                  {t('agentBuilder.recommendedActions')}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant/60">
                                  {t('agentBuilder.recommendedActionsHelp')}
                                </p>
                              </div>
                              {recommendedActions.length > 0 && hasDisabledRecommendedActions ? (
                                <button
                                  type="button"
                                  onClick={enableRecommendedActions}
                                  className="shrink-0 rounded-full border border-primary/15 bg-primary/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary transition-all hover:bg-primary/10 active:scale-95"
                                >
                                  {t('agentBuilder.enableRecommended')}
                                </button>
                              ) : null}
                            </div>

                            {recommendedActions.length > 0 ? (
                              recommendedActions.map((action) => {
                                const isEnabled = enabledSet.has(action.name);
                                return (
                                  <div
                                    key={action.name}
                                    onMouseLeave={() =>
                                      setActiveActionDescription((current) =>
                                        current === action.name ? null : current,
                                      )
                                    }
                                    className={`group relative flex w-full flex-col items-start gap-3 rounded-[1.75rem] border p-5 text-left transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] ${
                                      isEnabled
                                        ? 'border-primary/40 bg-primary/[0.04] ring-1 ring-inset ring-primary/10 shadow-lg shadow-primary/5'
                                        : 'border-outline-variant/10 bg-surface-container-lowest hover:border-outline-variant/30 hover:bg-surface-container-low hover:shadow-xl hover:shadow-black/5'
                                    }`}
                                  >
                                    <div className="flex w-full items-start justify-between gap-4">
                                      <button
                                        type="button"
                                        onClick={() => toggleAction(action.name, !isEnabled)}
                                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                                      >
                                        <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                                          <div className={`h-6 w-6 rounded-lg border-2 transition-all duration-300 ${
                                            isEnabled
                                              ? 'border-primary bg-primary scale-110'
                                              : 'border-outline-variant/20 bg-background group-hover:border-primary/50'
                                          }`} />
                                          <span className={`material-symbols-outlined absolute text-white text-[16px] transition-all duration-300 ${
                                            isEnabled ? 'scale-100 opacity-100 rotate-0' : 'scale-50 opacity-0 rotate-12'
                                          }`}>check</span>
                                        </div>
                                        <span className={`truncate text-sm font-bold tracking-tight transition-colors duration-300 ${
                                          isEnabled ? 'text-primary' : 'text-on-surface'
                                        }`}>
                                          {formatToolActionName(action.name)}
                                        </span>
                                      </button>
                                      <div className="flex items-center gap-2">
                                        {action.description ? (
                                          <button
                                            type="button"
                                            onClick={(event) => event.stopPropagation()}
                                            onMouseEnter={() => setActiveActionDescription(action.name)}
                                            onFocus={() => setActiveActionDescription(action.name)}
                                            onBlur={() =>
                                              setActiveActionDescription((current) =>
                                                current === action.name ? null : current,
                                              )
                                            }
                                            className="shrink-0"
                                            aria-label="Show action description"
                                          >
                                            <ActionDescriptionButton />
                                          </button>
                                        ) : null}
                                        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-primary border border-primary/10">
                                          {t('agentBuilder.recommendedActions')}
                                        </span>
                                      </div>
                                    </div>
                                    {action.description && activeActionDescription === action.name ? (
                                      <div className="w-full rounded-[1.25rem] border border-outline-variant/10 bg-surface/80 px-4 py-3">
                                        <p className="text-xs leading-relaxed text-on-surface-variant">
                                          {action.description}
                                        </p>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="rounded-[1.5rem] border border-dashed border-outline-variant/20 bg-surface-container-low/50 px-5 py-4 text-sm text-on-surface-variant/60">
                                {t('agentBuilder.noRecommendedActions')}
                              </div>
                            )}
                          </section>
                        ) : null}

                        <section className="rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/60">
                                {t('agentBuilder.moreActions')}
                              </p>
                              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant/60">
                                {t('agentBuilder.selectMoreAction')}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsMoreActionsOpen((current) => !current)}
                              disabled={moreActions.length === 0 && enabledMoreActions.length === 0}
                              className="inline-flex items-center gap-2 rounded-full border border-outline-variant/10 bg-surface px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-on-surface transition-all hover:border-outline-variant/20 hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span>{enabledMoreActions.length}</span>
                              <span className="material-symbols-outlined text-sm">
                                {shouldShowMoreActions ? 'expand_less' : 'expand_more'}
                              </span>
                            </button>
                          </div>

                          {enabledMoreActions.length > 0 ? (
                            <div className="mt-4 flex flex-wrap gap-2.5">
                              {enabledMoreActions.map((action) => (
                                <button
                                  key={action.name}
                                  type="button"
                                  onClick={() => toggleAction(action.name, false)}
                                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant/10 bg-surface-container px-4 py-2 text-[11px] font-bold text-on-surface transition-all hover:border-error/20 hover:bg-error/5 hover:text-error active:scale-95"
                                >
                                  <span>{formatToolActionName(action.name)}</span>
                                  <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {shouldShowMoreActions ? (
                            <div className="mt-4 space-y-3 border-t border-outline-variant/10 pt-4">
                              {availableMoreActions.length > 0 ? (
                                availableMoreActions.map((action) => (
                                  <div
                                    key={action.name}
                                    onMouseLeave={() =>
                                      setActiveActionDescription((current) =>
                                        current === action.name ? null : current,
                                      )
                                    }
                                    className="flex w-full flex-col gap-3 rounded-[1.25rem] border border-outline-variant/10 bg-surface px-4 py-3 text-left transition-all hover:border-primary/25 hover:bg-surface-container"
                                  >
                                    <div className="flex w-full items-center justify-between gap-4">
                                      <button
                                        type="button"
                                        onClick={() => toggleAction(action.name, true)}
                                        className="min-w-0 flex-1 text-left"
                                      >
                                        <p className="truncate text-sm font-bold tracking-tight text-on-surface">
                                          {formatToolActionName(action.name)}
                                        </p>
                                        <p className="mt-1 text-[11px] font-medium text-on-surface-variant/60">
                                          {t('agentBuilder.tapToAddAction')}
                                        </p>
                                      </button>
                                      <div className="flex shrink-0 items-center gap-2">
                                        {action.description ? (
                                          <button
                                            type="button"
                                            onClick={(event) => event.stopPropagation()}
                                            onMouseEnter={() => setActiveActionDescription(action.name)}
                                            onFocus={() => setActiveActionDescription(action.name)}
                                            onBlur={() =>
                                              setActiveActionDescription((current) =>
                                                current === action.name ? null : current,
                                              )
                                            }
                                            className="shrink-0"
                                            aria-label="Show action description"
                                          >
                                            <ActionDescriptionButton />
                                          </button>
                                        ) : null}
                                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                                          <span className="material-symbols-outlined text-lg">add</span>
                                        </span>
                                      </div>
                                    </div>
                                    {action.description && activeActionDescription === action.name ? (
                                      <div className="w-full rounded-[1.25rem] border border-outline-variant/10 bg-surface/80 px-4 py-3">
                                        <p className="text-xs leading-relaxed text-on-surface-variant">
                                          {action.description}
                                        </p>
                                      </div>
                                    ) : null}
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs leading-relaxed text-on-surface-variant/60">
                                  {moreActions.length === 0 && deferredActionSearchQuery
                                    ? t('agentBuilder.noMatchingActions')
                                    : t('agentBuilder.noMoreActions')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="mt-4 text-xs leading-relaxed text-on-surface-variant/60">
                              {t('agentBuilder.browseMoreActionsHint')}
                            </p>
                          )}
                        </section>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-outline-variant/20 bg-surface-container-low/50 px-8 py-20 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 text-primary/20 mb-4">
                          <span className="material-symbols-outlined text-4xl">search_off</span>
                        </div>
                        <p className="text-sm font-bold text-on-surface-variant/60">
                          {t('agentBuilder.noMatchingActions')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {actionStatus === 'ready' && (
                <div className="shrink-0 border-t border-outline-variant/10 bg-surface-container-lowest/80 p-6 backdrop-blur-xl">
                  <button
                    onClick={closeActionEditor}
                    className="app-primary-surface w-full rounded-[1.25rem] px-8 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98]"
                  >
                    {t('common.done')}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })() : null}

      {isHistoryOpen ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 px-4 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                  {t('agentBuilder.versionHistory')}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-on-surface">
                  {t('agentBuilder.publishedVersions')}
                </h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant/15 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="mt-5 flex-1 space-y-3 overflow-y-auto">
              {versions.length === 0 ? (
                <p className="rounded-2xl bg-background px-4 py-4 text-sm text-on-surface-variant">
                  {t('agentBuilder.noPublishedVersions')}
                </p>
              ) : (
                versions.map((version) => {
                  const isCurrent = agent?.published_version_id === version.id;

                  return (
                    <div
                      key={version.id}
                      className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-on-surface">
                            {t('agentBuilder.versionLabel', { version: version.version })}
                          </p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            {t('agentBuilder.publishedRelative', {
                              relative: formatRelativeDate(version.created_at, language),
                            })}
                          </p>
                        </div>
                        <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                          {isCurrent ? t('common.live') : t('agentBuilder.historyLabel')}
                        </span>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => void rollbackVersion(version.id)}
                          disabled={isCurrent || isRollingBackVersionId === version.id}
                          className="rounded-full border border-outline-variant/15 px-3 py-2 text-xs font-semibold text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isCurrent
                            ? t('agentBuilder.currentVersion')
                            : isRollingBackVersionId === version.id
                              ? t('agentBuilder.rollingBack')
                              : t('agentBuilder.rollback')}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
