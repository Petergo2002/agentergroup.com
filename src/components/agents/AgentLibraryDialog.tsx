"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bot, CheckCircle2, Clock3, Database, Download, Plug, Search, X, XCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { TemplateVariableSetup } from "@/components/agents/TemplateVariableSetup";
import { SimpleIcon } from "@/components/icons/SimpleIcon";
import { useToast } from "@/components/ui/ToastProvider";
import { parseTemplateVariables } from "@/lib/template-variables";
import type {
  AgentLibraryTemplateRecord,
  AgentLibraryTemplateSourceRecord,
} from "@/lib/types";

/** Maps an integration slug (from required_integrations) to its SimpleIcon key and brand colour. */
const INTEGRATION_ICON_MAP: Record<string, { iconKey: string; color: string; label: string }> = {
  gmail:           { iconKey: "siGmail",             color: "#EA4335", label: "Gmail" },
  outlook:         { iconKey: "siMicrosoftoutlook",  color: "#0078D4", label: "Outlook" },
  slack:           { iconKey: "siSlack",             color: "#4A154B", label: "Slack" },
  hubspot:         { iconKey: "siHubspot",           color: "#FF7A59", label: "HubSpot" },
  shopify:         { iconKey: "siShopify",           color: "#7AB55C", label: "Shopify" },
  googleads:       { iconKey: "siGoogleads",         color: "#4285F4", label: "Google Ads" },
  googlecalendar:  { iconKey: "siGooglecalendar",    color: "#4285F4", label: "Calendar" },
  cal:             { iconKey: "siCalcom",            color: "#292929", label: "Cal.com" },
  googledrive:     { iconKey: "siGoogledrive",       color: "#4285F4", label: "Drive" },
};

type LibraryTemplate = AgentLibraryTemplateRecord & {
  sources: Pick<
    AgentLibraryTemplateSourceRecord,
    "id" | "source_name" | "original_source_type"
  >[];
};

