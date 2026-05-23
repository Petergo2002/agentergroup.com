"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Database, Plug, Search, ShieldCheck, X } from "lucide-react";
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

  return (
    <div className="space-y-8 admin-fade-in">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-neutral-500">
            Agent Library
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Verification
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-500">
            Review submitted templates before they become available in the public library.
          </p>
        </div>

        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search queue..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/20"
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
                ? "bg-white text-black"
                : "bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            {status} ({templates.filter((template) => template.status === status).length})
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {filteredTemplates.length === 0 ? (
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] px-8 py-20 text-center">
          <Clock className="mx-auto h-9 w-9 text-neutral-600" />
          <h2 className="mt-4 text-lg font-semibold text-white">No templates in this view</h2>
          <p className="mt-2 text-sm text-neutral-500">
            New submissions will appear here when users publish agents to the library.
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          {filteredTemplates.map((template) => (
            <article
              key={template.id}
              className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"
            >
              <div className="flex flex-col gap-5 border-b border-white/10 p-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-300">
                      {template.surface}
                    </span>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-neutral-400">
                      {template.model}
                    </span>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-white">{template.name}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
                    {template.description || "No description provided."}
                  </p>
                  <p className="mt-3 text-xs text-neutral-500">
                    Submitted by {template.submitter?.email ?? "unknown"} from{" "}
                    {template.source_workspace?.name ?? "unknown workspace"}
                  </p>
                </div>

                {template.status === "pending" ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => void reviewTemplate(template, "reject")}
                      disabled={busyId === template.id}
                      className="flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-xs font-semibold text-neutral-300 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => void reviewTemplate(template, "approve")}
                      disabled={busyId === template.id}
                      className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-xs font-semibold text-neutral-300">
                    <ShieldCheck className="h-4 w-4" />
                    {template.status}
                  </div>
                )}
              </div>

              <div className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Prompt
                  </p>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-neutral-200">
                    {template.instructions || "No prompt provided."}
                  </pre>
                </section>

                <aside className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      <Plug className="h-3.5 w-3.5" />
                      Required integrations
                    </div>
                    <p className="mt-3 text-sm text-neutral-200">
                      {template.required_integrations.length > 0
                        ? template.required_integrations.join(", ")
                        : "None"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      <Database className="h-3.5 w-3.5" />
                      Knowledge
                    </div>
                    <p className="mt-3 text-sm text-neutral-200">
                      {template.sources.length} selected sources
                    </p>
                  </div>
                </aside>
              </div>

              {template.sources.length > 0 ? (
                <div className="space-y-3 border-t border-white/10 p-6">
                  {template.sources.map((source) => (
                    <details
                      key={source.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <summary className="cursor-pointer text-sm font-semibold text-white">
                        {source.source_name}
                      </summary>
                      <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-neutral-300">
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
