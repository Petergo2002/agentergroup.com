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
import { useAppContext } from '@/components/app/AppContext';
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
  proactiveEnabled: boolean;
  proactiveMessage: string;
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
  isPrimaryMiloWidget: boolean;
  
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
const MAX_WIDGET_LOGO_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const NORMALIZED_WIDGET_LOGO_SIZE = 256;

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

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to read the selected image.'));
    };

    image.src = objectUrl;
  });
}

async function normalizeWidgetLogoFile(file: File) {
  if (file.type === 'image/svg+xml') {
    return file;
  }

  const image = await loadImageElement(file);
  const canvas = document.createElement('canvas');
  canvas.width = NORMALIZED_WIDGET_LOGO_SIZE;
  canvas.height = NORMALIZED_WIDGET_LOGO_SIZE;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to initialize image processing.');
  }

  const scale = Math.min(
    NORMALIZED_WIDGET_LOGO_SIZE / image.naturalWidth,
    NORMALIZED_WIDGET_LOGO_SIZE / image.naturalHeight,
  );
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  const offsetX = Math.round((NORMALIZED_WIDGET_LOGO_SIZE - targetWidth) / 2);
  const offsetY = Math.round((NORMALIZED_WIDGET_LOGO_SIZE - targetHeight) / 2);

  context.clearRect(0, 0, NORMALIZED_WIDGET_LOGO_SIZE, NORMALIZED_WIDGET_LOGO_SIZE);
  context.drawImage(image, offsetX, offsetY, targetWidth, targetHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.86);
  });

  if (!blob) {
    throw new Error('Failed to optimize the selected image.');
  }

  const baseName = sanitizeFileName(file.name.replace(/\.[^.]+$/, '')) || 'logo';
  return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
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
    proactiveEnabled: summary.widget.proactive_enabled ?? false,
    proactiveMessage: summary.widget.proactive_message ?? "",
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
      proactiveEnabled: form.proactiveEnabled,
      proactiveMessage: form.proactiveMessage || null,
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
  const { workspace } = useAppContext();
  const widgetId = params.id;
  const isPrimaryMiloWidget =
    process.env.NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED !== 'false' &&
    workspace.product_experience === 'milo' &&
    workspace.primary_widget_id === widgetId;
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const draftPreviewRevisionRef = useRef<string | null>(null);

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

  useEffect(() => {
    draftPreviewRevisionRef.current = draftPreview?.previewRevision ?? null;
  }, [draftPreview?.previewRevision]);

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
	          body: JSON.stringify({
	            ...draftPreviewPayload,
	            previewRevision: draftPreviewRevisionRef.current,
	          }),
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
      const agentsResponse = await fetch(`/api/widgets/${widgetId}/agents`, {
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
      });
      const agentsPayload = await agentsResponse.json().catch(() => null);

      if (!agentsResponse.ok) {
        throw new Error(agentsPayload?.error || t('widgetBuilder.saveError'));
      }

      const identityResponse = await fetch(`/api/widgets/${widgetId}`, {
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
          proactiveEnabled: form.proactiveEnabled,
          proactiveMessage: form.proactiveMessage,
          privacyPolicyUrl: form.privacyPolicyUrl,
          allowedOrigins: form.allowedOrigins,
        }),
      });
      const identityPayload = await identityResponse.json().catch(() => null);

      if (!identityResponse.ok) {
        throw new Error(identityPayload?.error || t('widgetBuilder.saveError'));
      }

      // Automatically sync changes if the widget is already live
      if (summary?.widget.status === 'deployed' && (options?.reloadAfterSave ?? true)) {
        await fetch(`/api/widgets/${widgetId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'deployed' }),
        });
      }

      if (options?.reloadAfterSave ?? true) await loadWidget();
      if (options?.showSuccessToast ?? true) showToast(t('widgetBuilder.saved'), 'success');
      return true;
    } catch (error) {
      await loadWidget().catch(() => undefined);
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
	    if (file.size > MAX_WIDGET_LOGO_FILE_SIZE_BYTES) {
	      showToast(t('widgetBuilder.uploadImageError'), 'error');
	      return;
	    }
	    setIsUploadingLogo(true);
	    try {
	      const normalizedFile = await normalizeWidgetLogoFile(file);
	      const safeName =
	        sanitizeFileName(normalizedFile.name || 'logo.webp') || 'logo.webp';
	      const storagePath = `${summary.widget.workspace_id}/${summary.widget.id}/${Date.now()}-${safeName}`;
	      const { error: uploadError } = await supabase.storage.from(WIDGET_ASSETS_BUCKET).upload(storagePath, normalizedFile, { cacheControl: '3600', upsert: true, contentType: normalizedFile.type });
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
    isPrimaryMiloWidget,
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