interface AgentLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentLibraryDialog({ isOpen, onClose }: AgentLibraryDialogProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<LibraryTemplate[]>([]);
  const [submissions, setSubmissions] = useState<LibraryTemplate[]>([]);
  const [activeView, setActiveView] = useState<"library" | "submissions">("library");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  const [setupTemplate, setSetupTemplate] = useState<LibraryTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<LibraryTemplate | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadTemplates() {
      setIsLoading(true);
      try {
        const [libraryResponse, submissionsResponse] = await Promise.all([
          fetch("/api/agent-library", { cache: "no-store" }),
          fetch("/api/agent-library/submissions", { cache: "no-store" }),
        ]);
        const [libraryPayload, submissionsPayload] = await Promise.all([
          libraryResponse.json(),
          submissionsResponse.json(),
        ]);
        if (!libraryResponse.ok) {
          throw new Error(libraryPayload.error ?? "Failed to load templates.");
        }
        if (!submissionsResponse.ok) {
          throw new Error(submissionsPayload.error ?? "Failed to load submissions.");
        }
        if (!cancelled) {
          setTemplates(libraryPayload.templates ?? []);
          setSubmissions(submissionsPayload.templates ?? []);
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Failed to load templates.", "error");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [isOpen, showToast]);

  // Reset panels when dialog is closed
  useEffect(() => {
    if (!isOpen) {
      setSetupTemplate(null);
      setSelectedTemplate(null);
    }
  }, [isOpen]);

  const visibleTemplates = activeView === "library" ? templates : submissions;

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return visibleTemplates;

    return visibleTemplates.filter((template) => {
      const haystack = [
        template.name,
        template.description,
        template.model,
        template.surface,
        template.status,
        template.rejection_reason ?? "",
        ...template.required_integrations,
        ...template.sources.map((source) => source.source_name),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [query, visibleTemplates]);

  const statusMeta = (status: LibraryTemplate["status"]) => {
    switch (status) {
      case "approved":
        return {
          icon: CheckCircle2,
          label: "Approved",
          className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        };
      case "rejected":
        return {
          icon: XCircle,
          label: "Rejected",
          className: "bg-red-500/10 text-red-700 dark:text-red-300",
        };
      default:
        return {
          icon: Clock3,
          label: "Pending",
          className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        };
    }
  };

  const importTemplate = async (
    template: LibraryTemplate,
    variableValues?: Record<string, string>,
  ) => {
    setImportingId(template.id);

    try {
      const response = await fetch(`/api/agent-library/${template.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variableValues: variableValues ?? {} }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to import template.");

      showToast("Template imported. Reconnect any required integrations in the builder.", "success");
      onClose();
      router.push(`/agents/${payload.agent.id}/builder`);
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to import template.", "error");
    } finally {
      setImportingId(null);
    }
  };

  function handleImportClick(template: LibraryTemplate) {
    const variables = parseTemplateVariables(template.instructions);
    if (variables.length > 0) {
      setSetupTemplate(template);
    } else {
      void importTemplate(template);
    }
  }

  const renderFullView = () => {
    if (!selectedTemplate) return null;

    const variableCount = parseTemplateVariables(selectedTemplate.instructions).length;
    const meta = statusMeta(selectedTemplate.status);
    const StatusIcon = meta?.icon;

    return (
      <div className="animate-in slide-in-from-right-8 fade-in duration-500 fill-mode-both pb-6">
        <button
          onClick={() => setSelectedTemplate(null)}
          className="mb-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors group/back"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover/back:-translate-x-1" /> Back to library
        </button>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Left Column: Meta & Actions */}
          <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-6">
            <div className="flex aspect-square w-full items-center justify-center rounded-[2.5rem] bg-surface-container-lowest text-primary font-black text-7xl shadow-sm border border-outline-variant/10 relative overflow-hidden group/avatar">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
              <span className="relative z-10 transition-transform duration-500 group-hover/avatar:scale-110">
                {selectedTemplate.name.charAt(0).toUpperCase()}
              </span>
            </div>

            <div className="flex flex-col gap-4 rounded-3xl border border-outline-variant/10 bg-surface-container-lowest/50 p-6 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary ring-1 ring-inset ring-primary/20">
                  {selectedTemplate.surface}
                </span>
                {variableCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-surface-container-high/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/60 ring-1 ring-inset ring-outline-variant/20">
                    <span className="material-symbols-outlined text-[12px]">edit</span>
                    {variableCount} variables
                  </span>
                )}
                {activeView === "submissions" && StatusIcon && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] ring-1 ring-inset ${meta.className} ring-current/20`}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {meta.label}
                  </span>
                )}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl bg-surface-container p-4">
                  <div className="flex items-center gap-2 text-on-surface-variant/60 font-medium mb-2">
                    <Database className="h-3.5 w-3.5" /> Knowledge
                  </div>
                  <p className="font-black text-lg text-on-surface">
                    {selectedTemplate.knowledge_source_count} <span className="text-xs font-medium text-on-surface-variant/50">sources</span>
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-container p-4">
                  <div className="flex items-center gap-2 text-on-surface-variant/60 font-medium mb-2">
                    <Plug className="h-3.5 w-3.5" /> Integrations
                  </div>
                  {selectedTemplate.required_integrations.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedTemplate.required_integrations.map((slug) => {
                        const info = INTEGRATION_ICON_MAP[slug];
                        return (
                          <div
                            key={slug}
                            title={info?.label ?? slug}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-container-lowest border border-outline-variant/10 shadow-sm transition-transform hover:scale-110"
                          >
                            {info ? (
                              <SimpleIcon iconKey={info.iconKey} color={info.color} size={16} />
                            ) : (
                              <Plug className="h-3.5 w-3.5 text-on-surface-variant/50" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="font-bold text-on-surface text-sm">None</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Button */}
            {activeView === "library" ? (
              <button
                onClick={() => handleImportClick(selectedTemplate)}
                disabled={importingId === selectedTemplate.id}
                className="app-primary-surface group/btn relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-[1.25rem] px-6 text-sm font-bold uppercase tracking-[0.16em] transition-all duration-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform duration-300 group-hover/btn:translate-y-0" />
                <span className="relative flex items-center gap-2">
                  <Download className="h-5 w-5 transition-transform duration-300 group-hover/btn:-translate-y-0.5 group-hover/btn:scale-110" />
                  {importingId === selectedTemplate.id
                    ? "Importing..."
                    : variableCount > 0
                      ? "Set Up & Import"
                      : "Import Template"}
                </span>
              </button>
            ) : null}

            {/* Rejection Feedback */}
            {activeView === "submissions" && selectedTemplate.status === "rejected" && selectedTemplate.rejection_reason && (
              <div className="rounded-2xl border border-red-500/15 bg-red-500/5 p-5 text-sm leading-relaxed text-red-700 dark:text-red-300">
                <span className="font-bold flex items-center gap-2 mb-2 text-base">
                  <XCircle className="w-5 h-5" /> Rejection Feedback
                </span>
                {selectedTemplate.rejection_reason}
              </div>
            )}
          </div>

          {/* Right Column: Details */}
          <div className="flex-1 min-w-0">
            <h2 className="text-4xl font-black text-on-surface tracking-tight mb-8 leading-tight">
              {selectedTemplate.name}
            </h2>

            <div className="space-y-8">
              <section>
                <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4 flex items-center gap-2">
                  <Bot className="h-4 w-4" /> About this template
                </h3>
                <p className="text-base leading-relaxed text-on-surface-variant/80 whitespace-pre-wrap">
                  {selectedTemplate.description || "No description provided."}
                </p>
              </section>

              {selectedTemplate.sources && selectedTemplate.sources.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4 flex items-center gap-2">
                    <Database className="h-4 w-4" /> Attached Knowledge
                  </h3>
                  <div className="flex flex-col gap-2">
                    {selectedTemplate.sources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-center gap-3 rounded-xl bg-surface-container-lowest border border-outline-variant/10 p-4 text-sm font-medium text-on-surface"
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-primary/60" />
                        {source.source_name}
                        <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/40 bg-surface-container px-2 py-1 rounded-md">
                          {source.original_source_type}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {selectedTemplate.required_integrations.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4 flex items-center gap-2">
                    <Plug className="h-4 w-4" /> Required Connections
                  </h3>
                  <div className="flex flex-col gap-2">
                    {selectedTemplate.required_integrations.map((slug) => {
                      const info = INTEGRATION_ICON_MAP[slug];
                      return (
                        <div
                          key={slug}
                          className="flex items-center gap-3 rounded-xl bg-surface-container-lowest border border-outline-variant/10 p-4 text-sm font-medium text-on-surface transition-colors hover:border-primary/20"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container border border-outline-variant/10 shadow-sm">
                            {info ? (
                              <SimpleIcon iconKey={info.iconKey} color={info.color} size={18} />
                            ) : (
                              <Plug className="h-4 w-4 text-on-surface-variant/50" />
                            )}
                          </div>
                          {info?.label ?? slug}
                          <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/40 bg-surface-container px-2 py-1 rounded-md">
                            Required
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agent Library" size="6xl">
      <div className="space-y-8 pb-4">
        {setupTemplate ? (
          <TemplateVariableSetup
            templateName={setupTemplate.name}
            variables={parseTemplateVariables(setupTemplate.instructions)}
            isImporting={importingId === setupTemplate.id}
            onBack={() => setSetupTemplate(null)}
            onImport={(values) => void importTemplate(setupTemplate, values)}
          />
        ) : selectedTemplate ? (
          renderFullView()
        ) : (
          <div className="animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
              <div className="max-w-2xl">
                <p className="text-base leading-relaxed text-on-surface-variant/80">
                  Import approved templates with their prompt, tools, and selected knowledge. Connections are seamlessly reattached from your workspace.
                </p>
              </div>

              <div className="relative w-full group lg:max-w-sm">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <Search className="h-5 w-5 text-on-surface-variant/40 transition-colors group-focus-within:text-primary" />
                </div>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search templates..."
                  className="w-full rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/50 py-3.5 pl-12 pr-10 text-sm font-medium text-on-surface shadow-sm outline-none transition-all duration-300 placeholder:text-on-surface-variant/40 hover:bg-surface-container-lowest focus:border-primary/50 focus:bg-surface-container-lowest focus:ring-4 focus:ring-primary/10"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-on-surface-variant/40 hover:text-on-surface"
                    aria-label="Clear search query"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-outline-variant/10 pb-6 mb-8">
              <div className="flex inline-flex p-1 rounded-full bg-surface-container-lowest border border-outline-variant/10 shadow-inner">
                {[
                  { id: "library" as const, label: "Public library", count: templates.length },
                  { id: "submissions" as const, label: "Your submissions", count: submissions.length },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`relative flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-all duration-300 ${
                      activeView === item.id
                        ? "bg-on-surface text-background shadow-md"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {item.label}
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        activeView === item.id
                          ? "bg-background/20 text-background"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content Grid */}
            <div className="min-h-[20rem]">
              {isLoading ? (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[14rem] animate-pulse rounded-3xl bg-surface-container-low/50 border border-outline-variant/5"
                    />
                  ))}
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-3xl border border-dashed border-outline-variant/20 bg-surface-container-lowest/30 px-8 py-16 text-center animate-in fade-in zoom-in-95 duration-500">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 ring-8 ring-primary/5 mb-6">
                    <Bot className="h-10 w-10 text-primary/50" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-on-surface">No templates found</h2>
                  <p className="mt-3 max-w-sm text-base leading-relaxed text-on-surface-variant/60">
                    {activeView === "library"
                      ? "Approved templates will appear here after admin verification."
                      : "Templates you submit from the builder will appear here with their review status."}
                  </p>
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredTemplates.map((template) => {
                    const meta = statusMeta(template.status);
                    const StatusIcon = meta.icon;
                    const variableCount = parseTemplateVariables(template.instructions).length;

                    return (
                      <article
                        key={template.id}
                        onClick={() => setSelectedTemplate(template)}
                        className="group relative flex flex-col h-[15rem] cursor-pointer overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                        style={{ animationDelay: `${Math.random() * 150}ms` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                        <div className="relative z-10 flex flex-col h-full">
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-container-high/30 text-primary font-black text-xl shadow-inner border border-outline-variant/10 transition-transform duration-300 group-hover:scale-110">
                              {template.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <h2 className="truncate text-base font-black tracking-tight text-on-surface group-hover:text-primary transition-colors duration-300">
                                {template.name}
                              </h2>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center rounded bg-surface-container-high/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-primary/80 ring-1 ring-inset ring-primary/20">
                                  {template.surface}
                                </span>
                                {activeView === "submissions" && (
                                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ring-1 ring-inset ${meta.className} ring-current/20`}>
                                    <StatusIcon className="h-2.5 w-2.5" />
                                    {meta.label}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-on-surface-variant/70">
                            {template.description || "No description provided."}
                          </p>

                          <div className="mt-auto flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {template.required_integrations.length > 0 && (
                                <div className="flex items-center -space-x-1">
                                  {template.required_integrations.slice(0, 4).map((slug) => {
                                    const info = INTEGRATION_ICON_MAP[slug];
                                    return (
                                      <div
                                        key={slug}
                                        title={info?.label ?? slug}
                                        className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container border border-outline-variant/10 shadow-sm"
                                      >
                                        {info ? (
                                          <SimpleIcon iconKey={info.iconKey} color={info.color} size={14} />
                                        ) : (
                                          <Plug className="h-3 w-3 text-on-surface-variant/50" />
                                        )}
                                      </div>
                                    );
                                  })}
                                  {template.required_integrations.length > 4 && (
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container border border-outline-variant/10 shadow-sm text-[9px] font-bold text-on-surface-variant/60">
                                      +{template.required_integrations.length - 4}
                                    </div>
                                  )}
                                </div>
                              )}
                              {variableCount > 0 && (
                                <span className="inline-flex items-center text-[10px] font-bold text-on-surface-variant/50">
                                  <span className="material-symbols-outlined text-[12px] mr-1">edit</span>
                                  Variables
                                </span>
                              )}
                            </div>
                            <div className="flex items-center text-[11px] font-bold uppercase tracking-wider text-primary opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                              View Details <ArrowRight className="ml-1 h-3.5 w-3.5" />
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
