'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/ToastProvider';
import { AgentViewTabs } from '@/components/agents/AgentViewTabs';
import { buildInitialDefinition } from '@/lib/agents/defaults';
import { DEFAULT_END_CHAT_INACTIVITY_TIMEOUT_SECONDS } from '@/lib/end-chat';
import { normalizeGmailRecipientEmail } from '@/lib/gmail';
import type { GoogleCalendarListItem } from '@/lib/google-calendar';
import { getSupportedIntegration, isChatIntegrationSlug } from '@/lib/integrations';
import { getKnowledgeStatusTone, isReadyKnowledgeSource } from '@/lib/knowledge';
import { formatRelativeDate } from '@/lib/utils';
import type {
  AgentRecord,
  AgentVersionRecord,
  BuilderDefinition,
  BuilderNodeData,
  BuilderNodeKind,
  ConnectionRecord,
  EndChatBuilderNodeData,
  GmailBuilderNodeData,
  GoogleCalendarBuilderNodeData,
  KnowledgeBuilderNodeData,
  KnowledgeSourceRecord,
} from '@/lib/types';
import * as simpleIcons from 'simple-icons';

function SimpleIcon({ iconKey, color, size = 24, className = '' }: { iconKey?: string; color?: string; size?: number; className?: string }) {
  if (!iconKey) return null;
  
  const icon = (simpleIcons as Record<string, { path: string }>)[iconKey];
  if (!icon?.path) return null;
  
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill={color || "currentColor"}
      className={className}
      dangerouslySetInnerHTML={{ __html: `<path d="${icon.path}"/>` }}
    />
  );
}

type BuilderFlowNode = Node<BuilderNodeData>;
type BuilderFlowEdge = Edge;
type ToolNodeKind = 'gmail' | 'googlecalendar';
type ToolNodeData = GmailBuilderNodeData | GoogleCalendarBuilderNodeData;
type LibraryItemKey = 'knowledge' | 'tools' | 'endchat' | 'agent' | 'output';

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

const FIXED_NODE_IDS = {
  trigger: 'trigger',
  agent: 'agent',
  output: 'response',
} as const;

const DEFAULT_EDGE_STYLE = {
  stroke: 'var(--color-outline-variant)',
  strokeWidth: 2,
  opacity: 0.4,
};

const PRIMARY_EDGE_STYLE = {
  stroke: 'var(--color-primary)',
  strokeWidth: 2,
};

const DEFAULT_POSITIONS: Record<BuilderNodeKind, { x: number; y: number }> = {
  trigger: { x: 40, y: 150 },
  agent: { x: 320, y: 150 },
  knowledge: { x: 610, y: 70 },
  gmail: { x: 610, y: 220 },
  googlecalendar: { x: 610, y: 360 },
  output: { x: 930, y: 150 },
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
  {
    key: 'output',
    label: 'Response',
    icon: 'output',
    description: 'How the agent delivers its final response. Already on canvas.',
    fixed: true,
  },
];

const MODEL_OPTIONS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-mini',
  'anthropic/claude-3.7-sonnet',
  'google/gemini-2.5-flash',
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

const TOOL_NODE_KINDS: ToolNodeKind[] = ['gmail', 'googlecalendar'];

function getStarterPromptFields(prompts: string[]) {
  return Array.from({ length: 3 }, (_, index) => prompts[index] ?? '');
}

