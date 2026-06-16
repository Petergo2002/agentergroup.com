"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Database, Plug, Search, ShieldCheck, Trash2, X } from "lucide-react";
import type {
  AgentLibraryTemplateRecord,
  AgentLibraryTemplateSourceRecord,
} from "@/lib/types";

type VerificationTemplate = AgentLibraryTemplateRecord & {
  sources: AgentLibraryTemplateSourceRecord[];
  submitter?: { email: string | null } | null;
  source_workspace?: { name: string | null } | null;
};

export default function AdminVerificationPageClient() {
  const [templates, setTemplates] = useState<VerificationTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadTemplates() {
    setError(null);
    const response = await fetch("/api/admin/agent-library", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Failed to load verification queue.");
      return;
    }
    setTemplates(payload.templates ?? []);
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return templates.filter((template) => {
      if (template.status !== activeStatus) return false;
      if (!normalizedQuery) return true;

      return [
        template.name,
        template.description,
        template.instructions,
        template.submitter?.email ?? "",
        template.source_workspace?.name ?? "",
        ...template.required_integrations,
        ...template.sources.map((source) => `${source.source_name} ${source.content_text}`),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeStatus, query, templates]);

  const reviewTemplate = async (
    template: VerificationTemplate,
    action: "approve" | "reject",
  ) => {
    const rejectionReason =
      action === "reject"
        ? window.prompt("Why is this template rejected?")?.trim() ?? ""
        : "";

    if (action === "reject" && !rejectionReason) {
      return;
    }

    setBusyId(template.id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/agent-library/${template.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to update template.");
      await loadTemplates();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Failed to update template.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const deleteTemplate = async (template: VerificationTemplate) => {
    const confirmed = window.confirm(
      `Remove "${template.name}" from the agent library? This also removes its bundled knowledge snapshot.`,
    );

    if (!confirmed) return;

    setBusyId(template.id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/agent-library/${template.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to remove template.");
      await loadTemplates();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to remove template.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8 admin-fade-in">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-on-surface-variant">
            Agent Library
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-on-surface">
            Verification
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-on-surface-variant">
            Review submitted templates before they become available in the public library.
          </p>
        </div>

        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search queue..."
            className="w-full rounded-xl border border-outline bg-surface py-3 pl-11 pr-4 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setActiveStatus(status)}
            className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition-colors ${
              activeStatus === status
                ? "bg-on-surface text-surface"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            {status} ({templates.filter((template) => template.status === status).length})
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      {filteredTemplates.length === 0 ? (
        <section className="rounded-3xl border border-outline bg-surface px-8 py-20 text-center shadow-tactile">
          <Clock className="mx-auto h-9 w-9 text-on-surface-variant" />
          <h2 className="mt-4 text-lg font-semibold text-on-surface">No templates in this view</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            New submissions will appear here when users publish agents to the library.
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          {filteredTemplates.map((template) => (
            <article
              key={template.id}
              className="overflow-hidden rounded-3xl border border-outline bg-surface shadow-tactile"
            >
              <div className="flex flex-col gap-5 border-b border-outline p-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface">
                      {template.surface}
                    </span>
                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-[11px] font-semibold text-on-surface-variant">
                      {template.model}
                    </span>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-on-surface">{template.name}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
                    {template.description || "No description provided."}
                  </p>
                  <p className="mt-3 text-xs text-on-surface-variant">
                    Submitted by {template.submitter?.email ?? "unknown"} from{" "}
                    {template.source_workspace?.name ?? "unknown workspace"}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {template.status === "pending" ? (
                    <>
                      <button
                        onClick={() => void reviewTemplate(template, "reject")}
                        disabled={busyId === template.id}
                        className="flex h-10 items-center gap-2 rounded-full border border-outline px-4 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </button>
                      <button
                        onClick={() => void reviewTemplate(template, "approve")}
                        disabled={busyId === template.id}
                        className="flex h-10 items-center gap-2 rounded-full bg-on-surface px-4 text-xs font-semibold text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </button>
                    </>
                  ) : (
                    <div className="flex h-10 items-center gap-2 rounded-full bg-surface-container-low px-4 text-xs font-semibold text-on-surface-variant">
                      <ShieldCheck className="h-4 w-4" />
                      {template.status}
                    </div>
                  )}
                  <button
                    onClick={() => void deleteTemplate(template)}
                    disabled={busyId === template.id}
                    className="flex h-10 items-center gap-2 rounded-full border border-red-500/20 px-4 text-xs font-semibold text-error transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    title="Remove from library"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <section className="rounded-2xl border border-outline bg-surface-container-low p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                    Prompt
                  </p>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-on-surface">
                    {template.instructions || "No prompt provided."}
                  </pre>
                </section>

                <aside className="space-y-3">
                  <div className="rounded-2xl border border-outline bg-surface-container-low p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                      <Plug className="h-3.5 w-3.5" />
                      Required integrations
                    </div>
                    <p className="mt-3 text-sm text-on-surface">
                      {template.required_integrations.length > 0
                        ? template.required_integrations.join(", ")
                        : "None"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-outline bg-surface-container-low p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                      <Database className="h-3.5 w-3.5" />
                      Knowledge
                    </div>
                    <p className="mt-3 text-sm text-on-surface">
                      {template.sources.length} selected sources
                    </p>
                  </div>
                </aside>
              </div>

              {template.sources.length > 0 ? (
                <div className="space-y-3 border-t border-outline p-6">
                  {template.sources.map((source) => (
                    <details
                      key={source.id}
                      className="rounded-2xl border border-outline bg-surface-container-low p-4"
                    >
                      <summary className="cursor-pointer text-sm font-semibold text-on-surface">
                        {source.source_name}
                      </summary>
                      <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-on-surface-variant">
                        {source.content_text}
                      </pre>
                    </details>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
