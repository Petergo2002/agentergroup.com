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
  showBranding: boolean;
  privacyPolicyUrl: string;
  allowedOrigins: string;
}

interface AttachedAgentState {
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

const surfaceClassName =
  'rounded-[2rem] border border-outline-variant/10 bg-surface-container-low shadow-[0_24px_80px_rgba(15,23,42,0.08)]';
const sectionLabelClassName =
  'text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60';
const fieldLabelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60';
const inputClassName =
  'w-full rounded-2xl border border-outline-variant/15 bg-background px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-on-surface/20';
const secondaryButtonClassName =
  'rounded-full border border-outline-variant/15 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-40';
const codeBlockClassName =
  'mt-4 overflow-x-auto rounded-[1.5rem] border border-outline-variant/10 bg-background px-4 py-3 text-xs leading-6 text-on-surface';
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
    showBranding: summary.widget.show_branding,
    privacyPolicyUrl: summary.widget.privacy_policy_url ?? '',
    allowedOrigins: summary.widget.allowed_origins.join('\n'),
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
      allowedOrigins: form.allowedOrigins
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean),
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

function getWidgetStateLabel(summary: WidgetDetailResponse) {
  if (summary.needsRedeploy) {
    return 'Needs redeploy';
  }

  return summary.widget.status === 'deployed' ? 'Live' : 'Draft';
}

