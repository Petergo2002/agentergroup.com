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
import { useAppContext } from '@/components/app/AppContext';
import { SimpleIcon } from '@/components/icons/SimpleIcon';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { hasInternalAssistantsEnabled } from '@/lib/assistants/feature-flags';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/ToastProvider';
import { Modal } from '@/components/ui/Modal';
import { AgentModelPicker } from '@/components/agents/AgentModelPicker';
import { canEditAgentRecord } from '@/lib/agents/access';
import { AgentViewTabs } from '@/components/agents/AgentViewTabs';
import { buildInitialDefinition } from '@/lib/agents/defaults';
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
  AgentVersionRecord,
  BuilderDefinition,
  BuilderNodeData,
  BuilderNodeKind,
  CalBuilderNodeData,
  ConnectionRecord,
  EndChatBuilderNodeData,
  GmailBuilderNodeData,
  OutlookBuilderNodeData,
  GoogleCalendarBuilderNodeData,
  KnowledgeBuilderNodeData,
  KnowledgeSourceRecord,
} from '@/lib/types';

type BuilderFlowNode = Node<BuilderNodeData>;
type BuilderFlowEdge = Edge;
type ToolNodeKind = 'gmail' | 'outlook' | 'googlecalendar' | 'cal';
type ToolNodeData = GmailBuilderNodeData | OutlookBuilderNodeData | GoogleCalendarBuilderNodeData | CalBuilderNodeData;
type LibraryItemKey = 'knowledge' | 'tools' | 'endchat' | 'agent';
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
  googlecalendar: { x: 610, y: 360 },
  cal: { x: 610, y: 500 },
  endchat: { x: 1210, y: 150 },
};