function AgentNode({ data, selected }: NodeProps<BuilderFlowNode>) {
  const badgeToneClass = {
    default: 'bg-background text-on-surface-variant',
    success: 'bg-primary/10 text-primary',
    warning: 'bg-surface-container-high text-on-surface',
    error: 'bg-error-container text-on-error-container',
  }[data.badgeTone ?? 'default'];

  return (
    <div
      className={`w-56 rounded-2xl bg-surface-container-lowest shadow-lg transition-all ${
        selected ? 'ring-8 ring-primary/5 shadow-xl' : 'shadow-lg'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !-left-[7px] !border-2 !border-surface-container-lowest !bg-primary"
      />
      <div
        className={`flex items-center justify-between rounded-t-[1rem] px-3 py-2 ${
          selected
            ? 'bg-primary/5'
            : 'bg-surface-container'
        }`}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/70">
          {data.type || 'Node'}
        </span>
        <span className="material-symbols-outlined text-sm text-on-surface-variant/40">
          {selected ? 'tune' : 'more_horiz'}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            {(data as { simpleIcon?: string }).simpleIcon ? (
              <SimpleIcon 
                iconKey={(data as { simpleIcon?: string }).simpleIcon} 
                color={(data as { simpleIconColor?: string }).simpleIconColor}
                size={22} 
                className="text-primary"
              />
            ) : (
              <span className="material-symbols-outlined text-base">{data.icon || 'smart_toy'}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-on-surface">{data.label}</p>
            <p className="text-[11px] leading-5 text-on-surface-variant">{data.description}</p>
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
              <span>Confidence</span>
              <span>{data.confidenceValue ?? 80}%</span>
            </div>
          </div>
        ) : null}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !-right-[7px] !border-2 !border-surface-container-lowest !bg-primary"
      />
    </div>
  );
}

const nodeTypes = {
  agentNode: AgentNode,
};

function isToolNodeKind(kind: BuilderNodeKind): kind is ToolNodeKind {
  return kind === 'gmail' || kind === 'googlecalendar';
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
    value === 'googlecalendar' ||
    value === 'endchat' ||
    value === 'output'
  );
}

function getAgentNodeId(nodes: BuilderFlowNode[]) {
  return nodes.find((node) => node.data.kind === 'agent')?.id ?? FIXED_NODE_IDS.agent;
}

function buildEdges(nodes: BuilderFlowNode[]): BuilderFlowEdge[] {
  const hasKnowledge = nodes.some((node) => node.data.kind === 'knowledge');
  const hasGmail = nodes.some((node) => node.data.kind === 'gmail');
  const hasCalendar = nodes.some((node) => node.data.kind === 'googlecalendar');
  const hasEndChat = nodes.some((node) => node.data.kind === 'endchat');

  const edges: BuilderFlowEdge[] = [
    {
      id: 'e-trigger-agent',
      source: FIXED_NODE_IDS.trigger,
      target: FIXED_NODE_IDS.agent,
      animated: true,
      style: PRIMARY_EDGE_STYLE,
    },
    {
      id: 'e-agent-response',
      source: FIXED_NODE_IDS.agent,
      target: FIXED_NODE_IDS.output,
      style: DEFAULT_EDGE_STYLE,
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

  if (hasCalendar) {
    edges.push({
      id: 'e-agent-googlecalendar',
      source: FIXED_NODE_IDS.agent,
      target: 'googlecalendar',
      style: DEFAULT_EDGE_STYLE,
    });
  }

  if (hasEndChat) {
    edges.push({
      id: 'e-response-endchat',
      source: FIXED_NODE_IDS.output,
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
    draggable: false,
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
    draggable: false,
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
      ...(data ?? {}),
    } as BuilderNodeData,
  };
}

function createOutputNode(
  position = DEFAULT_POSITIONS.output,
  data?: Partial<BuilderNodeData>,
): BuilderFlowNode {
  return {
    id: FIXED_NODE_IDS.output,
    type: 'agentNode',
    position,
    draggable: false,
    data: {
      kind: 'output',
      label: 'Assistant Response',
      type: 'Output',
      icon: 'send',
      description: 'Returns the final response to the user.',
      status: 'idle',
      locked: true,
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

  if (label === 'google calendar') {
    return 'googlecalendar';
  }

  if (label === 'assistant response' || type === 'output') {
    return 'output';
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

function normalizeDefinition(
  definition: BuilderDefinition,
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
  const calendarNode = nodesByKind.get('googlecalendar');
  const endChatNode = nodesByKind.get('endchat');
  const gmailConnectionId = pickPreferredConnectionId(
    connections,
    attachedConnectionIds,
    'gmail',
    gmailNode && isToolNodeData(gmailNode.data) ? gmailNode.data.connectionId : null,
  );
  const googleCalendarConnectionId = pickPreferredConnectionId(
    connections,
    attachedConnectionIds,
    'googlecalendar',
    calendarNode && isToolNodeData(calendarNode.data) ? calendarNode.data.connectionId : null,
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
            }
          : undefined,
      ),
    );
  }

  normalizedNodes.push(
    createOutputNode(nodesByKind.get('output')?.position ?? DEFAULT_POSITIONS.output),
  );

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
): BuilderFlowNode {
  if (node.data.kind === 'knowledge') {
    const sourceCount = node.data.sourceIds.length;

    return {
      ...node,
      data: {
        ...node.data,
        badgeText: sourceCount > 0 ? `${sourceCount} attached` : 'No sources',
        badgeTone: sourceCount > 0 ? 'success' : 'warning',
      },
    };
  }

  if (isToolNodeData(node.data)) {
    const selectedConnection = node.data.connectionId
      ? connections.find((connection) => connection.id === node.data.connectionId) ?? null
      : null;

    let badgeText = 'Needs setup';
    let badgeTone: BuilderNodeData['badgeTone'] = 'warning';

    if (selectedConnection?.status === 'connected') {
      badgeText = selectedConnection.account_label || 'Connected';
      badgeTone = 'success';
    } else if (selectedConnection) {
      badgeText = selectedConnection.status;
      badgeTone = 'error';
    }

    return {
      ...node,
      data: {
        ...node.data,
        badgeText,
        badgeTone,
      },
    };
  }

  if (isEndChatNodeData(node.data)) {
    const timeoutLabel =
      typeof node.data.inactivityTimeoutSeconds === 'number'
        ? `${node.data.inactivityTimeoutSeconds}s timeout`
        : 'No inactivity timeout';
    const suggestionLabel = node.data.allowAssistantSuggestion
      ? 'AI can suggest end'
      : 'System-only ending';

    return {
      ...node,
      data: {
        ...node.data,
        badgeText: `${timeoutLabel} • ${suggestionLabel}`,
        badgeTone: 'success',
      },
    };
  }

  return node;
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
  const [supabase] = useState(() => createClient());
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const agentId = params.id;
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderFlowNode>([]);
  const [edges, setEdges] = useState<BuilderFlowEdge[]>([]);
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [model, setModel] = useState('openai/gpt-4o-mini');
  const [timezone, setTimezone] = useState('UTC');
  const [starterPromptFields, setStarterPromptFields] = useState<string[]>(['', '', '']);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRollingBackVersionId, setIsRollingBackVersionId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string>('Draft not saved yet.');
  const [isToolPickerOpen, setIsToolPickerOpen] = useState(false);
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
  const stopBuilderFieldKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    event.stopPropagation();
  };

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

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const displayNodes = nodes.map((node) => enrichNodeForDisplay(node, connections));

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
      throw new Error(payload.error ?? 'Failed to save knowledge sources.');
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
      supabase.from('connections').select('*').order('updated_at', { ascending: false }),
      supabase.from('agent_connections').select('connection_id').eq('agent_id', agentId),
      supabase.auth.getUser(),
      supabase
        .from('knowledge_sources')
        .select('*')
        .order('updated_at', { ascending: false }),
      fetch(`/api/agents/${agentId}/knowledge`, {
        next: { revalidate: 30 },
      }).then((response) => response.json().then((payload) => ({ ok: response.ok, payload }))),
    ]);

    if (agentResult.error) {
      throw agentResult.error;
    }

    if (knowledgeSourcesResult.error) {
      throw knowledgeSourcesResult.error;
    }

    const chatConnections = ((connectionsResult.data ?? []) as ConnectionRecord[]).filter(
      (connection) => isChatIntegrationSlug(connection.toolkit_slug),
    );
    const attachedConnectionIds = ((attachedResult.data ?? []) as Array<{ connection_id: string }>).map(
      (item) => item.connection_id,
    );

    if (!attachedKnowledgeResult.ok) {
      throw new Error(attachedKnowledgeResult.payload.error ?? 'Failed to load knowledge attachments.');
    }

    const attachedKnowledgeSourceIds = (
      ((attachedKnowledgeResult.payload.sources ?? []) as KnowledgeSourceRecord[]) ?? []
    ).map((item) => item.id);

    const loadedAgent = agentResult.data as AgentRecord;
    const fallbackDefinition = buildInitialDefinition('custom');
    const definition = (draftResult.data?.definition ?? fallbackDefinition) as BuilderDefinition;
    const normalized = normalizeDefinition(
      definition,
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
    setSelectedNodeId(FIXED_NODE_IDS.agent);
    setStatusNote(
      draftResult.data?.updated_at
        ? `Last saved ${new Date(draftResult.data.updated_at).toLocaleString()}`
        : 'Draft not saved yet.',
    );

    if (normalized.requiresToolReview) {
      showToast('Multiple old tool connections were found. Review Gmail and Calendar nodes.', 'error');
    }
  }, [agentId, setNodes, showToast, supabase]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        await loadBuilder();
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error ? error.message : 'Failed to load the builder.';
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
  }, [loadBuilder, showToast]);

  useEffect(() => {
    if (nodes.length === 0) {
      return;
    }

    setEdges(buildEdges(nodes));
  }, [nodes]);

  const selectedGoogleCalendarConnectionId =
    selectedNode?.data.kind === 'googlecalendar' ? selectedNode.data.connectionId : null;

  useEffect(() => {
    if (!selectedGoogleCalendarConnectionId || selectedNode?.data.kind !== 'googlecalendar') {
      return;
    }

    const selectedCalendarNode = selectedNode.data as GoogleCalendarBuilderNodeData;
    const connectionId = selectedGoogleCalendarConnectionId;
    if (!connectionId) {
      return;
    }

    const currentStatus = calendarOptionsStatusByConnectionId[connectionId];
    if (currentStatus === 'ready' || currentStatus === 'loading') {
      return;
    }

    let isMounted = true;
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
          throw new Error(payload.error ?? 'Failed to load Google calendars.');
        }

        if (!isMounted) {
          return;
        }

        const calendars = Array.isArray(payload.calendars)
          ? (payload.calendars as GoogleCalendarListItem[])
          : [];
        const selectedCalendar = resolveCalendarOption(
          calendars,
          selectedCalendarNode.calendarId,
        );

        setCalendarOptionsByConnectionId((current) => ({
          ...current,
          [connectionId]: calendars,
        }));
        setCalendarOptionsStatusByConnectionId((current) => ({
          ...current,
          [connectionId]: 'ready',
        }));

        const nextTimezone = selectedCalendar?.timezone ?? null;
        const nextCalendarLabel = selectedCalendarNode.calendarId
          ? selectedCalendar?.summary ?? null
          : null;

        if (
          selectedCalendarNode.timezone !== nextTimezone ||
          selectedCalendarNode.calendarLabel !== nextCalendarLabel
        ) {
          updateGoogleCalendarSettings(selectedNode.id, {
            timezone: nextTimezone,
            calendarLabel: nextCalendarLabel,
          });
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCalendarOptionsStatusByConnectionId((current) => ({
          ...current,
          [connectionId]: 'error',
        }));
        showToast(
          error instanceof Error ? error.message : 'Failed to load Google calendars.',
          'error',
        );
      }
    };

    void loadCalendars();

    return () => {
      isMounted = false;
    };
  }, [resolveCalendarOption, selectedGoogleCalendarConnectionId, selectedNode, showToast]);

  useEffect(() => {
    if (nodes.length === 0) {
      return;
    }

    if (!selectedNodeId || !nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(getAgentNodeId(nodes));
    }
  }, [nodes, selectedNodeId]);

  const handleAddKnowledgeNode = () => {
    if (nodes.some((node) => node.data.kind === 'knowledge')) {
      showToast('Knowledge is already on the canvas.', 'error');
      return;
    }

    saveToHistory();
    const node = createKnowledgeNode();
    setNodes((currentNodes) => [...currentNodes, node]);
    setSelectedNodeId(node.id);
  };

  const handleAddEndChatNode = () => {
    if (nodes.some((node) => node.data.kind === 'endchat')) {
      showToast('End Chat is already on the canvas.', 'error');
      return;
    }

    saveToHistory();
    const node = createEndChatNode();
    setNodes((currentNodes) => [...currentNodes, node]);
    setSelectedNodeId(node.id);
  };

  const handleAddToolNode = (kind: ToolNodeKind) => {
    if (nodes.some((node) => node.data.kind === kind)) {
      showToast(`${getSupportedIntegration(kind)?.displayName ?? 'This tool'} is already on the canvas.`, 'error');
      return;
    }

    saveToHistory();
    const nextNode =
      kind === 'gmail' ? createGmailNode() : createGoogleCalendarNode();
    setNodes((currentNodes) => [...currentNodes, nextNode]);
    setSelectedNodeId(nextNode.id);
    setIsToolPickerOpen(false);
  };

  const updateNode = (nodeId: string, updater: (node: BuilderFlowNode) => BuilderFlowNode) => {
    setNodes((currentNodes) => currentNodes.map((node) => (node.id === nodeId ? updater(node) : node)));
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

      return {
        ...node,
        data: {
          ...node.data,
          connectionId,
        },
      };
    });
  };

  const updateGoogleCalendarSettings = (
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
  };

  const updateGmailRecipientSettings = (
    nodeId: string,
    updates: Partial<Pick<GmailBuilderNodeData, 'recipientMode' | 'recipientEmail'>>,
  ) => {
    updateNode(nodeId, (node) => {
      if (node.data.kind !== 'gmail') {
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

  const removeOptionalNode = (kind: BuilderNodeKind) => {
    saveToHistory();
    setNodes((currentNodes) => currentNodes.filter((node) => node.data.kind !== kind));
    setSelectedNodeId(FIXED_NODE_IDS.agent);
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
      setStatusNote(`Last saved ${new Date().toLocaleString()}`);
      showToast('Draft saved.', 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save draft.';
      showToast(message, 'error');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const publishVersion = async () => {
    if (!agent) {
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
        throw versionError ?? new Error('Failed to create version.');
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
      setStatusNote(`Published v${versionNumber} at ${new Date().toLocaleString()}`);
      showToast(`Published version ${versionNumber}.`, 'success');
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to publish agent.';
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
        throw new Error(payload.error ?? 'Failed to rollback version.');
      }

      await loadBuilder();
      showToast('Agent rolled back to the selected version.', 'success');
      setStatusNote(`Rolled back at ${new Date().toLocaleString()}`);
      setIsHistoryOpen(false);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to rollback version.';
      showToast(message, 'error');
    } finally {
      setIsRollingBackVersionId(null);
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
      description: integration?.connectionPurpose ?? '',
      icon: integration?.icon ?? 'extension',
      simpleIcon: integration?.simpleIcon,
      simpleIconColor: integration?.simpleIconColor,
      isAdded,
      canAdd: connectedCount > 0 && !isAdded,
      stateLabel: isAdded ? 'Added' : connectedCount > 0 ? 'Connected' : 'Connect first',
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
            This is the entry point for the live conversation.
          </p>
        </div>
      );
    }

    if (selectedNode.data.kind === 'agent') {
      return (
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Name
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={stopBuilderFieldKeyDown}
              className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Description
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onKeyDown={stopBuilderFieldKeyDown}
              rows={3}
              className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Model
            </label>
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              onKeyDown={stopBuilderFieldKeyDown}
              className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
            >
              {MODEL_OPTIONS.map((modelOption) => (
                <option key={modelOption} value={modelOption}>
                  {modelOption}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              onKeyDown={stopBuilderFieldKeyDown}
              rows={10}
              className="min-h-[260px] w-full resize-y rounded-2xl border border-outline-variant/10 bg-background px-4 py-4 text-sm leading-6 outline-none"
            />
            <p className="mt-2 text-xs text-on-surface-variant">
              Keep this focused on live chat behavior, knowledge use, and tool use.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              onKeyDown={stopBuilderFieldKeyDown}
              className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-on-surface-variant">
              Used for calendar and time-based operations.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Starter Prompts
            </label>
            <div className="space-y-3">
              {starterPromptFields.map((prompt, index) => (
                <input
                  key={`starter-prompt-${index}`}
                  value={prompt}
                  onChange={(event) =>
                    setStarterPromptFields((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? event.target.value : item,
                      ),
                    )
                  }
                  onKeyDown={stopBuilderFieldKeyDown}
                  className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
                  placeholder={`Prompt ${index + 1}`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-on-surface-variant">
              Fill one to three prompts. Empty fields stay hidden in the widget.
            </p>
          </div>
        </div>
      );
    }

    if (knowledgeNode && isKnowledgeNodeData(knowledgeNode.data)) {
      const attachedSourceIds = knowledgeNode.data.sourceIds;

      return (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm leading-6 text-on-surface-variant">
              Choose the sources this agent can retrieve from.
            </p>
            <span className="rounded-full bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              {attachedSourceIds.length} attached
            </span>
          </div>
          <Link
            href="/knowledge"
            className="inline-flex rounded-full border border-outline-variant/15 px-3 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            Manage Sources
          </Link>
          <div className="space-y-3">
            {knowledgeSources.length === 0 ? (
              <p className="rounded-2xl bg-background px-4 py-4 text-sm text-on-surface-variant">
                No knowledge sources yet.
              </p>
            ) : (
              knowledgeSources.map((source) => {
                const checked = attachedSourceIds.includes(source.id);
                const isReady = isReadyKnowledgeSource(source);

                return (
                  <label
                    key={source.id}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-4 ${
                      isReady
                        ? 'border-outline-variant/10 bg-background'
                        : 'border-outline-variant/10 bg-surface-container-high'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!isReady}
                      onChange={(event) => updateKnowledgeSources(source.id, event.target.checked)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-on-surface">{source.name}</p>
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getKnowledgeStatusTone(source.status)}`}
                        >
                          {source.status}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/70">
                        {source.chunk_count} chunks
                      </p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          <button
            onClick={() => removeOptionalNode('knowledge')}
            className="rounded-full border border-outline-variant/15 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            Remove Node
          </button>
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
      const gmailRecipientEmail =
        toolNode.data.kind === 'gmail' ? toolNode.data.recipientEmail ?? '' : '';
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
      const hasValidSpecificRecipient =
        toolNode.data.kind === 'gmail' &&
        toolNode.data.recipientMode === 'specific_email' &&
        Boolean(normalizeGmailRecipientEmail(toolNode.data.recipientEmail));
      const lockedActions =
        toolNode.data.kind === 'gmail'
          ? ['Send Email']
          : ['Create Event', 'Quick Add', 'Get Current Date Time', 'Find Free Slots', 'List Calendars'];

      return (
        <div className="space-y-5">
          <p className="text-sm leading-6 text-on-surface-variant">
            {toolNode.data.kind === 'gmail'
              ? 'Use Gmail during the current conversation.'
              : 'Check availability and book meetings.'}
          </p>
          {selectedConnection && selectedConnection.status !== 'connected' ? (
            <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-4 text-sm text-on-surface-variant">
              Current account is {selectedConnection.status}. Pick a connected account before publishing.
            </div>
          ) : null}
          {hasConnectedOptions || selectedConnection ? (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                Connected Account
              </label>
              <select
                value={toolNode.data.connectionId ?? ''}
                onChange={(event) => updateToolConnection(toolNode.id, event.target.value || null)}
                className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
              >
                <option value="">Select account</option>
                {selectableConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.account_label || connection.display_name}
                    {connection.status === 'connected' ? '' : ` (${connection.status})`}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-4 text-sm text-on-surface-variant">
              No connected {toolNode.data.label} account yet.
              <div className="mt-4">
                <Link
                  href="/connections"
                  className="inline-flex rounded-full border border-outline-variant/15 px-3 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                >
                  Connect {toolNode.data.label}
                </Link>
              </div>
            </div>
          )}
          {toolNode.data.kind === 'gmail' && (
            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  Send Email To
                </label>
                <select
                  value={toolNode.data.recipientMode}
                  onChange={(event) =>
                    updateGmailRecipientSettings(toolNode.id, {
                      recipientMode:
                        event.target.value === 'specific_email'
                          ? 'specific_email'
                          : 'ai_decides',
                    })
                  }
                  className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
                >
                  <option value="ai_decides">AI decides</option>
                  <option value="specific_email">Specific email</option>
                </select>
              </div>
              <p className="text-sm leading-6 text-on-surface-variant">
                {toolNode.data.recipientMode === 'specific_email'
                  ? 'Send every Gmail message to one fixed internal address. The assistant should describe this as notifying the team without revealing the actual email.'
                  : 'Let the assistant choose who to email based on the conversation and the agent instructions.'}
              </p>
              {toolNode.data.recipientMode === 'specific_email' && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      Specific Email
                    </label>
                    <input
                      type="email"
                      value={gmailRecipientEmail}
                      onChange={(event) =>
                        updateGmailRecipientSettings(toolNode.id, {
                          recipientEmail: event.target.value || null,
                        })
                      }
                      placeholder="owner@company.com"
                      className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  {!hasValidSpecificRecipient ? (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-4 text-sm text-on-surface-variant">
                      Add a valid internal email address. Until then, Gmail stays unavailable in runtime for this node.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Allowed Actions
            </p>
            <div className="flex flex-wrap gap-2">
              {lockedActions.map((action) => (
                <span
                  key={action}
                  className="rounded-full bg-background px-3 py-2 text-[11px] font-semibold text-on-surface-variant"
                >
                  {action}
                </span>
              ))}
            </div>
          </div>
          {toolNode.data.kind === 'googlecalendar' && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  Booking Calendar
                </label>
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
                  className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Primary calendar</option>
                  {calendarOptions.map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.primary ? `${calendar.summary} (Primary)` : calendar.summary}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-on-surface-variant">
                  {calendarOptionsStatus === 'loading'
                    ? 'Loading calendars from the selected Google account...'
                    : calendarOptionsStatus === 'error'
                      ? 'Could not load calendars from this account right now.'
                      : 'Choose which calendar the agent should check and book against. Leave blank to use the primary calendar.'}
                </p>
              </div>
              {(toolNode.data as GoogleCalendarBuilderNodeData).calendarId ? (
                <label className="flex items-start gap-3 rounded-2xl border border-outline-variant/10 bg-background px-4 py-4">
                  <input
                    type="checkbox"
                    checked={(toolNode.data as GoogleCalendarBuilderNodeData).includePrimaryCalendar}
                    onChange={(event) => {
                      updateGoogleCalendarSettings(toolNode.id, {
                        includePrimaryCalendar: event.target.checked,
                      });
                    }}
                    onKeyDown={stopBuilderFieldKeyDown}
                    className="mt-1 h-4 w-4 rounded border-outline-variant/30 text-primary focus:ring-primary"
                  />
                  <span className="space-y-1">
                    <span className="block text-sm font-semibold text-on-surface">
                      Also book on primary calendar
                    </span>
                    <span className="block text-xs leading-5 text-on-surface-variant">
                      When enabled, the assistant will mirror bookings to the account&apos;s primary
                      calendar in addition to the selected booking calendar.
                    </span>
                  </span>
                </label>
              ) : null}
              <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  Booking Timezone
                </p>
                <p className="mt-2 text-sm font-semibold text-on-surface">
                  {resolvedCalendarTimezone ?? timezone}
                </p>
                <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                  {resolvedCalendarTimezone
                    ? resolvedCalendar?.primary && !(toolNode.data as GoogleCalendarBuilderNodeData).calendarId
                      ? 'Automatically resolved from the primary Google Calendar.'
                      : 'Automatically resolved from the selected booking calendar.'
                    : 'Falls back to the core agent timezone until the booking calendar exposes its own timezone.'}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => removeOptionalNode(toolNode.data.kind)}
            className="rounded-full border border-outline-variant/15 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            Remove Node
          </button>
        </div>
      );
    }

    if (endChatNode && isEndChatNodeData(endChatNode.data)) {
      const timeoutValue =
        typeof endChatNode.data.inactivityTimeoutSeconds === 'number'
          ? String(endChatNode.data.inactivityTimeoutSeconds)
          : '';

      return (
        <div className="space-y-5">
          <p className="text-sm leading-6 text-on-surface-variant">
            Control when the backend should mark the conversation completed.
          </p>
          <label className="flex items-start gap-3 rounded-2xl border border-outline-variant/10 bg-background px-4 py-4">
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
              className="mt-1"
            />
            <div>
              <p className="text-sm font-semibold text-on-surface">
                Assistant may suggest ending
              </p>
              <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                The model can suggest completion, but the backend still owns the final close.
              </p>
            </div>
          </label>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Inactivity Timeout (seconds)
            </label>
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
              placeholder="120"
              className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
            />
            <p className="mt-2 text-xs text-on-surface-variant">
              Leave empty to disable inactivity-based ending.
            </p>
          </div>
          <button
            onClick={() => removeOptionalNode('endchat')}
            className="rounded-full border border-outline-variant/15 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            Remove Node
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-on-surface-variant">
          This is the final message returned to the user.
        </p>
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="shrink-0 flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-lowest/50 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/15 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-lg">chevron_left</span>
          </Link>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">
                Dashboard
              </span>
              <span className="text-on-surface-variant/30">/</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Builder
              </span>
              <span className="text-on-surface-variant/30">/</span>
              <h1 className="font-headline text-lg font-bold text-on-surface">
                {name || agent?.name || 'Agent Builder'}
              </h1>
            </div>
            <AgentViewTabs agentId={agentId} current="builder" />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <p className="text-[10px] font-medium tracking-wide text-on-surface-variant/60">
            {statusNote}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full border border-outline-variant/15">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="rounded-l-full px-3 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-30"
                title="Undo (Ctrl+Z)"
              >
                <span className="material-symbols-outlined text-base">undo</span>
              </button>
              <div className="h-4 w-px bg-outline-variant/15" />
              <button
                onClick={redo}
                disabled={!canRedo}
                className="rounded-r-full px-3 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-30"
                title="Redo (Ctrl+Shift+Z)"
              >
                <span className="material-symbols-outlined text-base">redo</span>
              </button>
            </div>
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="rounded-full border border-outline-variant/15 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              History
            </button>
            <button
              onClick={() => void saveDraft()}
              disabled={isSaving}
              className="rounded-full border border-outline-variant/15 px-4 py-2 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={() => void publishVersion()}
              disabled={isPublishing}
              className="signature-gradient rounded-full px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-primary/20 transition-transform active:scale-95 disabled:opacity-60"
            >
              {isPublishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </header>

      <div className="relative grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="group absolute bottom-0 left-0 top-0 z-20 w-80 -translate-x-[calc(100%-1.25rem)] transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] hover:translate-x-0">
          <aside className="relative flex h-full flex-col border-r border-outline-variant/10 bg-surface-container-lowest/90 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="absolute bottom-0 right-0 top-0 flex w-5 items-center justify-center transition-opacity duration-300 group-hover:opacity-0">
              <div className="h-12 w-1 rounded-full bg-primary/20 transition-all group-hover:bg-primary/40" />
            </div>

            <div className="flex-1 overflow-y-auto opacity-0 transition-opacity duration-300 delay-100 group-hover:opacity-100">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                Node Library
              </p>
              <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                Keep the flow focused. Add knowledge or one live tool at a time.
              </p>
              <div className="mt-5 space-y-3">
                {NODE_LIBRARY.map((item) => {
                  const isKnowledgeAdded =
                    item.key === 'knowledge' &&
                    nodes.some((node) => node.data.kind === 'knowledge');
                  const isEndChatAdded =
                    item.key === 'endchat' &&
                    nodes.some((node) => node.data.kind === 'endchat');
                  const isFixed = item.fixed;
                  const isDisabled = isKnowledgeAdded || isEndChatAdded || isFixed;

                  return (
                    <button
                      key={item.key}
                      onClick={() =>
                        item.key === 'knowledge'
                          ? handleAddKnowledgeNode()
                          : item.key === 'endchat'
                          ? handleAddEndChatNode()
                          : item.key === 'tools'
                          ? setIsToolPickerOpen(true)
                          : undefined
                      }
                      disabled={isDisabled}
                      className={`flex w-full items-start gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container p-4 text-left transition-colors ${
                        isFixed
                          ? 'border-dashed border-outline-variant/30 bg-surface-container-low cursor-default'
                          : 'hover:border-primary/30 hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50'
                      }`}
                    >
                      <span className={`material-symbols-outlined ${isFixed ? 'text-on-surface-variant/40' : 'text-primary'}`}>
                        {item.icon}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-semibold ${isFixed ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                            {item.label}
                          </p>
                          {isFixed ? (
                            <span className="rounded-full bg-surface-container-high px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                              Fixed
                            </span>
                          ) : isKnowledgeAdded || isEndChatAdded ? (
                            <span className="rounded-full bg-background px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                              Added
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-on-surface-variant">
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

        <section className="min-h-0 border-b border-outline-variant/10 xl:border-b-0 xl:border-r">
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(getAgentNodeId(nodes))}
            onInit={setFlowInstance}
            fitView
            proOptions={{ hideAttribution: true }}
            className="bg-background"
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
            <Controls className="!bottom-4 !left-4 !top-auto !right-auto" />
          </ReactFlow>
        </section>

        <aside className="overflow-y-auto bg-surface-container-lowest p-5">
          {selectedNode ? (
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-lg">{selectedNode.data.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                    {selectedNode.data.type}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-on-surface">
                    {selectedNode.data.label}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    {selectedNode.data.description}
                  </p>
                </div>
              </div>
              <div className="mt-6">{renderInspectorBody()}</div>
            </div>
          ) : null}
        </aside>
      </div>

      {isToolPickerOpen ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                  Connected Tools
                </p>
                <h3 className="mt-2 text-lg font-semibold text-on-surface">Choose a tool node</h3>
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

      {isHistoryOpen ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 px-4 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                  Version History
                </p>
                <h3 className="mt-2 text-lg font-semibold text-on-surface">
                  Published versions
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
                  No published versions yet.
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
                            Version {version.version}
                          </p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            Published {formatRelativeDate(version.created_at)}
                          </p>
                        </div>
                        <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                          {isCurrent ? 'Live' : 'History'}
                        </span>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => void rollbackVersion(version.id)}
                          disabled={isCurrent || isRollingBackVersionId === version.id}
                          className="rounded-full border border-outline-variant/15 px-3 py-2 text-xs font-semibold text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isCurrent
                            ? 'Current Version'
                            : isRollingBackVersionId === version.id
                              ? 'Rolling Back...'
                              : 'Rollback'}
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