function getHomeBehaviorLabel(agentCount: number) {
  if (agentCount === 1) {
    return 'Home opens directly into one specialist.';
  }

  if (agentCount > 1) {
    return `Home shows ${agentCount} specialist choices.`;
  }

  return 'Attach at least one specialist to shape Home.';
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
  const [isDeploying, setIsDeploying] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [draftPreview, setDraftPreview] = useState<DraftPreviewState | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);

  const loadWidget = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/widgets/${widgetId}`, {
        cache: 'no-store',
      });
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
        label: agent.name,
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

  const persistWidget = async () => {
    if (!form) return;

    setIsSaving(true);

    try {
      const identityResponse = await fetch(`/api/widgets/${widgetId}`, {
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
          showBranding: form.showBranding,
          privacyPolicyUrl: form.privacyPolicyUrl,
          allowedOrigins: form.allowedOrigins
            .split('\n')
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      const identityPayload = await identityResponse.json().catch(() => null);

      if (!identityResponse.ok || !identityPayload) {
        throw new Error(identityPayload?.error || 'Failed to save widget settings.');
      }

      const agentsResponse = await fetch(`/api/widgets/${widgetId}/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      if (!agentsResponse.ok || !agentsPayload) {
        throw new Error(agentsPayload?.error || 'Failed to save attached agents.');
      }

      await loadWidget();
      showToast('Widget saved.', 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to save widget.',
        'error',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deployWidget = async () => {
    setIsDeploying(true);

    try {
      const response = await fetch(`/api/widgets/${widgetId}/deploy`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload) {
        throw new Error(payload?.error || 'Failed to deploy widget.');
      }

      await loadWidget();
      showToast('Widget deployed.', 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to deploy widget.',
        'error',
      );
    } finally {
      setIsDeploying(false);
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
  const homeBehaviorLabel = getHomeBehaviorLabel(attachedAgents.length);
  const previewReady = Boolean(
    widgetOrigin &&
      summary.widget.widget_public_key &&
      draftPreview?.previewToken &&
      draftPreview.previewRevision,
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-32 sm:px-6 lg:px-8 lg:py-8 lg:pb-36">
      {previewReady && widgetOrigin ? (
        <WidgetBubblePreview
          widgetOrigin={widgetOrigin}
          widgetPublicKey={summary.widget.widget_public_key}
          previewToken={draftPreview!.previewToken}
          previewRevision={draftPreview!.previewRevision}
          previewSource="widget_preview"
        />
      ) : null}

      <section className={`${surfaceClassName} mb-8 overflow-hidden`}>
        <div className="border-b border-outline-variant/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.1),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent)] px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">
                <Link href="/widgets" className="transition-colors hover:text-on-surface">
                  Widgets
                </Link>
                <span>/</span>
                <span className="truncate text-on-surface">{summary.widget.name}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-outline-variant/15 bg-background/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                  {widgetStateLabel}
                </span>
                <span className="rounded-full border border-outline-variant/15 bg-background/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                  {attachedAgents.length} agents
                </span>
              </div>
              <h1 className="mt-5 text-[2.35rem] font-headline font-bold tracking-tight text-on-surface sm:text-[2.85rem]">
                {summary.widget.name}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
                Shape one customer-facing chat surface, decide which specialists appear on Home, and keep deploy plus install details in one place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => void persistWidget()}
                disabled={isSaving}
                className={`${secondaryButtonClassName} px-5 py-2.5 text-on-surface`}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => void deployWidget()}
                disabled={isDeploying}
                className="rounded-full bg-on-surface px-5 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isDeploying ? 'Deploying...' : summary.needsRedeploy ? 'Redeploy' : 'Deploy'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="rounded-[1.6rem] border border-outline-variant/10 bg-background px-5 py-4">
            <p className={sectionLabelClassName}>Home Behavior</p>
            <p className="mt-3 text-sm leading-7 text-on-surface">{homeBehaviorLabel}</p>
          </div>
          <div className="rounded-[1.6rem] border border-outline-variant/10 bg-background px-5 py-4">
            <p className={sectionLabelClassName}>Preview Source</p>
            <p className="mt-3 text-sm leading-7 text-on-surface-variant">
              Preview reflects the current draft, including unsaved changes to structure, labels, and branding.
            </p>
          </div>
          <div className="rounded-[1.6rem] border border-outline-variant/10 bg-background px-5 py-4">
            <p className={sectionLabelClassName}>Public Key</p>
            <p className="mt-3 truncate font-mono text-sm text-on-surface">
              {summary.widget.widget_public_key}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.12fr)_24rem]">
        <section className="space-y-6">
          <div className={`${surfaceClassName} p-6 sm:p-7`}>
            <div>
              <p className={sectionLabelClassName}>Identity</p>
              <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                Control the shell, branding, and allowed embed domains for this widget.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block space-y-2 md:col-span-2">
                <span className={fieldLabelClassName}>Widget Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => current ? { ...current, name: event.target.value } : current)}
                  className={inputClassName}
                />
              </label>
              <label className="block space-y-2">
                <span className={fieldLabelClassName}>Brand Name</span>
                <input
                  value={form.brandName}
                  onChange={(event) => setForm((current) => current ? { ...current, brandName: event.target.value } : current)}
                  className={inputClassName}
                />
              </label>
              <label className="block space-y-2">
                <span className={fieldLabelClassName}>Logo</span>
                <div className="rounded-[1.5rem] border border-outline-variant/15 bg-background p-3">
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
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-low">
                      {form.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={form.logoUrl}
                          alt={form.brandName || form.name || 'Widget logo'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/50">
                          Logo
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-on-surface">
                        {form.logoUrl ? 'Logo ready' : 'Upload a logo'}
                      </p>
                      <p className="mt-1 text-xs leading-6 text-on-surface-variant">
                        PNG, JPG, WebP, SVG, or GIF. It will appear in the top-left of the widget.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      className="rounded-full bg-on-surface px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {isUploadingLogo ? 'Uploading...' : form.logoUrl ? 'Replace logo' : 'Upload logo'}
                    </button>
                    {form.logoUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  logoUrl: '',
                                }
                              : current,
                          )
                        }
                        className={secondaryButtonClassName}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </label>
              <div className="grid gap-3 sm:grid-cols-3 md:col-span-2">
                <label className="block space-y-2">
                  <span className={fieldLabelClassName}>Primary</span>
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(event) => setForm((current) => current ? { ...current, primaryColor: event.target.value } : current)}
                    className="h-12 w-full rounded-2xl border border-outline-variant/15 bg-background px-2"
                  />
                </label>
                <label className="block space-y-2">
                  <span className={fieldLabelClassName}>Background</span>
                  <input
                    type="color"
                    value={form.backgroundColor}
                    onChange={(event) => setForm((current) => current ? { ...current, backgroundColor: event.target.value } : current)}
                    className="h-12 w-full rounded-2xl border border-outline-variant/15 bg-background px-2"
                  />
                </label>
                <label className="block space-y-2">
                  <span className={fieldLabelClassName}>Text</span>
                  <input
                    type="color"
                    value={form.textColor}
                    onChange={(event) => setForm((current) => current ? { ...current, textColor: event.target.value } : current)}
                    className="h-12 w-full rounded-2xl border border-outline-variant/15 bg-background px-2"
                  />
                </label>
              </div>
              <label className="block space-y-2">
                <span className={fieldLabelClassName}>Language</span>
                <select
                  value={form.language}
                  onChange={(event) => setForm((current) => current ? { ...current, language: event.target.value } : current)}
                  className={inputClassName}
                >
                  <option value="en">English (EN)</option>
                  <option value="sv">Svenska (SV)</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className={fieldLabelClassName}>Theme</span>
                <select
                  value={form.theme}
                  onChange={(event) => setForm((current) => current ? { ...current, theme: event.target.value === 'light' ? 'light' : 'dark' } : current)}
                  className={inputClassName}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>
              
              <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
                <label className="block space-y-2">
                  <span className={fieldLabelClassName}>Home Title</span>
                  <input
                    value={form.homeTitle}
                    onChange={(event) => setForm((current) => current ? { ...current, homeTitle: event.target.value } : current)}
                    placeholder="e.g. How can we help?"
                    className={inputClassName}
                  />
                </label>
                <label className="block space-y-2">
                  <span className={fieldLabelClassName}>Home Subtitle</span>
                  <input
                    value={form.homeSubtitle}
                    onChange={(event) => setForm((current) => current ? { ...current, homeSubtitle: event.target.value } : current)}
                    placeholder="e.g. Choose the right specialist..."
                    className={inputClassName}
                  />
                </label>
              </div>
              <label className="flex items-center justify-between rounded-2xl border border-outline-variant/15 bg-background px-4 py-3">
                <span className="text-sm font-medium text-on-surface">Show branding</span>
                <input
                  type="checkbox"
                  checked={form.showBranding}
                  onChange={(event) => setForm((current) => current ? { ...current, showBranding: event.target.checked } : current)}
                  className="h-4 w-4 rounded border-outline-variant/20 text-on-surface"
                />
              </label>
              <label className="block space-y-2 md:col-span-2">
                <span className={fieldLabelClassName}>Privacy Policy</span>
                <input
                  value={form.privacyPolicyUrl}
                  onChange={(event) => setForm((current) => current ? { ...current, privacyPolicyUrl: event.target.value } : current)}
                  placeholder="https://example.com/privacy"
                  className={inputClassName}
                />
              </label>
              <label className="block space-y-2 md:col-span-2">
                <span className={fieldLabelClassName}>Allowed Origins</span>
                <textarea
                  value={form.allowedOrigins}
                  onChange={(event) => setForm((current) => current ? { ...current, allowedOrigins: event.target.value } : current)}
                  rows={4}
                  placeholder="https://example.com"
                  className={`${inputClassName} min-h-[124px] resize-none`}
                />
              </label>
            </div>
          </div>

          <div className={`${surfaceClassName} p-6 sm:p-7`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className={sectionLabelClassName}>Attached Agents</p>
                <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                  Choose the specialists this widget should expose on Home.
                </p>
              </div>
              <select
                defaultValue=""
                onChange={(event) => {
                  const value = event.target.value;
                  if (value) {
                    addAgent(value);
                    event.target.value = '';
                  }
                }}
                className={`${inputClassName} min-w-[15rem] sm:max-w-[16rem]`}
              >
                <option value="">Add agent</option>
                {unattachedAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 space-y-4">
              {attachedAgents.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-outline-variant/20 bg-background px-5 py-6 text-sm leading-7 text-on-surface-variant">
                  No agents attached yet.
                </div>
              ) : (
                attachedAgents.map((item, index) => (
                  <div
                    key={item.agentId}
                    className="rounded-[1.75rem] border border-outline-variant/10 bg-background px-5 py-5"
                  >
                    <div className="flex flex-col gap-4 border-b border-outline-variant/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-on-surface">{item.agent.name}</p>
                          <span
                            className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${
                              item.agent.published_version_id
                                ? 'border border-primary/20 bg-primary/10 text-primary'
                                : 'border border-outline-variant/10 bg-surface-container text-on-surface-variant'
                            }`}
                          >
                            {item.agent.published_version_id ? 'Published' : 'Unpublished'}
                          </span>
                          <span className="rounded-full border border-outline-variant/10 bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                            {item.interactionMode === 'contact_form' ? 'Contact form' : 'Chat'}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                          {item.description || 'This specialist appears on the widget home surface.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => moveAgent(index, -1)}
                          disabled={index === 0}
                          className={secondaryButtonClassName}
                        >
                          Up
                        </button>
                        <button
                          onClick={() => moveAgent(index, 1)}
                          disabled={index === attachedAgents.length - 1}
                          className={secondaryButtonClassName}
                        >
                          Down
                        </button>
                        <button
                          onClick={() => setAttachedAgents((current) => current.filter((entry) => entry.agentId !== item.agentId).map((entry, order) => ({ ...entry, sortOrder: order })))}
                          className={secondaryButtonClassName}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <label className="block space-y-2">
                        <span className={fieldLabelClassName}>Widget Label</span>
                        <input
                          value={item.label}
                          onChange={(event) => setAttachedAgents((current) => current.map((entry) => entry.agentId === item.agentId ? { ...entry, label: event.target.value } : entry))}
                          className={inputClassName}
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className={fieldLabelClassName}>Greeting Message</span>
                        <input
                          value={item.greeting || ''}
                          onChange={(event) => setAttachedAgents((current) => current.map((entry) => entry.agentId === item.agentId ? { ...entry, greeting: event.target.value } : entry))}
                          placeholder="e.g. Hi! How can I help you today?"
                          className={inputClassName}
                        />
                      </label>
                      <label className="block space-y-2 md:col-span-2">
                        <span className={fieldLabelClassName}>Short Description</span>
                        <textarea
                          value={item.description}
                          onChange={(event) => setAttachedAgents((current) => current.map((entry) => entry.agentId === item.agentId ? { ...entry, description: event.target.value } : entry))}
                          rows={3}
                          className={`${inputClassName} resize-none`}
                        />
                      </label>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <div className={`${surfaceClassName} p-6`}>
            <p className={sectionLabelClassName}>Preview</p>
            <p className="mt-3 text-sm leading-7 text-on-surface-variant">
              Use the docked bubble for quick checks, or open a clean internal preview page before you save or deploy.
            </p>

            <div className="mt-5 rounded-[1.6rem] border border-outline-variant/10 bg-background px-5 py-4">
              <p className={fieldLabelClassName}>Current Status</p>
              <p className="mt-3 text-lg font-semibold text-on-surface">
                {previewStatus === 'ready'
                  ? 'Draft preview ready'
                  : previewStatus === 'error'
                    ? 'Preview unavailable'
                    : 'Preparing preview'}
              </p>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                {previewStatus === 'ready'
                  ? 'The bubble is running against a fresh internal draft snapshot.'
                  : previewStatus === 'error'
                    ? previewError || 'The preview snapshot could not be created.'
                    : 'Refreshing the draft snapshot as you edit the widget.'}
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                onClick={openPreview}
                disabled={!draftPreview?.previewUrl || previewStatus !== 'ready'}
                className="rounded-full bg-on-surface px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Open preview
              </button>
              <button
                onClick={() => void handleCopy(draftPreview?.previewUrl || '', 'Preview URL')}
                disabled={!draftPreview?.previewUrl || previewStatus !== 'ready'}
                className={`${secondaryButtonClassName} px-5 py-3 text-sm text-on-surface`}
              >
                Copy preview URL
              </button>
            </div>
          </div>

          <div className={`${surfaceClassName} p-6`}>
            <p className={sectionLabelClassName}>Install</p>
            <p className="mt-3 text-sm leading-7 text-on-surface-variant">
              Use a hosted link for direct access or paste the loader snippet into the client site.
            </p>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <p className={fieldLabelClassName}>Hosted URL</p>
                <button
                  onClick={() => void handleCopy(summary.hostedUrl, 'Hosted URL')}
                  className={secondaryButtonClassName}
                >
                  Copy
                </button>
              </div>
              <pre className={codeBlockClassName}>{summary.hostedUrl}</pre>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <p className={fieldLabelClassName}>Embed Snippet</p>
                <button
                  onClick={() => void handleCopy(summary.embedSnippet, 'Embed snippet')}
                  className={secondaryButtonClassName}
                >
                  Copy
                </button>
              </div>
              <pre className={codeBlockClassName}>{summary.embedSnippet}</pre>
            </div>
          </div>

          <div className={`${surfaceClassName} p-6`}>
            <p className={sectionLabelClassName}>Structure</p>
            <p className="mt-3 text-sm leading-7 text-on-surface-variant">
              Review the specialist order and how each one will appear on the widget home screen.
            </p>
            <div className="mt-5 space-y-3">
              {attachedAgents.length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-outline-variant/15 bg-background px-4 py-4 text-sm leading-6 text-on-surface-variant">
                  No specialists attached yet.
                </div>
              ) : (
                attachedAgents.map((item, index) => (
                  <div
                    key={item.agentId}
                    className="rounded-[1.5rem] border border-outline-variant/10 bg-background px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-on-surface">{item.label}</p>
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/60">
                        #{index + 1}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                      {item.description || 'Shows as a selectable specialist on Home.'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