const NODE_LIBRARY: NodeLibraryItem[] = [
  {
    key: 'agent',
    label: 'Agent Core',
    icon: 'smart_toy',
    description: 'The AI brain that processes and responds to users. Already on canvas.',
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

const TOOL_NODE_KINDS: ToolNodeKind[] = ['gmail', 'outlook', 'googlecalendar', 'cal'];

function getStarterPromptFields(prompts: string[]) {
  return Array.from({ length: 3 }, (_, index) => prompts[index] ?? '');
}

function getNodeLibraryText(key: LibraryItemKey, t: Translate) {
  switch (key) {
    case 'agent':
      return {
        label: t('agentBuilder.nodeLibrary.agent'),
        description: t('agentBuilder.nodeLibrary.agentDescription'),
      };
    case 'knowledge':
      return {
        label: t('agentBuilder.nodeLibrary.knowledge'),
        description: t('agentBuilder.nodeLibrary.knowledgeDescription'),
      };
    case 'tools':
      return {
        label: t('agentBuilder.nodeLibrary.tools'),
        description: t('agentBuilder.nodeLibrary.toolsDescription'),
      };
    case 'endchat':
      return {
        label: t('agentBuilder.nodeLibrary.endChat'),
        description: t('agentBuilder.nodeLibrary.endChatDescription'),
      };
  }
}

function getBuilderNodeText(kind: BuilderNodeKind, t: Translate) {
  switch (kind) {
    case 'trigger':
      return {
        label: t('agentBuilder.triggerLabel'),
        type: t('agentBuilder.triggerType'),
        description: t('agentBuilder.triggerDescription'),
      };
    case 'agent':
      return {
        label: t('agentBuilder.agentLabel'),
        type: t('agentBuilder.coreType'),
        description: t('agentBuilder.coreDescription'),
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
    .replace(/^(GMAIL|OUTLOOK|GOOGLECALENDAR|CAL)_/, '')
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

const AgentNode = memo(function AgentNode({ data, selected }: NodeProps<BuilderFlowNode>) {
  const { t } = useLanguage();
  const nodeText = getBuilderNodeText(data.kind, t);
  
  const label = nodeText?.label || data.label;
  const type = nodeText?.type || data.type || 'Blueprint Node';
  const description = nodeText?.description || data.description;

  const badgeToneClass = {
    default: 'bg-background text-on-surface-variant',
    success: 'bg-primary/10 text-primary',
    warning: 'bg-surface-container-high text-on-surface',
    error: 'bg-error-container text-on-error-container',
  }[data.badgeTone ?? 'default'];
  const confidenceLabel =
    'confidenceLabel' in data && typeof data.confidenceLabel === 'string'
      ? data.confidenceLabel
      : 'Confidence';

  return (
    <div
      className={`group/node min-w-[280px] rounded-[2.5rem] border border-outline-variant/20 bg-surface dark:bg-surface-bright shadow-premium transition-all duration-300 ease-out ring-1 ring-inset ring-outline-variant/5 ${
        selected ? 'ring-4 ring-primary/20 border-primary/30 shadow-primary/10' : 'hover:border-outline-variant/40 hover:shadow-2xl'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!h-3.5 !w-3.5 !-left-[8px] !border-[3px] !border-surface dark:!border-surface-bright !bg-primary !transition-transform duration-300 group-hover/node:scale-125"
      />
      <div
        className={`flex items-center justify-between rounded-t-[2.5rem] px-5 py-3.5 border-b border-outline-variant/10 ${
          selected
            ? 'bg-primary/[0.05] dark:bg-primary/[0.08]'
            : 'bg-surface-container-low dark:bg-surface-container/50'
        }`}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">
          {type}
        </span>
        <div className="flex items-center gap-1.5">
          {selected && (
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          )}
          <span className="material-symbols-outlined text-sm text-on-surface-variant/30">
            {selected ? 'tune' : 'drag_indicator'}
          </span>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 shadow-inner ring-1 ring-inset ring-primary/20">
            {(data as { simpleIcon?: string }).simpleIcon ? (
              <SimpleIcon 
                iconKey={(data as { simpleIcon?: string }).simpleIcon} 
                color={(data as { simpleIconColor?: string }).simpleIconColor}
                size={24} 
                className="text-primary"
              />
            ) : (
              <span className="material-symbols-outlined text-xl text-primary">{data.icon || 'smart_toy'}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-bold text-on-surface tracking-tight">{label}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant/70 italic line-clamp-2">{description}</p>
          </div>
        </div>
        {data.badgeText ? (
          <div className="flex justify-start">
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${badgeToneClass}`}
            >
              {data.badgeText}
            </span>
          </div>
        ) : null}
        {data.kind === 'agent' && data.showConfidence ? (
          <div className="space-y-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
              <div
                className="h-full bg-primary"
                style={{ width: `${data.confidenceValue ?? 80}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/60">
              <span>{confidenceLabel}</span>
              <span>{data.confidenceValue ?? 80}%</span>
            </div>
          </div>
        ) : null}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!h-3.5 !w-3.5 !-right-[8px] !border-[3px] !border-surface dark:!border-surface-bright !bg-primary !transition-transform duration-300 group-hover/node:scale-125"
      />
    </div>
  );
});

AgentNode.displayName = 'AgentNode';

// nodeTypes is now memoized inside AgentBuilderPage to prevent Fast Refresh warnings

function isToolNodeKind(kind: BuilderNodeKind): kind is ToolNodeKind {
  return kind === 'gmail' || kind === 'outlook' || kind === 'googlecalendar' || kind === 'cal';
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

function isBuilderNodeKind(value: unknown): value is BuilderNodeKind {
  return (
    value === 'trigger' ||
    value === 'agent' ||
    value === 'knowledge' ||
    value === 'gmail' ||
    value === 'outlook' ||
    value === 'googlecalendar' ||
    value === 'cal' ||
    value === 'endchat'
  );
}

function buildEdges(nodes: BuilderFlowNode[]): BuilderFlowEdge[] {
  const hasKnowledge = nodes.some((node) => node.data.kind === 'knowledge');
  const hasGmail = nodes.some((node) => node.data.kind === 'gmail');
  const hasOutlook = nodes.some((node) => node.data.kind === 'outlook');
  const hasCalendar = nodes.some((node) => node.data.kind === 'googlecalendar');
  const hasCal = nodes.some((node) => node.data.kind === 'cal');
  const hasEndChat = nodes.some((node) => node.data.kind === 'endchat');

  const edges: BuilderFlowEdge[] = [
    {
      id: 'e-trigger-agent',
      source: FIXED_NODE_IDS.trigger,
      target: FIXED_NODE_IDS.agent,
      animated: true,
      style: PRIMARY_EDGE_STYLE,
    },
  ];

  if (hasKnowledge) {
    edges.push({
      id: 'e-agent-knowledge',
      source: FIXED_NODE_IDS.agent,
      target: 'knowledge',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasGmail) {
    edges.push({
      id: 'e-agent-gmail',
      source: FIXED_NODE_IDS.agent,
      target: 'gmail',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasOutlook) {
    edges.push({
      id: 'e-agent-outlook',
      source: FIXED_NODE_IDS.agent,
      target: 'outlook',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasCalendar) {
    edges.push({
      id: 'e-agent-googlecalendar',
      source: FIXED_NODE_IDS.agent,
      target: 'googlecalendar',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasCal) {
    edges.push({
      id: 'e-agent-cal',
      source: FIXED_NODE_IDS.agent,
      target: 'cal',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasEndChat) {
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

function normalizeDefinition(
  definition: BuilderDefinition,
  surface: AgentRecord['surface'],
  connections: ConnectionRecord[],
  attachedConnectionIds: string[],
  attachedKnowledgeSourceIds: string[],
): NormalizedBuilderDefinition {
  const rawNodes = (Array.isArray(definition.nodes) ? definition.nodes : []) as BuilderFlowNode[];
  const nodesByKind = new Map<BuilderNodeKind, BuilderFlowNode>();
  let hasLegacyToolsNode = false;

  for (const node of rawNodes) {
    const inferredKind = inferNodeKind(node);

    if (inferredKind === 'legacy-tools') {
      hasLegacyToolsNode = true;
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

  const gmailNode = nodesByKind.get('gmail');
  const outlookNode = nodesByKind.get('outlook');
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

  const normalizedNodes: BuilderFlowNode[] = [
    createTriggerNode(nodesByKind.get('trigger')?.position ?? DEFAULT_POSITIONS.trigger),
    createAgentCoreNode(nodesByKind.get('agent')?.position ?? DEFAULT_POSITIONS.agent),
  ];

  if (knowledgeNode || knowledgeSourceIds.length > 0) {
    normalizedNodes.push(
      createKnowledgeNode(
        knowledgeNode?.position ?? DEFAULT_POSITIONS.knowledge,
        knowledgeSourceIds,
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

  if (endChatNode && isEndChatNodeData(endChatNode.data)) {
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
): BuilderFlowNode {
  const localizedText = getBuilderNodeText(node.data.kind, t);

  if (node.data.kind === 'knowledge') {
    const sourceCount = node.data.sourceIds.length;

    return {
      ...node,
      data: {
        ...node.data,
        ...localizedText,
        confidenceLabel: t('agentBuilder.confidence'),
        badgeText:
          sourceCount > 0
            ? t('agentBuilder.attachedBadge', { count: sourceCount })
            : t('agentBuilder.noSourcesBadge'),
        badgeTone: sourceCount > 0 ? 'success' : 'warning',
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

  return {
    ...node,
    data: {
      ...node.data,
      ...localizedText,
      confidenceLabel: t('agentBuilder.confidence'),
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

function getSelectedConnectionIdsFromNodes(nodes: BuilderFlowNode[]) {
  return Array.from(
    new Set(
      nodes.flatMap((node) =>
        isToolNodeData(node.data) && node.data.connectionId ? [node.data.connectionId] : [],
      ),
    ),
  );
}

function getSelectableConnections(
  connections: ConnectionRecord[],
  kind: ToolNodeKind,
  currentConnectionId: string | null,
) {
  const matchingConnections = getToolConnectionsByKind(connections, kind);
  const connectedConnections = matchingConnections.filter(
    (connection) => connection.status === 'connected',
  );

  if (!currentConnectionId) {
    return connectedConnections;
  }

  const currentConnection = matchingConnections.find(
    (connection) => connection.id === currentConnectionId,
  );

  if (!currentConnection) {
    return connectedConnections;
  }

  return connectedConnections.some((connection) => connection.id === currentConnection.id)
    ? connectedConnections
    : [currentConnection, ...connectedConnections];
}

export default function AgentBuilderPage() {
  const nodeTypes = useMemo(() => ({ agentNode: AgentNode }), []);
  const [supabase] = useState(() => createClient());
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { membership, user, workspace, subscription } = useAppContext();
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const agentId = params.id;
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
  const [versions, setVersions] = useState<AgentVersionRecord[]>([]);
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
  const [isRollingBackVersionId, setIsRollingBackVersionId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<BuilderStatusNote>({ kind: 'draftInitial' });
  const [isToolPickerOpen, setIsToolPickerOpen] = useState(false);
  const [actionEditorNodeId, setActionEditorNodeId] = useState<string | null>(null);
  const [actionSearchQuery, setActionSearchQuery] = useState('');
  const [toolkitActionsBySlug, setToolkitActionsBySlug] = useState<
    Record<string, ToolkitActionOption[]>
  >({});
  const [toolkitActionsStatusBySlug, setToolkitActionsStatusBySlug] = useState<
    Record<string, 'idle' | 'loading' | 'ready' | 'error'>
  >({});
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [pastStates, setPastStates] = useState<{ nodes: BuilderFlowNode[]; edges: BuilderFlowEdge[] }[]>([]);
  const [futureStates, setFutureStates] = useState<{ nodes: BuilderFlowNode[]; edges: BuilderFlowEdge[] }[]>([]);

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
      NODE_LIBRARY.map((item) => ({
        ...item,
        ...getNodeLibraryText(item.key, t),
        disabled: item.key === 'tools' && !subscription?.integrations_enabled,
      })),
    [subscription?.integrations_enabled, t],
  );
  const hasKnowledgeNode = useMemo(
    () => nodes.some((node) => node.data.kind === 'knowledge'),
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
          (node.data as KnowledgeBuilderNodeData).sourceIds.length > 0,
      ),
    [nodes],
  );
  const hasConfiguredTools = useMemo(
    () => nodes.some((node) => isToolNodeData(node.data) && Boolean(node.data.connectionId)),
    [nodes],
  );
  const displayNodes = useMemo(() => {
    const agentTitleFallback = t('agentBuilder.agentTitleFallback');
    const hasStarterPrompt = starterPromptFields.some((prompt) => prompt.trim().length > 0);

    return nodes.map((node) => {
      const enriched = enrichNodeForDisplay(node, connections, t);

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
      if (hasStarterPrompt) {
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
    name,
    nodes,
    starterPromptFields,
    t,
  ]);
  const selectedNode = useMemo(
    () => displayNodes.find((node) => node.id === selectedNodeId) ?? null,
    [displayNodes, selectedNodeId],
  );
  const canEditCurrentAgent = agent
    ? canEditAgentRecord(agent, user.id, membership.role)
    : true;

  const syncSelectedConnections = async (nextNodes: BuilderFlowNode[]) => {
    const selectedConnectionIds = getSelectedConnectionIdsFromNodes(nextNodes);

    await supabase.from('agent_connections').delete().eq('agent_id', agentId);

    if (selectedConnectionIds.length > 0) {
      const { error } = await supabase.from('agent_connections').insert(
        selectedConnectionIds.map((connectionId) => ({
          agent_id: agentId,
          connection_id: connectionId,
        })),
      );

      if (error) {
        throw error;
      }
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
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? t('agentBuilder.saveKnowledgeError'));
    }
  };

  const loadBuilder = useCallback(async () => {
    const [
      agentResult,
      draftResult,
      versionsResult,
      connectionsResult,
      attachedResult,
      authResult,
      knowledgeSourcesResult,
      attachedKnowledgeResult,
    ] = await Promise.all([
      supabase.from('agents').select('*').eq('id', agentId).single(),
      supabase.from('agent_drafts').select('*').eq('agent_id', agentId).maybeSingle(),
      supabase
        .from('agent_versions')
        .select('*')
        .eq('agent_id', agentId)
        .order('version', { ascending: false }),
      fetch('/api/connections/toolkits', {
        cache: 'no-store',
      }).then((response) => response.json().then((payload) => ({ ok: response.ok, payload }))),
      supabase.from('agent_connections').select('connection_id').eq('agent_id', agentId),
      supabase.auth.getUser(),
      supabase
        .from('knowledge_sources')
        .select('*')
        .order('updated_at', { ascending: false }),
      fetch(`/api/agents/${agentId}/knowledge`, {
        cache: 'no-store',
      }).then((response) => response.json().then((payload) => ({ ok: response.ok, payload }))),
    ]);

    if (agentResult.error) {
      throw agentResult.error;
    }

    if (knowledgeSourcesResult.error) {
      throw knowledgeSourcesResult.error;
    }

    if (!connectionsResult.ok) {
      throw new Error(connectionsResult.payload.error ?? t('connections.loadError'));
    }

    const chatConnections = ((connectionsResult.payload.connections ?? []) as ConnectionRecord[])
      .map((connection) => ({
        ...connection,
        status: getEffectiveConnectionStatus(connection),
      }))
      .filter((connection) => isChatIntegrationSlug(connection.toolkit_slug));
    const attachedConnectionIds = ((attachedResult.data ?? []) as Array<{ connection_id: string }>).map(
      (item) => item.connection_id,
    );

    if (!attachedKnowledgeResult.ok) {
      throw new Error(
        attachedKnowledgeResult.payload.error ??
          t('agentBuilder.loadKnowledgeAttachmentsError'),
      );
    }

    const attachedKnowledgeSourceIds = (
      ((attachedKnowledgeResult.payload.sources ?? []) as KnowledgeSourceRecord[]) ?? []
    ).map((item) => item.id);

    const loadedAgent = agentResult.data as AgentRecord;
    const fallbackDefinition = buildInitialDefinition('custom');
    const definition = (draftResult.data?.definition ?? fallbackDefinition) as BuilderDefinition;
    const normalized = normalizeDefinition(
      definition,
      loadedAgent.surface,
      chatConnections,
      attachedConnectionIds,
      attachedKnowledgeSourceIds,
    );

    setAgent(loadedAgent);
    setName(loadedAgent.name);
    setDescription(loadedAgent.description);
    setInstructions(definition.config?.instructions ?? loadedAgent.instructions);
    setModel(definition.config?.model ?? loadedAgent.model);
    setTimezone(definition.config?.timezone ?? loadedAgent.timezone ?? 'UTC');
    setStarterPromptFields(
      getStarterPromptFields(
        definition.config?.starterPrompts ?? loadedAgent.starter_prompts,
      ),
    );
    setDraftVersion(draftResult.data?.version ?? 1);
    setNodes(normalized.nodes);
    setEdges(normalized.edges);
    setVersions((versionsResult.data ?? []) as AgentVersionRecord[]);
    setConnections(chatConnections);
    setKnowledgeSources((knowledgeSourcesResult.data ?? []) as KnowledgeSourceRecord[]);
    setCurrentUserId(authResult.data.user?.id ?? null);
    setSelectedNodeId(null);
    setStatusNote(
      draftResult.data?.updated_at
        ? { kind: 'lastSaved', date: draftResult.data.updated_at }
        : { kind: 'draftInitial' },
    );

    if (normalized.requiresToolReview) {
      showToast(t('agentBuilder.multipleOldConnections'), 'error');
    }
  }, [agentId, setNodes, setEdges, showToast, supabase, t]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        await loadBuilder();
      } catch (error) {
        if (isMounted) {
          const message = error instanceof Error ? error.message : t('agentBuilder.loadError');
          showToast(message, 'error');
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
  }, [loadBuilder, showToast, t]);

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
    const nextNode =
      kind === 'gmail' ? createGmailNode() :
      kind === 'outlook' ? createOutlookNode() :
      kind === 'cal' ? createCalNode() :
      createGoogleCalendarNode();
    setNodes((currentNodes) => [...currentNodes, nextNode]);
    setSelectedNodeId(nextNode.id);
    setIsToolPickerOpen(false);
  };

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

  const updateToolConnection = (nodeId: string, connectionId: string | null) => {
    updateNode(nodeId, (node) => {
      if (!isToolNodeData(node.data)) {
        return node;
      }

      if (node.data.kind === 'googlecalendar') {
        return {
          ...node,
          data: {
            ...node.data,
            connectionId,
            timezone: null,
            calendarId: null,
            calendarLabel: null,
          },
        };
      }

      if (node.data.kind === 'cal') {
        return {
          ...node,
          data: {
            ...node.data,
            connectionId,
            timezone: null,
            eventTypeId: null,
            eventTypeLabel: null,
          },
        };
      }

      return {
        ...node,
        data: {
          ...node.data,
          connectionId,
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

  const buildDefinition = (): BuilderDefinition => ({
    nodes,
    edges: buildEdges(nodes),
    viewport: flowInstance?.getViewport(),
    config: {
      model,
      instructions,
      starterPrompts: starterPromptFields
        .map((item) => item.trim())
        .filter(Boolean),
      timezone,
    },
  });

  const saveDraft = async () => {
    if (!agent) {
      return;
    }

    setIsSaving(true);

    try {
      const definition = buildDefinition();

      const [agentResult, draftResult] = await Promise.all([
        supabase
          .from('agents')
          .update({
            name,
            description,
            instructions,
            model,
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

      await syncSelectedConnections(nodes);
      await syncSelectedKnowledgeSources(nodes);
      setAgent((current) =>
        current
          ? {
              ...current,
              name,
              description,
              instructions,
              model,
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
      showToast(t('agentBuilder.draftSaved'), 'success');
    } catch (error) {
      await loadBuilder().catch(() => undefined);
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
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('agentBuilder.publishError');
      showToast(message, 'error');
    } finally {
      setIsPublishing(false);
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

      await loadBuilder();
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

    return {
      kind,
      displayName: integration?.displayName ?? kind,
      description:
        kind === 'gmail'
          ? t('agentBuilder.gmailDescription')
          : kind === 'outlook'
            ? t('agentBuilder.outlookDescription')
            : kind === 'cal'
              ? t('agentBuilder.calDescription')
              : t('agentBuilder.googleCalendarDescription'),
      icon: integration?.icon ?? 'extension',
      simpleIcon: integration?.simpleIcon,
      simpleIconColor: integration?.simpleIconColor,
      isAdded,
      canAdd: connectedCount > 0 && !isAdded,
      stateLabel: isAdded
        ? t('common.added')
        : connectedCount > 0
          ? t('statuses.connection.connected')
          : t('agentBuilder.connectFirst'),
    };
  });

  const renderInspectorBody = () => {
    if (!selectedNode) {
      return null;
    }

    if (selectedNode.data.kind === 'trigger') {
      return (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-on-surface-variant">
            {t('agentBuilder.triggerDescription')}
          </p>
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
            <div>
              <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
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
                  {t('agentBuilder.operationalInstructionsHelp')}
                </p>
              </div>

              <Modal
                isOpen={isInstructionsModalOpen}
                onClose={() => setIsInstructionsModalOpen(false)}
                title={t('agentBuilder.operationalInstructions')}
                size="5xl"
              >
                <div className="flex flex-col gap-5">
                  <div className="relative group/modal">
                    <textarea
                      value={instructions}
                      onChange={(event) => setInstructions(event.target.value)}
                      onKeyDown={stopBuilderFieldKeyDown}
                      rows={16}
                      disabled={isOptimizingPrompt}
                      placeholder={t('agentBuilder.operationalInstructions')}
                      className={`h-[min(58vh,720px)] min-h-[320px] w-full resize-y rounded-[2rem] border border-outline-variant/10 px-5 py-5 text-base font-medium leading-relaxed outline-none shadow-inner transition-all sm:px-8 sm:py-8 sm:text-lg focus:border-primary/30 ${
                        isOptimizingPrompt ? 'bg-surface-container-lowest opacity-50 cursor-not-allowed' : 'bg-surface-container-low focus:bg-surface-container-lowest'
                      }`}
                      autoFocus
                    />
                    {isOptimizingPrompt && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[2rem] bg-surface-container-highest/10 backdrop-blur-[4px]">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                        <p className="mt-6 text-sm font-black tracking-[0.3em] text-primary uppercase animate-pulse">
                          {t('agentBuilder.optimizing')}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col-reverse gap-3 px-1 sm:flex-row sm:items-center sm:justify-between sm:px-2">
                    <button
                      onClick={handleOptimizePrompt}
                      disabled={isOptimizingPrompt}
                      className="flex items-center justify-center gap-3 rounded-[1.25rem] bg-surface-container-high px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-primary shadow-sm transition-all hover:bg-primary/5 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-xl">auto_fix_high</span>
                      {t('agentBuilder.optimizePrompt')}
                    </button>
                    <button
                      onClick={() => setIsInstructionsModalOpen(false)}
                      disabled={isOptimizingPrompt}
                      className="rounded-[1.25rem] bg-primary px-10 py-4 text-xs font-black uppercase tracking-[0.2em] text-on-primary shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-2xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('common.done')}
                    </button>
                  </div>
                </div>
              </Modal>
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

            <div>
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
            </div>
          </div>
        </div>
      );
    }

    if (knowledgeNode && isKnowledgeNodeData(knowledgeNode.data)) {
      const attachedSourceIds = knowledgeNode.data.sourceIds;
      const validAttachedSourceIds = attachedSourceIds.filter((id) =>
        knowledgeSources.some((source) => source.id === id)
      );

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
                    {validAttachedSourceIds.length === 1
                      ? t('agentBuilder.sourceCount', { count: validAttachedSourceIds.length })
                      : t('agentBuilder.sourceCountPlural', { count: validAttachedSourceIds.length })}
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-on-surface-variant/70 font-medium">
                  {t('agentBuilder.semanticSourcesDescription')}
                </p>
              </div>
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
            </div>
            
            <div className="space-y-4">
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
      const selectableConnections = getSelectableConnections(
        connections,
        toolNode.data.kind,
        toolNode.data.connectionId,
      );
      const selectedConnection = toolNode.data.connectionId
        ? connections.find((connection) => connection.id === toolNode.data.connectionId) ?? null
        : null;
      const hasConnectedOptions = selectableConnections.some(
        (connection) => connection.status === 'connected',
      );
      const emailRecipientEmail =
        toolNode.data.kind === 'gmail' || toolNode.data.kind === 'outlook' ? toolNode.data.recipientEmail ?? '' : '';
      const selectedCalendarConnectionId =
        toolNode.data.kind === 'googlecalendar' ? toolNode.data.connectionId : null;
      const calendarOptions = selectedCalendarConnectionId
        ? calendarOptionsByConnectionId[selectedCalendarConnectionId] ?? []
        : [];
      const resolvedCalendar =
        toolNode.data.kind === 'googlecalendar'
          ? resolveCalendarOption(
              calendarOptions,
              (toolNode.data as GoogleCalendarBuilderNodeData).calendarId,
            )
          : null;
      const resolvedCalendarTimezone =
        toolNode.data.kind === 'googlecalendar'
          ? resolvedCalendar?.timezone ?? (toolNode.data as GoogleCalendarBuilderNodeData).timezone
          : null;
      const calendarOptionsStatus = selectedCalendarConnectionId
        ? calendarOptionsStatusByConnectionId[selectedCalendarConnectionId] ?? 'idle'
        : 'idle';
      const selectedCalConnectionId =
        toolNode.data.kind === 'cal' ? toolNode.data.connectionId : null;
      const calEventTypes = selectedCalConnectionId
        ? calEventTypesByConnectionId[selectedCalConnectionId] ?? []
        : [];
      const calEventTypesStatus = selectedCalConnectionId
        ? calEventTypesStatusByConnectionId[selectedCalConnectionId] ?? 'idle'
        : 'idle';
      const hasValidSpecificRecipient =
        (toolNode.data.kind === 'gmail' || toolNode.data.kind === 'outlook') &&
        toolNode.data.recipientMode === 'specific_email' &&
        Boolean(normalizeGmailRecipientEmail(toolNode.data.recipientEmail));
      const enabledToolNames = getEnabledToolNames(toolNode.data.kind, toolNode.data);
      const enabledActionLabels = enabledToolNames.map(formatToolActionName);

      return (
        <div className="space-y-8">
          <div className="rounded-[2rem] border border-outline-variant/10 bg-primary/5 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-xl">info</span>
              </div>
              <p className="text-sm leading-relaxed text-on-surface-variant font-medium">
                {toolNode.data.kind === 'gmail'
                  ? t('agentBuilder.useGmail')
                  : toolNode.data.kind === 'outlook'
                    ? t('agentBuilder.useOutlook')
                    : toolNode.data.kind === 'cal'
                      ? t('agentBuilder.useCal')
                      : t('agentBuilder.useCalendar')}
              </p>
            </div>
          </div>

          {selectedConnection && selectedConnection.status !== 'connected' ? (
            <div className="rounded-[1.5rem] border border-error/20 bg-error/5 px-5 py-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-error text-xl">error</span>
              <p className="text-sm font-bold text-error">
                {t('agentBuilder.currentAccountStatus', {
                  status: translateConnectionStatus(selectedConnection.status, t),
                })}
              </p>
            </div>
          ) : null}

          <div className="space-y-6">
            {(hasConnectedOptions || selectedConnection) ? (
              <div>
                <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
                  {t('agentBuilder.connectedAccount')}
                </label>
                <div className="relative">
                  <select
                    value={toolNode.data.connectionId ?? ''}
                    onChange={(event) => updateToolConnection(toolNode.id, event.target.value || null)}
                    className="w-full appearance-none rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-lowest px-5 py-4 text-sm font-bold text-on-surface shadow-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/5 cursor-pointer"
                  >
                    <option value="">{t('agentBuilder.selectAccount')}</option>
                    {selectableConnections.map((connection) => (
                      <option key={connection.id} value={connection.id}>
                        {connection.account_label || connection.display_name}
                        {connection.status === 'connected'
                          ? ''
                          : ` (${translateConnectionStatus(connection.status, t)})`}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
                    expand_more
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-[2rem] border border-dashed border-outline-variant/20 bg-surface-container-low/50 px-6 py-8 text-center">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant/30 mb-3">account_circle</span>
                <p className="text-xs font-medium text-on-surface-variant/60 mb-5">
                  {t('agentBuilder.noConnectedAccount', { label: toolNode.data.label })}
                </p>
                <Link
                  href="/connections"
                  className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-primary transition-all hover:bg-primary/20 active:scale-95"
                >
                  <span className="material-symbols-outlined text-lg">link</span>
                  {t('agentBuilder.connectLabel', { label: toolNode.data.label })}
                </Link>
              </div>
            )}

            {(toolNode.data.kind === 'gmail' || toolNode.data.kind === 'outlook') && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
                    {t('agentBuilder.sendEmailTo')}
                  </label>
                  <div className="relative">
                    <select
                      value={toolNode.data.recipientMode}
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
                
                {toolNode.data.recipientMode === 'specific_email' && (
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

            {toolNode.data.kind === 'googlecalendar' && (
              <div className="space-y-6 pt-2">
                <div>
                  <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
                    {t('agentBuilder.bookingCalendar')}
                  </label>
                  <div className="relative">
                    <select
                      value={(toolNode.data as GoogleCalendarBuilderNodeData).calendarId ?? ''}
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

                {(toolNode.data as GoogleCalendarBuilderNodeData).calendarId ? (
                  <label className="group flex items-start gap-4 rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-5 transition-all hover:bg-surface-container-low cursor-pointer shadow-sm">
                    <div className="relative flex h-6 w-6 shrink-0 items-center justify-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={(toolNode.data as GoogleCalendarBuilderNodeData).includePrimaryCalendar}
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
                          ? resolvedCalendar?.primary && !(toolNode.data as GoogleCalendarBuilderNodeData).calendarId
                            ? t('agentBuilder.primaryCalendarResolved')
                            : t('agentBuilder.selectedCalendarResolved')
                          : t('agentBuilder.bookingTimezoneFallback')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {toolNode.data.kind === 'cal' && (
              <div className="space-y-6 pt-2">
                <div>
                  <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
                    {t('agentBuilder.schedulingMode')}
                  </label>
                  <div className="relative">
                    <select
                      value={(toolNode.data as CalBuilderNodeData).eventTypeMode}
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
                      {(toolNode.data as CalBuilderNodeData).eventTypeMode === 'specific_event_type'
                        ? t('agentBuilder.specificEventTypeDesc')
                        : t('agentBuilder.aiDecidesEventTypeDesc')}
                    </p>
                  </div>
                </div>

                {(toolNode.data as CalBuilderNodeData).eventTypeMode === 'specific_event_type' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="mb-2.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1">
                      {t('agentBuilder.eventType')}
                    </label>
                    <div className="relative">
                      {calEventTypes.length > 0 ? (
                        <select
                          value={(toolNode.data as CalBuilderNodeData).eventTypeId ?? ''}
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
                          value={(toolNode.data as CalBuilderNodeData).eventTypeId ?? ''}
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
                        {(toolNode.data as CalBuilderNodeData).timezone ?? timezone}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={() => removeOptionalNode(toolNode.data.kind)}
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
                {t('agentBuilder.blueprint')}
              </span>
              <span className="text-on-surface-variant/20 text-[10px]">/</span>
              <h1 className="font-headline text-xl font-bold tracking-tight text-on-surface">
                {name || agent?.name || t('agentBuilder.agentTitleFallback')}
              </h1>
            </div>

            <div className="h-4 w-[1px] bg-outline-variant/20" />

            <AgentViewTabs agentId={agentId} current="builder" />
          </div>
        </div>

        <div className="hidden items-center gap-6 lg:flex">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">
                {t('agentBuilder.nodes')}
              </span>
              <span className="text-sm font-headline font-bold text-on-surface">{nodes.length}</span>
            </div>
            <div className="h-4 w-[1px] bg-outline-variant/20" />
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">
                {t('agentBuilder.connections')}
              </span>
              <span className="text-sm font-headline font-bold text-on-surface">{edges.length}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden flex-col items-end xl:flex">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 line-clamp-1">
              {t('agentBuilder.lastUpdate')}
            </span>
            <p className="text-[10px] font-medium tracking-wide text-on-surface-variant whitespace-nowrap">
              {formatBuilderStatusNote(statusNote, language, t)}
            </p>
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
              className="px-5 py-2.5 text-xs font-bold text-on-surface-variant transition-all hover:text-on-surface disabled:opacity-40"
            >
              {isSaving ? t('agentBuilder.savingDraft') : t('agentBuilder.saveDraft')}
            </button>

            {agent?.surface === 'widget' ? (
              <button
                onClick={() => void publishVersion()}
                disabled={isPublishing}
                className="signature-gradient h-10 rounded-full px-6 text-xs font-bold shadow-xl shadow-black/25 transition-all hover:border-primary/25 hover:bg-primary/8 hover:shadow-2xl active:scale-95 disabled:opacity-60"
              >
                {isPublishing ? t('agentBuilder.publishing') : t('agentBuilder.deployBlueprint')}
              </button>
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
        <div className="group absolute bottom-0 left-0 top-0 z-30 w-85 -translate-x-[calc(100%-1.5rem)] transition-all duration-700 ease-[cubic-bezier(0.2,0,0,1)] hover:translate-x-0">
          <aside className="relative flex h-full flex-col border-r border-outline-variant/10 bg-surface/90 p-8 shadow-[20px_0_80px_rgba(0,0,0,0.15)] backdrop-blur-3xl">
            {/* The Handle */}
            <div className="absolute bottom-0 right-0 top-0 flex w-6 items-center justify-center transition-opacity duration-300 group-hover:opacity-0">
              <div className="flex h-32 w-full flex-col items-center justify-center gap-4">
                <div className="h-full w-[2px] rounded-full bg-primary/20" />
                <span className="[writing-mode:vertical-lr] text-[10px] font-bold uppercase tracking-[0.3em] text-primary/40 rotate-180">
                  {t('agentBuilder.nodeLibraryTitle')}
                </span>
                <div className="h-full w-[2px] rounded-full bg-primary/20" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto opacity-0 transition-all duration-500 delay-100 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-lg">grid_view</span>
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-primary">
                  {t('agentBuilder.nodeLibraryTitle')}
                </p>
              </div>
              
              <p className="mt-4 text-xs leading-6 text-on-surface-variant/70 font-medium">
                {t('agentBuilder.nodeLibraryDescription')}
              </p>

              <div className="mt-8 space-y-4">
                {nodeLibraryItems.map((item) => {
                  const isKnowledgeAdded = item.key === 'knowledge' && hasKnowledgeNode;
                  const isEndChatAdded = item.key === 'endchat' && hasEndChatNode;
                  const isFixed = item.fixed;
                  const isDisabled = isKnowledgeAdded || isEndChatAdded || isFixed || item.disabled;

                  return (
                    <button
                      key={item.key}
                      onClick={() =>
                        item.disabled
                          ? showToast(t('settings.billing.featureLocked') || 'Please upgrade your plan to unlock this feature.', 'error')
                          : item.key === 'knowledge'
                          ? handleAddKnowledgeNode()
                          : item.key === 'endchat'
                          ? handleAddEndChatNode()
                          : item.key === 'tools'
                          ? setIsToolPickerOpen(true)
                          : undefined
                      }
                      disabled={isDisabled && !item.disabled}
                      className={`group/item relative flex w-full items-start gap-4 rounded-[2rem] border p-5 text-left transition-all duration-300 ${
                        item.disabled
                          ? 'border-outline-variant/5 bg-surface-container-low/40 opacity-50 grayscale cursor-not-allowed'
                          : isFixed
                          ? 'border-dashed border-outline-variant/20 bg-surface-container-lowest/30 cursor-default opacity-80'
                          : isDisabled
                          ? 'border-outline-variant/10 bg-surface-container-low/50 opacity-60 cursor-not-allowed'
                          : 'border-outline-variant/10 bg-surface-container-lowest hover:border-primary/40 hover:bg-surface-container-low hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98]'
                      }`}
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 ${
                        item.disabled || isFixed || isDisabled 
                        ? 'bg-surface-container-high text-on-surface-variant/40' 
                        : 'bg-primary/10 text-primary group-hover/item:bg-primary group-hover/item:text-on-primary'
                      }`}>
                        <span className="material-symbols-outlined text-xl">
                          {item.icon}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-bold tracking-tight ${
                            item.disabled || isFixed || isDisabled ? 'text-on-surface-variant' : 'text-on-surface'
                          }`}>
                            {item.label}
                          </p>
                          {item.disabled ? (
                            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-on-surface-variant/60 border border-outline-variant/10">
                              {t('common.locked')}
                            </span>
                          ) : isFixed ? (
                            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-on-surface-variant/60">
                              {t('common.fixed')}
                            </span>
                          ) : isKnowledgeAdded || isEndChatAdded ? (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-primary">
                              {t('common.added')}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-on-surface-variant/60 line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        <section
          className={`h-full min-h-0 border-b border-outline-variant/10 xl:border-b-0 ${
            selectedNode ? 'xl:border-r' : ''
          }`}
        >
          <div className="h-full w-full">
            <ReactFlow
              nodes={displayNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              onInit={setFlowInstance}
              fitView
              proOptions={{ hideAttribution: true }}
              className="bg-background"
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
              <Controls className="!bottom-4 !left-4 !top-auto !right-auto" />
            </ReactFlow>
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
                    <span className="material-symbols-outlined text-base">
                      {selectedNode.data.icon || 'smart_toy'}
                    </span>
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
            <div className="flex-1 overflow-y-auto p-8">
              {renderInspectorBody()}
            </div>
          </aside>
        ) : null}
      </div>

      {isToolPickerOpen ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-2xl">
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
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {toolOptions.map((option) => (
                <button
                  key={option.kind}
                  onClick={() => handleAddToolNode(option.kind)}
                  disabled={!option.canAdd}
                  className="flex w-full items-start gap-3 rounded-2xl border border-outline-variant/10 bg-background px-4 py-4 text-left transition-colors hover:border-primary/30 hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {option.simpleIcon ? (
                    <SimpleIcon 
                      iconKey={option.simpleIcon} 
                      color={option.simpleIconColor}
                      size={24} 
                      className="text-primary"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-primary">{option.icon}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-on-surface">{option.displayName}</p>
                      <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                        {option.stateLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                      {option.description}
                    </p>
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
        const toggleAction = (toolName: string, checked: boolean) => {
          updateToolActions(
            actionEditorNode.id,
            checked
              ? Array.from(new Set([...enabledTools, toolName]))
              : enabledTools.filter((item) => item !== toolName),
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

              <div className="flex-1 overflow-y-auto p-6 space-y-3">
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
                  <div className="space-y-3 pb-8">
                    {filteredActions.length > 0 ? (
                      filteredActions.map((action) => {
                        const isEnabled = enabledSet.has(action.name);
                        return (
                          <button
                            key={action.name}
                            onClick={() => toggleAction(action.name, !isEnabled)}
                            className={`group relative flex w-full flex-col items-start gap-3 rounded-[1.75rem] border p-5 text-left transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] ${
                              isEnabled
                                ? 'border-primary/40 bg-primary/[0.04] ring-1 ring-inset ring-primary/10 shadow-lg shadow-primary/5'
                                : 'border-outline-variant/10 bg-surface-container-lowest hover:border-outline-variant/30 hover:bg-surface-container-low hover:shadow-xl hover:shadow-black/5'
                            }`}
                          >
                            <div className="flex w-full items-start justify-between gap-4">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
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
                                <span className={`text-sm font-bold tracking-tight truncate transition-colors duration-300 ${
                                  isEnabled ? 'text-primary' : 'text-on-surface'
                                }`}>
                                  {formatToolActionName(action.name)}
                                </span>
                              </div>
                              {action.recommended && (
                                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-primary border border-primary/10">
                                  {t('agentBuilder.recommendedActions')}
                                </span>
                              )}
                            </div>
                            
                            {(action.description || action.name) && (
                              <p className={`pl-10 text-xs leading-relaxed transition-colors duration-300 line-clamp-2 font-medium ${
                                isEnabled ? 'text-primary/60' : 'text-on-surface-variant/60'
                              }`}>
                                {action.description || action.name}
                              </p>
                            )}
                          </button>
                        );
                      })
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
                    className="w-full rounded-[1.25rem] bg-primary px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-on-primary shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-2xl hover:shadow-primary/30 active:scale-[0.98]"
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
