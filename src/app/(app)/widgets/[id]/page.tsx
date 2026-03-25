'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { WidgetBubblePreview } from '@/components/widgets/WidgetBubblePreview';
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

interface AttachedAgentRecord {
  widgetAgent: WidgetAgentRecord;
  agent: AgentRecord;
}

interface WidgetDetailResponse {
  widget: WidgetRecord;
  attachedAgents: AttachedAgentRecord[];
  runtimeConfig: WidgetRuntimeConfig;
  hostedUrl: string;
  embedSnippet: string;
  needsRedeploy: boolean;
  availableAgents: AgentRecord[];
}

interface WidgetFormState {
  name: string;
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  theme: 'dark' | 'light';
  language: string;
  homeTitle: string;
  homeSubtitle: string;
  hostedEnabled: boolean;
  showBranding: boolean;
  privacyPolicyUrl: string;
  allowedOrigins: string[];
  originInput: string;
  originError: string | null;
}

interface AttachedAgentState {
  agentId: string;
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

const surfaceClassName =
  'rounded-xl border border-outline-variant/20 bg-background shadow-sm';
const sectionTitleClassName =
  'text-base font-semibold text-on-surface';
const sectionDescClassName =
  'text-sm text-on-surface-variant mt-1.5 leading-relaxed';
const fieldLabelClassName =
  'text-sm font-medium text-on-surface-variant';
const inputClassName =
  'w-full rounded-lg border border-outline-variant/30 bg-background px-3 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50';
const secondaryButtonClassName =
  'rounded-lg border border-outline-variant/20 bg-background px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-40';
const primaryButtonClassName =
  'rounded-lg bg-on-surface px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50';
const codeBlockClassName =
  'mt-2 overflow-x-auto rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-xs leading-6 text-on-surface font-mono';
const WIDGET_ASSETS_BUCKET = 'widget-assets';

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
    backgroundColor: summary.widget.background_color,
    textColor: summary.widget.text_color,
    theme: summary.widget.theme,
    language: summary.widget.language || 'en',
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
      description: widgetAgent.description,
      icon: widgetAgent.icon ?? '',
      sortOrder: index,
      interactionMode: widgetAgent.interaction_mode,
      greeting: widgetAgent.greeting,
      placeholder: widgetAgent.placeholder,
      showQuickActions: true,
      quickActions: buildQuickActionsFromPrompts(agent.starter_prompts.slice(0, 3)),
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
      backgroundColor: form.backgroundColor,
      textColor: form.textColor,
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
      label: item.agent.name,
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

function getWidgetStateLabel(summary: WidgetDetailResponse) {
  if (summary.needsRedeploy) {
    return 'Needs redeploy';
  }

  return summary.widget.status === 'deployed' ? 'Live' : 'Draft';
}

export default function WidgetDetailPage() {
  const [supabase] = useState(() => createClient());
  const params = useParams<{ id: string }>();
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
  const [draftPreview, setDraftPreview] = useState<DraftPreviewState | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);

