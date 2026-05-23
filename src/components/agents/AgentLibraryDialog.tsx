"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, Clock3, Database, Download, Plug, Search, XCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { TemplateVariableSetup } from "@/components/agents/TemplateVariableSetup";
import { useToast } from "@/components/ui/ToastProvider";
import { parseTemplateVariables } from "@/lib/template-variables";
import type {
  AgentLibraryTemplateRecord,
  AgentLibraryTemplateSourceRecord,
} from "@/lib/types";

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

  /**
   * When a template has {{variables}}, we store it here and show the
   * TemplateVariableSetup panel. null = show the normal library grid.
   */
  const [setupTemplate, setSetupTemplate] = useState<LibraryTemplate | null>(null);

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

  // Reset setup panel when dialog is closed
  useEffect(() => {
    if (!isOpen) setSetupTemplate(null);
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

  /**
   * Perform the actual import POST request.
   * variableValues is optional — only passed when the template had variables.
   */
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

  /**
   * Called when the user clicks "Import Template" on a card.
   * If the template has {{variables}}, show the setup panel first.
   * Otherwise, import directly (original behaviour — no regression).
   */
  function handleImportClick(template: LibraryTemplate) {
    const variables = parseTemplateVariables(template.instructions);
    if (variables.length > 0) {
      setSetupTemplate(template);
    } else {
      void importTemplate(template);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agent Library" size="6xl">
      <div className="space-y-8 pb-4">
        {/* ── Setup step (slides in when template has variables) ── */}
        {setupTemplate ? (
          <TemplateVariableSetup
            templateName={setupTemplate.name}
            variables={parseTemplateVariables(setupTemplate.instructions)}
            isImporting={importingId === setupTemplate.id}
            onBack={() => setSetupTemplate(null)}
            onImport={(values) => void importTemplate(setupTemplate, values)}
          />
        ) : (
          <>
            {/* Header Section */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
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
                  className="w-full rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/50 py-3.5 pl-12 pr-4 text-sm font-medium text-on-surface shadow-sm outline-none transition-all duration-300 placeholder:text-on-surface-variant/40 hover:bg-surface-container-lowest focus:border-primary/50 focus:bg-surface-container-lowest focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-outline-variant/10 pb-6">
              <div className="flex inline-flex p-1 rounded-full bg-surface-container-lowest border border-outline-variant/10 shadow-inner">
                {[
                  { id: "library" as const, label: "Public library", count: templates.length },
                  { id: "submissions" as const, label: "Your submissions", count: submissions.length },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`relative rounded-full px-6 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-all duration-300 ${
                      activeView === item.id
                        ? "bg-on-surface text-background shadow-md"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {item.label} <span className={`ml-1 ${activeView === item.id ? "opacity-80" : "opacity-60"}`}>({item.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content Grid */}
            <div className="min-h-[20rem]">
              {isLoading ? (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[20rem] animate-pulse rounded-3xl bg-surface-container-low/50 border border-outline-variant/5"
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
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {filteredTemplates.map((template) => (
                    (() => {
                      const meta = statusMeta(template.status);
                      const StatusIcon = meta.icon;
                      // Count how many variables this template has
                      const variableCount = parseTemplateVariables(template.instructions).length;

                      return (
                        <article
                          key={template.id}
                          className="group relative flex flex-col h-[22rem] overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                          style={{ animationDelay: `${Math.random() * 150}ms` }}
                        >
                          {/* Subtle Background Glow */}
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                          <div className="relative z-10 flex flex-col h-full">
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <span className="inline-flex items-center rounded-md bg-surface-container-high/50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80 ring-1 ring-inset ring-primary/20">
                                    {template.surface}
                                  </span>
                                  {/* Variable badge */}
                                  {variableCount > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-surface-container-high/50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/60 ring-1 ring-inset ring-outline-variant/20">
                                      <span className="material-symbols-outlined text-[11px]">edit</span>
                                      {variableCount} {variableCount === 1 ? "variable" : "variables"}
                                    </span>
                                  )}
                                  {activeView === "submissions" ? (
                                    <span
                                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ring-1 ring-inset ${meta.className} ring-current/20`}
                                    >
                                      <StatusIcon className="h-3 w-3" />
                                      {meta.label}
                                    </span>
                                  ) : null}
                                </div>
                                <h2 className="truncate text-xl font-black tracking-tight text-on-surface group-hover:text-primary transition-colors duration-300">
                                  {template.name}
                                </h2>
                              </div>
                            </div>

                            {/* Description */}
                            <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-on-surface-variant/70">
                              {template.description || "No description provided."}
                            </p>

                            {/* Rejection Reason */}
                            {activeView === "submissions" && template.status === "rejected" && template.rejection_reason ? (
                              <div className="mt-4 rounded-2xl border border-red-500/15 bg-red-500/5 px-4 py-3 text-xs leading-relaxed text-red-700 dark:text-red-300">
                                <span className="font-bold flex items-center gap-1.5 mb-1"><XCircle className="w-3.5 h-3.5"/> Feedback</span>
                                {template.rejection_reason}
                              </div>
                            ) : null}

                            {/* Stats Grid */}
                            <div className={`mt-auto pt-6 grid grid-cols-2 gap-3 text-xs ${activeView === "submissions" && template.status === "rejected" && template.rejection_reason ? 'hidden' : ''}`}>
                              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/50 px-4 py-3 transition-colors duration-300 group-hover:bg-surface-container-low">
                                <div className="flex items-center gap-2 text-on-surface-variant/60 font-medium">
                                  <Database className="h-3.5 w-3.5" />
                                  Knowledge
                                </div>
                                <p className="mt-2 font-black text-base text-on-surface">
                                  {template.knowledge_source_count} <span className="text-xs font-medium text-on-surface-variant/50">sources</span>
                                </p>
                              </div>
                              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/50 px-4 py-3 transition-colors duration-300 group-hover:bg-surface-container-low">
                                <div className="flex items-center gap-2 text-on-surface-variant/60 font-medium">
                                  <Plug className="h-3.5 w-3.5" />
                                  Integrations
                                </div>
                                <p className="mt-2 truncate font-bold text-on-surface text-sm">
                                  {template.required_integrations.length > 0
                                    ? template.required_integrations.join(", ")
                                    : "None"}
                                </p>
                              </div>
                            </div>

                            {/* Action Button */}
                            <div className="mt-6">
                              {activeView === "library" ? (
                                <button
                                  onClick={() => handleImportClick(template)}
                                  disabled={importingId === template.id}
                                  className="group/btn relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-on-surface px-4 text-xs font-bold uppercase tracking-[0.16em] text-background transition-all duration-300 hover:shadow-lg hover:shadow-on-surface/20 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                                >
                                  <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform duration-300 group-hover/btn:translate-y-0" />
                                  <span className="relative flex items-center gap-2">
                                    <Download className="h-4 w-4 transition-transform duration-300 group-hover/btn:-translate-y-0.5" />
                                    {importingId === template.id ? "Importing..." : variableCount > 0 ? "Set Up & Import" : "Import Template"}
                                  </span>
                                </button>
                              ) : (
                                <div className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-bold uppercase tracking-[0.16em] ${meta.className} border-current/20 bg-transparent`}>
                                  <StatusIcon className="h-4 w-4" />
                                  {meta.label}
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })()
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
