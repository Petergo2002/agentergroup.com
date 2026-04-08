'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useParams } from 'next/navigation';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useToast } from '@/components/ui/ToastProvider';
import { createClient } from '@/lib/supabase/client';
import type {
  AgentRecord,
  WidgetDraftPreviewInput,
  WidgetAgentRecord,
  WidgetContactFormSettingsRecord,
  WidgetRuntimeConfig,
  WidgetRecord,
} from '@/lib/types';

/**
 * Types and Interfaces
 */

interface AttachedAgentRecord {
  widgetAgent: WidgetAgentRecord;
  agent: AgentRecord;
}

export interface WidgetDetailResponse {
  widget: WidgetRecord;
  attachedAgents: AttachedAgentRecord[];
  runtimeConfig: WidgetRuntimeConfig;
  hostedUrl: string;
  embedSnippet: string;
  needsRedeploy: boolean;
  availableAgents: AgentRecord[];
}

export interface WidgetFormState {
  name: string;
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  theme: 'dark' | 'light';
  language: 'en' | 'sv';
  homeTitle: string;
  homeSubtitle: string;
  hostedEnabled: boolean;
  showBranding: boolean;
  privacyPolicyUrl: string;
  allowedOrigins: string[];
  originInput: string;
  originError: string | null;
}

export interface AttachedAgentState {
  agentId: string;
  label: string;
  description: string;
  icon: string;
  sortOrder: number;
  interactionMode: 'chat' | 'contact_form';
  greeting: string;
  placeholder: string;
  showQuickActions: boolean;
  quickActions: { label: string; prompt: string; icon?: string | null }[];
  contactFormSettings: WidgetContactFormSettingsRecord;
  publishedVersionId: string | null;
  agent: AgentRecord;
}

interface DraftPreviewState {
  previewUrl: string;
  previewToken: string;
  previewRevision: string;
}

export type WidgetBuilderTab = 'aesthetics' | 'agents' | 'behavior' | 'deploy';

/**
 * Context Definition
 */

interface WidgetBuilderContextValue {
  // State
  widgetId: string;
  summary: WidgetDetailResponse | null;
  form: WidgetFormState | null;
  attachedAgents: AttachedAgentState[];
  isLoading: boolean;
  isSaving: boolean;
  isUpdatingDeployment: boolean;
  isUploadingLogo: boolean;
  activeTab: WidgetBuilderTab;
  draftPreview: DraftPreviewState | null;
  previewStatus: 'idle' | 'loading' | 'ready' | 'error';
  
  // Setters
  setForm: React.Dispatch<React.SetStateAction<WidgetFormState | null>>;
  setAttachedAgents: React.Dispatch<React.SetStateAction<AttachedAgentState[]>>;
  setActiveTab: (tab: WidgetBuilderTab) => void;
  
  // Actions
  loadWidget: () => Promise<void>;
  persistWidget: (options?: { showSuccessToast?: boolean; reloadAfterSave?: boolean }) => Promise<boolean>;
  updateWidgetDeployment: (status: 'draft' | 'deployed') => Promise<void>;
  handleLogoUpload: (file: File) => Promise<void>;
  addAgent: (agentId: string) => void;
  removeAgent: (agentId: string) => void;
  moveAgent: (index: number, direction: -1 | 1) => void;
  addOrigin: (origin: string) => void;
  removeOrigin: (index: number) => void;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
}

const WidgetBuilderContext = createContext<WidgetBuilderContextValue | undefined>(undefined);

const WIDGET_ASSETS_BUCKET = 'widget-assets';

/**
 * Helper Functions
 */