  const loadWidget = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/widgets/${widgetId}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload) {
        throw new Error(payload?.error || 'Failed to load widget.');
      }

      const nextSummary = payload as WidgetDetailResponse;
      setSummary(nextSummary);
      setForm(getInitialFormState(nextSummary));
      setAttachedAgents(getInitialAttachedAgents(nextSummary));
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to load widget.',
        'error',
      );
    } finally {
      setIsLoading(false);
    }
  }, [showToast, widgetId]);

  useEffect(() => {
    void loadWidget();
  }, [loadWidget]);

  const widgetOrigin = useMemo(() => {
    if (!summary?.hostedUrl) {
      return null;
    }

    return new URL(summary.hostedUrl).origin;
  }, [summary?.hostedUrl]);
  const draftPreviewPayload = useMemo(
    () => (form ? buildDraftPreviewPayload(form, attachedAgents) : null),
    [attachedAgents, form],
  );

  useEffect(() => {
    if (!summary || !draftPreviewPayload) {
      return;
    }

    const controller = new AbortController();
    setPreviewStatus((current) => (current === 'ready' ? 'loading' : 'loading'));
    setPreviewError(null);

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/widgets/${widgetId}/preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(draftPreviewPayload),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload) {
          throw new Error(payload?.error || 'Preview unavailable.');
        }

        if (controller.signal.aborted) {
          return;
        }

        setDraftPreview({
          previewUrl: String(payload.previewUrl ?? ''),
          previewToken: String(payload.previewToken ?? ''),
          previewRevision: String(payload.previewRevision ?? ''),
        });
        setPreviewStatus('ready');
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setDraftPreview(null);
        setPreviewStatus('error');
        setPreviewError(
          error instanceof Error ? error.message : 'Preview unavailable.',
        );
      }
    }, 420);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [draftPreviewPayload, summary, widgetId]);

  const addAgent = (agentId: string) => {
    if (!summary) return;
    if (!agentId || attachedAgents.some((item) => item.agentId === agentId)) {
      return;
    }

    const agent = summary.availableAgents.find((item) => item.id === agentId);

    if (!agent) return;

    setAttachedAgents((current) => [
      ...current,
      {
        agentId: agent.id,
        description: agent.description || '',
        icon: '',
        sortOrder: current.length,
        interactionMode: 'chat',
        greeting: 'Hi! How can I help you today?',
        placeholder: 'Write a message...',
        showQuickActions: true,
        quickActions: buildQuickActionsFromPrompts(agent.starter_prompts.slice(0, 3)),
        contactFormSettings: {
          submitButtonText: 'Send',
          successMessage: "Thanks! We'll get back to you soon.",
          introText: "Leave your details and we'll contact you.",
        },
        publishedVersionId: agent.published_version_id,
        agent,
      },
    ]);
  };

  const addOrigin = () => {
    if (!form) return;
    const input = form.originInput.trim();
    if (!input) return;

    try {
      const parsed = new URL(input);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setForm((current) => current ? { ...current, originError: 'URL must use http or https protocol' } : current);
        return;
      }

      const origin = parsed.origin;
      if (form.allowedOrigins.includes(origin)) {
        setForm((current) => current ? { ...current, originError: 'This domain is already added', originInput: '' } : current);
        return;
      }

      setForm((current) => current ? { ...current, allowedOrigins: [...current.allowedOrigins, origin], originInput: '', originError: null } : current);
    } catch {
      setForm((current) => current ? { ...current, originError: 'Please enter a valid URL (e.g., https://example.com)' } : current);
    }
  };

  const removeOrigin = (index: number) => {
    if (!form) return;
    setForm((current) => current ? { ...current, allowedOrigins: current.allowedOrigins.filter((_, i) => i !== index) } : current);
  };

  const moveAgent = (index: number, direction: -1 | 1) => {
    setAttachedAgents((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next.map((entry, order) => ({ ...entry, sortOrder: order }));
    });
  };

  const persistWidget = async (options?: {
    showSuccessToast?: boolean;
    reloadAfterSave?: boolean;
  }) => {
    if (!form) return;

    setIsSaving(true);

    try {
      const [identityResponse, agentsResponse] = await Promise.all([
        fetch(`/api/widgets/${widgetId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: form.name,
            brandName: form.brandName,
            logoUrl: form.logoUrl,
            primaryColor: form.primaryColor,
            backgroundColor: form.backgroundColor,
            textColor: form.textColor,
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agents: attachedAgents.map((item, index) => ({
              agentId: item.agentId,
              label: item.agent.name,
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

      const identityPayload = await identityResponse.json().catch(() => null);
      if (!identityResponse.ok || !identityPayload) {
        throw new Error(identityPayload?.error || 'Failed to save widget settings.');
      }

      const agentsPayload = await agentsResponse.json().catch(() => null);
      if (!agentsResponse.ok || !agentsPayload) {
        throw new Error(agentsPayload?.error || 'Failed to save attached agents.');
      }

      if (options?.reloadAfterSave ?? true) {
        await loadWidget();
      }

      if (options?.showSuccessToast ?? true) {
        showToast('Widget saved.', 'success');
      }

      return true;
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to save widget.',
        'error',
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const updateWidgetDeployment = async (status: 'draft' | 'deployed') => {
    setIsUpdatingDeployment(true);

    try {
      const saved = await persistWidget({
        showSuccessToast: false,
        reloadAfterSave: false,
      });

      if (!saved) {
        return;
      }

      const response = await fetch(`/api/widgets/${widgetId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload) {
        throw new Error(
          payload?.error ||
            (status === 'deployed'
              ? 'Failed to deploy widget.'
              : 'Failed to take widget offline.'),
        );
      }

      await loadWidget();
      showToast(status === 'deployed' ? 'Widget deployed.' : 'Widget taken offline.', 'success');
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : status === 'deployed'
            ? 'Failed to deploy widget.'
            : 'Failed to take widget offline.',
        'error',
      );
    } finally {
      setIsUpdatingDeployment(false);
    }
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copied.`, 'success');
    } catch {
      showToast(`Could not copy ${label.toLowerCase()}.`, 'error');
    }
  };

  const openPreview = () => {
    if (!draftPreview?.previewUrl) {
      return;
    }

    window.open(draftPreview.previewUrl, '_blank', 'noopener,noreferrer');
  };

  const handleLogoUpload = async (file: File) => {
    if (!form || !summary) {
      return;
    }

    const mimeType = file.type || 'application/octet-stream';
    if (!mimeType.startsWith('image/')) {
      showToast('Please upload an image file.', 'error');
      return;
    }

    setIsUploadingLogo(true);

    try {
      const safeName = sanitizeFileName(file.name || 'logo.png') || 'logo.png';
      const storagePath = `${summary.widget.workspace_id}/${summary.widget.id}/${Date.now()}-${safeName}`;
      const uploadResult = await supabase.storage
        .from(WIDGET_ASSETS_BUCKET)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: mimeType,
        });

      if (uploadResult.error) {
        throw uploadResult.error;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(WIDGET_ASSETS_BUCKET).getPublicUrl(storagePath);

      setForm((current) =>
        current
          ? {
              ...current,
              logoUrl: publicUrl,
            }
          : current,
      );
      showToast('Logo uploaded.', 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to upload logo.',
        'error',
      );
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  if (isLoading || !summary || !form) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-[2rem] bg-surface-container-low" />
          ))}
        </div>
      </div>
    );
  }

  const unattachedAgents = summary.availableAgents.filter(
    (agent) => !attachedAgents.some((item) => item.agentId === agent.id),
  );
  const widgetStateLabel = getWidgetStateLabel(summary);
  const isDeployed = summary.widget.status === 'deployed';
  const deployActionLabel = isDeployed ? 'Redeploy' : 'Deploy';
  const previewReady = Boolean(
    widgetOrigin &&
      summary.widget.widget_public_key &&
      draftPreview?.previewToken &&
      draftPreview.previewRevision,
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 pb-32 sm:px-6 lg:px-8 lg:pb-36">
      {previewReady && widgetOrigin ? (
        <WidgetBubblePreview
          widgetOrigin={widgetOrigin}
          widgetPublicKey={summary.widget.widget_public_key}
          previewToken={draftPreview!.previewToken}
          previewRevision={draftPreview!.previewRevision}
          previewSource="widget_preview"
        />
      ) : null}

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant/70">
            <Link href="/widgets" className="transition-colors hover:text-on-surface">
              Widgets
            </Link>
            <span>/</span>
            <span className="truncate text-on-surface">{summary.widget.name}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
            {summary.widget.name}
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-surface-container-low px-2 py-1 text-xs font-medium text-on-surface ring-1 ring-inset ring-outline-variant/20">
              {widgetStateLabel}
            </span>
            <span className="inline-flex items-center rounded-md bg-surface-container-low px-2 py-1 text-xs font-medium text-on-surface ring-1 ring-inset ring-outline-variant/20">
              {attachedAgents.length} {attachedAgents.length === 1 ? 'agent' : 'agents'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => void persistWidget()}
            disabled={isSaving || isUpdatingDeployment}
            className={secondaryButtonClassName}
          >
            {isSaving ? 'Saving...' : 'Save draft'}
          </button>
          {isDeployed ? (
            <button
              onClick={() => void updateWidgetDeployment('draft')}
              disabled={isUpdatingDeployment || isSaving}
              className={secondaryButtonClassName}
            >
              {isUpdatingDeployment ? 'Updating...' : 'Un deploy'}
            </button>
          ) : null}
          <button
            onClick={() => void updateWidgetDeployment('deployed')}
            disabled={isUpdatingDeployment || isSaving}
            className={primaryButtonClassName}
          >
            {isUpdatingDeployment ? 'Updating...' : deployActionLabel}
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main Column */}
        <div className="space-y-8">
          
          {/* General Section */}
          <section>
            <div className="mb-3.5">
              <h2 className={sectionTitleClassName}>General</h2>
              <p className={sectionDescClassName}>Basic information and branding for your widget.</p>
            </div>
            <div className={`${surfaceClassName} p-5 sm:p-6 space-y-5`}>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block space-y-1.5 md:col-span-2">
                  <span className={fieldLabelClassName}>Widget Name</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => current ? { ...current, name: event.target.value } : current)}
                    className={inputClassName}
                    placeholder="Internal reference name"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className={fieldLabelClassName}>Brand Name</span>
                  <input
                    value={form.brandName}
                    onChange={(event) => setForm((current) => current ? { ...current, brandName: event.target.value } : current)}
                    className={inputClassName}
                    placeholder="e.g. Acme Corp"
                  />
                </label>
                <div className="block space-y-1.5 md:col-span-2 mt-2">
                  <span className={fieldLabelClassName}>Logo</span>
                  <div className="mt-1 flex items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container-low">
                      {form.logoUrl ? (
                        <img
                          src={form.logoUrl}
                          alt={form.brandName || form.name || 'Widget logo'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-medium text-on-surface-variant/50">Logo</span>
                      )}
                    </div>
                    <div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void handleLogoUpload(file);
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          className={`${secondaryButtonClassName} py-1.5 text-xs`}
                        >
                          {isUploadingLogo ? 'Uploading...' : form.logoUrl ? 'Change logo' : 'Upload image'}
                        </button>
                        {form.logoUrl && (
                          <button
                            type="button"
                            onClick={() => setForm((current) => current ? { ...current, logoUrl: '' } : current)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-error hover:bg-error/10 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-on-surface-variant/70">
                        Recommended size: 256x256px. Formats: PNG, JPG, SVG.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Appearance Section */}
          <section>
            <div className="mb-3.5">
              <h2 className={sectionTitleClassName}>Appearance</h2>
              <p className={sectionDescClassName}>Customize the visual theme and colors.</p>
            </div>
            <div className={`${surfaceClassName} p-5 sm:p-6 space-y-5`}>
              <div className="grid gap-5 sm:grid-cols-3">
                <label className="block space-y-1.5">
                  <span className={fieldLabelClassName}>Primary Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={(event) => setForm((current) => current ? { ...current, primaryColor: event.target.value } : current)}
                      className="h-9 w-14 cursor-pointer rounded bg-transparent p-0 border-0"
                    />
                    <input
                      type="text"
                      value={form.primaryColor.toUpperCase()}
                      onChange={(event) => setForm((current) => current ? { ...current, primaryColor: event.target.value } : current)}
                      className={`${inputClassName} py-1.5 font-mono text-xs uppercase`}
                    />
                  </div>
                </label>
                <label className="block space-y-1.5">
                  <span className={fieldLabelClassName}>Background Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.backgroundColor}
                      onChange={(event) => setForm((current) => current ? { ...current, backgroundColor: event.target.value } : current)}
                      className="h-9 w-14 cursor-pointer rounded bg-transparent p-0 border-0"
                    />
                    <input
                      type="text"
                      value={form.backgroundColor.toUpperCase()}
                      onChange={(event) => setForm((current) => current ? { ...current, backgroundColor: event.target.value } : current)}
                      className={`${inputClassName} py-1.5 font-mono text-xs uppercase`}
                    />
                  </div>
                </label>
                <label className="block space-y-1.5">
                  <span className={fieldLabelClassName}>Text Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.textColor}
                      onChange={(event) => setForm((current) => current ? { ...current, textColor: event.target.value } : current)}
                      className="h-9 w-14 cursor-pointer rounded bg-transparent p-0 border-0"
                    />
                    <input
                      type="text"
                      value={form.textColor.toUpperCase()}
                      onChange={(event) => setForm((current) => current ? { ...current, textColor: event.target.value } : current)}
                      className={`${inputClassName} py-1.5 font-mono text-xs uppercase`}
                    />
                  </div>
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 pt-2 border-t border-outline-variant/10">
                <label className="block space-y-1.5">
                  <span className={fieldLabelClassName}>Theme Preference</span>
                  <select
                    value={form.theme}
                    onChange={(event) => setForm((current) => current ? { ...current, theme: event.target.value as 'light'|'dark' } : current)}
                    className={inputClassName}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                
                <div className="flex items-center justify-between rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 sm:mt-6">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium text-on-surface">Show branding</span>
                    <p className="text-xs text-on-surface-variant/70">Display "Powered by" badge</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.showBranding}
                    onChange={(event) => setForm((current) => current ? { ...current, showBranding: event.target.checked } : current)}
                    className="h-4 w-4 rounded border-outline-variant/30 text-primary"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Home Screen Section */}
          <section>
            <div className="mb-3.5">
              <h2 className={sectionTitleClassName}>Home Screen</h2>
              <p className={sectionDescClassName}>Configure text and language for the main view.</p>
            </div>
            <div className={`${surfaceClassName} p-5 sm:p-6 space-y-5`}>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className={fieldLabelClassName}>Home Title</span>
                  <input
                    value={form.homeTitle}
                    onChange={(event) => setForm((current) => current ? { ...current, homeTitle: event.target.value } : current)}
                    placeholder="e.g. How can we help?"
                    className={inputClassName}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className={fieldLabelClassName}>Home Subtitle</span>
                  <input
                    value={form.homeSubtitle}
                    onChange={(event) => setForm((current) => current ? { ...current, homeSubtitle: event.target.value } : current)}
                    placeholder="e.g. Choose the right specialist..."
                    className={inputClassName}
                  />
                </label>
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className={fieldLabelClassName}>Language</span>
                  <select
                    value={form.language}
                    onChange={(event) => setForm((current) => current ? { ...current, language: event.target.value } : current)}
                    className={`${inputClassName} sm:max-w-xs`}
                  >
                    <option value="en">English (EN)</option>
                    <option value="sv">Svenska (SV)</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          {/* Agents Section */}
          <section>
            <div className="mb-3.5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className={sectionTitleClassName}>Specialists</h2>
                <p className={sectionDescClassName}>Agents available on the widget home screen.</p>
              </div>
              <select
                value=""
                onChange={(event) => {
                  const value = event.target.value;
                  if (value) {
                    addAgent(value);
                  }
                }}
                className={`${inputClassName} py-2 w-auto sm:min-w-[180px] bg-surface-container-low font-medium`}
              >
                <option value="" disabled>+ Add Specialist</option>
                {unattachedAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="space-y-4">
              {attachedAgents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-outline-variant/30 bg-background px-5 py-8 text-center">
                  <p className="text-sm font-medium text-on-surface-variant">No specialists added yet.</p>
                  <p className="mt-1 text-xs text-on-surface-variant/70">Add an agent to start building your widget's home screen.</p>
                </div>
              ) : (
                attachedAgents.map((item, index) => (
                  <div key={item.agentId} className={`${surfaceClassName} flex flex-col sm:flex-row overflow-hidden`}>
                    <div className="flex w-full sm:w-16 flex-none flex-row sm:flex-col items-center justify-between sm:justify-center px-4 sm:px-0 py-2 sm:py-0 border-b sm:border-b-0 sm:border-r border-outline-variant/10 bg-surface-container-low">
                      <div className="flex sm:flex-col gap-1 items-center">
                        <button onClick={() => moveAgent(index, -1)} disabled={index === 0} className="p-1.5 text-on-surface-variant/50 hover:text-on-surface disabled:opacity-30">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <span className="text-[10px] font-bold text-on-surface-variant/40 mx-2 sm:mx-0 sm:my-1">{index + 1}</span>
                        <button onClick={() => moveAgent(index, 1)} disabled={index === attachedAgents.length - 1} className="p-1.5 text-on-surface-variant/50 hover:text-on-surface disabled:opacity-30">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>
                      <button
                        onClick={() => setAttachedAgents((current) => current.filter((entry) => entry.agentId !== item.agentId).map((entry, order) => ({ ...entry, sortOrder: order })))}
                        className="sm:hidden text-xs font-medium text-error hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    
                    <div className="flex-1 p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-on-surface">{item.agent.name}</h3>
                            <span className="rounded border border-outline-variant/10 bg-surface-container px-2 py-0.5 text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase">
                              {item.interactionMode === 'contact_form' ? 'Contact Form' : 'Chat'}
                            </span>
                            {item.agent.published_version_id && (
                              <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
                                Published
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setAttachedAgents((current) => current.filter((entry) => entry.agentId !== item.agentId).map((entry, order) => ({ ...entry, sortOrder: order })))}
                          className="hidden sm:block rounded-lg p-2 text-on-surface-variant/50 hover:bg-error/10 hover:text-error transition-colors"
                          title="Remove specialist"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="block space-y-1.5">
                          <span className={fieldLabelClassName}>Greeting Message</span>
                          <input
                            value={item.greeting || ''}
                            onChange={(event) => setAttachedAgents((current) => current.map((entry) => entry.agentId === item.agentId ? { ...entry, greeting: event.target.value } : entry))}
                            placeholder="e.g. Hi! How can I help you today?"
                            className={inputClassName}
                          />
                        </label>
                        <label className="block space-y-1.5">
                          <span className={fieldLabelClassName}>Short Description</span>
                          <input
                            value={item.description}
                            onChange={(event) => setAttachedAgents((current) => current.map((entry) => entry.agentId === item.agentId ? { ...entry, description: event.target.value } : entry))}
                            placeholder="Underneath the title on Home..."
                            className={inputClassName}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Security Section */}
          <section>
            <div className="mb-3.5">
              <h2 className={sectionTitleClassName}>Security & Privacy</h2>
              <p className={sectionDescClassName}>Manage where your widget can be embedded and your data policies.</p>
            </div>
            <div className={`${surfaceClassName} p-5 sm:p-6 space-y-6`}>
              <label className="block space-y-1.5">
                <span className={fieldLabelClassName}>Privacy Policy URL</span>
                <input
                  value={form.privacyPolicyUrl}
                  onChange={(event) => setForm((current) => current ? { ...current, privacyPolicyUrl: event.target.value } : current)}
                  placeholder="https://example.com/privacy"
                  className={inputClassName}
                />
              </label>

              <div className="block space-y-1.5">
                <span className={fieldLabelClassName}>Allowed Origins</span>
                <p className="text-xs text-on-surface-variant/70 mb-3">Whitelist the domains that are permitted to embed this widget.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={form.originInput}
                    onChange={(event) => setForm((current) => current ? { ...current, originInput: event.target.value, originError: null } : current)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addOrigin();
                      }
                    }}
                    placeholder="e.g., https://example.com"
                    className={`${inputClassName} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={addOrigin}
                    className={`${secondaryButtonClassName} bg-surface-container-low`}
                  >
                    Add domain
                  </button>
                </div>
                {form.originError && (
                  <p className="mt-1.5 text-xs text-error">{form.originError}</p>
                )}
                
                <div className="mt-4">
                  {form.allowedOrigins.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {form.allowedOrigins.map((origin, index) => (
                        <span
                          key={index}
                          className="flex items-center gap-1.5 rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1.5 text-xs font-medium text-on-surface"
                        >
                          {origin}
                          <button
                            type="button"
                            onClick={() => removeOrigin(index)}
                            className="ml-1 text-on-surface-variant/50 hover:text-error focus:outline-none"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-on-surface-variant/50">Any domain is currently allowed. Add domains to restrict access.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <section className={`${surfaceClassName} overflow-hidden`}>
            <div className="border-b border-outline-variant/10 bg-surface-container-low px-5 py-4">
              <h3 className="text-sm font-semibold text-on-surface">Preview</h3>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest mb-1.5">Status</p>
                <div className="flex items-center gap-2.5">
                  <div className={`h-2.5 w-2.5 rounded-full ${previewStatus === 'ready' ? 'bg-success' : previewStatus === 'error' ? 'bg-error' : 'bg-warning animate-pulse'}`} />
                  <p className="text-sm font-medium text-on-surface">
                    {previewStatus === 'ready'
                      ? 'Draft snapshot ready'
                      : previewStatus === 'error'
                        ? 'Preview unavailable'
                        : 'Preparing preview...'}
                  </p>
                </div>
                {previewStatus === 'error' && previewError && (
                  <p className="mt-2 text-xs text-error">{previewError}</p>
                )}
              </div>
              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  onClick={openPreview}
                  disabled={!draftPreview?.previewUrl || previewStatus !== 'ready'}
                  className={`${primaryButtonClassName} flex items-center justify-center gap-2`}
                >
                  Open in new tab
                  <svg className="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </button>
                <button
                  onClick={() => void handleCopy(draftPreview?.previewUrl || '', 'Preview URL')}
                  disabled={!draftPreview?.previewUrl || previewStatus !== 'ready'}
                  className={`${secondaryButtonClassName} bg-transparent`}
                >
                  Copy preview link
                </button>
              </div>
            </div>
          </section>

          <section className={`${surfaceClassName} overflow-hidden`}>
            <div className="border-b border-outline-variant/10 bg-surface-container-low px-5 py-4">
              <h3 className="text-sm font-semibold text-on-surface">Installation</h3>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className={fieldLabelClassName}>Hosted access</p>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={form.hostedEnabled}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, hostedEnabled: event.target.checked } : current,
                        )
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-outline-variant/20 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-outline-variant/10 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                  </label>
                </div>
                <p className="text-xs text-on-surface-variant/70 leading-relaxed">
                  Allow external users to access the widget directly via a URL.
                </p>
              </div>

              <div className="pt-4 border-t border-outline-variant/10">
                <div className="flex items-center justify-between mb-2">
                  <p className={fieldLabelClassName}>Hosted URL</p>
                  <button onClick={() => void handleCopy(summary.hostedUrl, 'Hosted URL')} className="text-xs font-semibold text-primary hover:underline">Copy</button>
                </div>
                <pre className={codeBlockClassName}>{summary.hostedUrl}</pre>
              </div>

              <div className="pt-4 border-t border-outline-variant/10">
                <div className="flex items-center justify-between mb-2">
                  <p className={fieldLabelClassName}>Embed Snippet</p>
                  <button onClick={() => void handleCopy(summary.embedSnippet, 'Embed snippet')} className="text-xs font-semibold text-primary hover:underline">Copy</button>
                </div>
                <p className="text-xs text-on-surface-variant/70 mb-2">Paste this exactly before the closing {`</body>`} tag on your website.</p>
                <div className="relative group">
                  <pre className={`${codeBlockClassName} text-[10px] whitespace-pre-wrap`}>{summary.embedSnippet}</pre>
                </div>
              </div>
            </div>
          </section>

          <section className={`${surfaceClassName} overflow-hidden`}>
            <div className="border-b border-outline-variant/10 bg-surface-container-low px-5 py-4">
              <h3 className="text-sm font-semibold text-on-surface">Details</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest mb-1.5">Public Key</p>
                <p className="text-xs font-mono text-on-surface break-all bg-surface-container-low px-3 py-2 rounded-lg border border-outline-variant/10">
                  {summary.widget.widget_public_key}
                </p>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant">Setup Version</span>
                <span className="font-semibold text-on-surface px-2 py-0.5 rounded bg-surface-container-low border border-outline-variant/10">v2</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant">Display mode</span>
                <span className="font-semibold text-on-surface">Docked Bubble</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