function buildQuickActionsFromPrompts(prompts: string[]) {
  return prompts
    .map((prompt) => prompt.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((prompt) => ({
      label: prompt,
      prompt,
      icon: null,
    }));
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function getInitialFormState(summary: WidgetDetailResponse): WidgetFormState {
  return {
    name: summary.widget.name,
    brandName: summary.widget.brand_name,
    logoUrl: summary.widget.logo_url ?? '',
    primaryColor: summary.widget.primary_color,
    secondaryColor: summary.widget.secondary_color || summary.widget.primary_color,
    theme: summary.widget.theme,
    language: (['en', 'sv'].includes(summary.widget.language) ? summary.widget.language : 'en') as 'en' | 'sv',
    homeTitle: summary.widget.home_title || '',
    homeSubtitle: summary.widget.home_subtitle || '',
    hostedEnabled: summary.widget.hosted_enabled,
    showBranding: summary.widget.show_branding,
    privacyPolicyUrl: summary.widget.privacy_policy_url ?? '',
    allowedOrigins: summary.widget.allowed_origins,
    originInput: '',
    originError: null,
  };
}

function getInitialAttachedAgents(summary: WidgetDetailResponse): AttachedAgentState[] {
  return [...summary.attachedAgents]
    .sort((left, right) => left.widgetAgent.sort_order - right.widgetAgent.sort_order)
    .map(({ widgetAgent, agent }, index) => ({
      agentId: widgetAgent.agent_id,
      label: widgetAgent.label,
      description: widgetAgent.description,
      icon: widgetAgent.icon ?? '',
      sortOrder: index,
      interactionMode: widgetAgent.interaction_mode,
      greeting: widgetAgent.greeting,
      placeholder: widgetAgent.placeholder,
      showQuickActions: widgetAgent.show_quick_actions,
      quickActions:
        widgetAgent.quick_actions.length > 0
          ? widgetAgent.quick_actions
          : buildQuickActionsFromPrompts(agent.starter_prompts.slice(0, 3)),
      contactFormSettings: widgetAgent.contact_form_settings,
      publishedVersionId: widgetAgent.published_version_id,
      agent,
    }));
}

function buildDraftPreviewPayload(
  form: WidgetFormState,
  attachedAgents: AttachedAgentState[],
): WidgetDraftPreviewInput {
  return {
    widget: {
      name: form.name,
      brandName: form.brandName,
      logoUrl: form.logoUrl,
      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
      theme: form.theme,
      language: form.language,
      homeTitle: form.homeTitle,
      homeSubtitle: form.homeSubtitle,
      showBranding: form.showBranding,
      privacyPolicyUrl: form.privacyPolicyUrl,
      allowedOrigins: form.allowedOrigins,
    },
    agents: attachedAgents.map((item, index) => ({
      agentId: item.agentId,
      label: item.label,
      description: item.description,
      icon: item.icon || null,
      sortOrder: index,
      interactionMode: item.interactionMode,
      greeting: item.greeting,
      placeholder: item.placeholder,
      showQuickActions: item.showQuickActions,
      quickActions: item.quickActions,
      contactFormSettings: item.contactFormSettings,
    })),
  };
}

/**
 * Provider Implementation
 */

export function WidgetBuilderProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const params = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const widgetId = params.id;
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const [summary, setSummary] = useState<WidgetDetailResponse | null>(null);
  const [form, setForm] = useState<WidgetFormState | null>(null);
  const [attachedAgents, setAttachedAgents] = useState<AttachedAgentState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingDeployment, setIsUpdatingDeployment] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [activeTab, setActiveTab] = useState<WidgetBuilderTab>('aesthetics');
  
  const [draftPreview, setDraftPreview] = useState<DraftPreviewState | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const loadWidget = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/widgets/${widgetId}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) throw new Error(payload?.error || t('widgetBuilder.loadError'));
      const nextSummary = payload as WidgetDetailResponse;
      setSummary(nextSummary);
      setForm(getInitialFormState(nextSummary));
      setAttachedAgents(getInitialAttachedAgents(nextSummary));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('widgetBuilder.loadError'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, widgetId, t]);

  useEffect(() => {
    void loadWidget();
  }, [loadWidget]);

  const draftPreviewPayload = useMemo(
    () => (form ? buildDraftPreviewPayload(form, attachedAgents) : null),
    [attachedAgents, form],
  );

  useEffect(() => {
    if (!summary || !draftPreviewPayload) return;
    const controller = new AbortController();
    setPreviewStatus('loading');
    
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/widgets/${widgetId}/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftPreviewPayload),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) throw new Error(payload?.error || t('widgetBuilder.previewUnavailable'));
        if (controller.signal.aborted) return;

        setDraftPreview({
          previewUrl: String(payload.previewUrl ?? ''),
          previewToken: String(payload.previewToken ?? ''),
          previewRevision: String(payload.previewRevision ?? ''),
        });
        setPreviewStatus('ready');
      } catch {
        if (controller.signal.aborted) return;
        setDraftPreview(null);
        setPreviewStatus('error');
      }
    }, 420);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [draftPreviewPayload, summary, widgetId, t]);

  const persistWidget = async (options?: { showSuccessToast?: boolean; reloadAfterSave?: boolean }) => {
    if (!form) return false;
    setIsSaving(true);
    try {
      const [identityResponse, agentsResponse] = await Promise.all([
        fetch(`/api/widgets/${widgetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            brandName: form.brandName,
            logoUrl: form.logoUrl,
            primaryColor: form.primaryColor,
            secondaryColor: form.secondaryColor,
            theme: form.theme,
            language: form.language,
            homeTitle: form.homeTitle || null,
            homeSubtitle: form.homeSubtitle || null,
            hostedEnabled: form.hostedEnabled,
            showBranding: form.showBranding,
            privacyPolicyUrl: form.privacyPolicyUrl,
            allowedOrigins: form.allowedOrigins,
          }),
        }),
        fetch(`/api/widgets/${widgetId}/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agents: attachedAgents.map((item, index) => ({
              agentId: item.agentId,
              label: item.label,
              description: item.description,
              icon: item.icon || null,
              sortOrder: index,
              interactionMode: item.interactionMode,
              greeting: item.greeting,
              placeholder: item.placeholder,
              showQuickActions: item.showQuickActions,
              quickActions: item.quickActions,
              contactFormSettings: item.contactFormSettings,
            })),
          }),
        }),
      ]);

      if (!identityResponse.ok || !agentsResponse.ok) throw new Error(t('widgetBuilder.saveError'));
      if (options?.reloadAfterSave ?? true) await loadWidget();
      if (options?.showSuccessToast ?? true) showToast(t('widgetBuilder.saved'), 'success');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('widgetBuilder.saveError'), 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const updateWidgetDeployment = async (status: 'draft' | 'deployed') => {
    setIsUpdatingDeployment(true);
    try {
      const saved = await persistWidget({ showSuccessToast: false, reloadAfterSave: false });
      if (!saved) return;
      const response = await fetch(`/api/widgets/${widgetId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(t('widgetBuilder.updateDeploymentError'));
      await loadWidget();
      showToast(status === 'deployed' ? t('widgetBuilder.deployed') : t('widgetBuilder.takenOffline'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('widgetBuilder.updateDeploymentError'), 'error');
    } finally {
      setIsUpdatingDeployment(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!form || !summary) return;
    if (!file.type.startsWith('image/')) {
      showToast(t('widgetBuilder.uploadImageError'), 'error');
      return;
    }
    setIsUploadingLogo(true);
    try {
      const safeName = sanitizeFileName(file.name || 'logo.png') || 'logo.png';
      const storagePath = `${summary.widget.workspace_id}/${summary.widget.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(WIDGET_ASSETS_BUCKET).upload(storagePath, file, { cacheControl: '3600', upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from(WIDGET_ASSETS_BUCKET).getPublicUrl(storagePath);
      setForm((current) => current ? { ...current, logoUrl: publicUrl } : current);
      showToast(t('widgetBuilder.logoUploaded'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('widgetBuilder.uploadLogoError'), 'error');
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const addAgent = (agentId: string) => {
    if (!summary || attachedAgents.some((item) => item.agentId === agentId)) return;
    const agent = summary.availableAgents.find((item) => item.id === agentId);
    if (!agent) return;
    setAttachedAgents((current) => [
      ...current,
      {
        agentId: agent.id,
        label: agent.name,
        description: agent.description || '',
        icon: '',
        sortOrder: current.length,
        interactionMode: 'chat',
        greeting: t('widgetBuilder.agents.defaultGreeting'),
        placeholder: t('widgetBuilder.agents.defaultPlaceholder'),
        showQuickActions: true,
        quickActions: buildQuickActionsFromPrompts(agent.starter_prompts.slice(0, 3)),
        contactFormSettings: {
          submitButtonText: t('agentPreview.send'),
          successMessage: t('widgetBuilder.agents.contactFormSuccess'),
          introText: t('widgetBuilder.agents.contactFormIntro'),
        },
        publishedVersionId: agent.published_version_id,
        agent,
      },
    ]);
  };

  const removeAgent = (agentId: string) => {
    setAttachedAgents((current) => current.filter((item) => item.agentId !== agentId));
  };

  const moveAgent = (index: number, direction: -1 | 1) => {
    setAttachedAgents((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next.map((entry, order) => ({ ...entry, sortOrder: order }));
    });
  };

  const addOrigin = (input: string) => {
    if (!form || !input.trim()) return;
    try {
      const origin = new URL(input.trim()).origin;
      if (form.allowedOrigins.includes(origin)) return;
      setForm((current) => current ? { ...current, allowedOrigins: [...current.allowedOrigins, origin], originError: null } : current);
    } catch {
      setForm((current) => current ? { ...current, originError: t('widgetBuilder.invalidUrl') } : current);
    }
  };

  const removeOrigin = (index: number) => {
    setForm((current) => current ? { ...current, allowedOrigins: current.allowedOrigins.filter((_, i) => i !== index) } : current);
  };

  const value = {
    widgetId,
    summary,
    form,
    attachedAgents,
    isLoading,
    isSaving,
    isUpdatingDeployment,
    isUploadingLogo,
    activeTab,
    draftPreview,
    previewStatus,
    setForm,
    setAttachedAgents,
    setActiveTab,
    loadWidget,
    persistWidget,
    updateWidgetDeployment,
    handleLogoUpload,
    addAgent,
    removeAgent,
    moveAgent,
    addOrigin,
    removeOrigin,
    logoInputRef,
  };

  return <WidgetBuilderContext.Provider value={value}>{children}</WidgetBuilderContext.Provider>;
}

export function useWidgetBuilder() {
  const context = useContext(WidgetBuilderContext);
  if (context === undefined) throw new Error('useWidgetBuilder must be used within a WidgetBuilderProvider');
  return context;
}
