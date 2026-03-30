"use client";

import { FileText, CheckCircle2, Clock, AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import type { KnowledgeSourceRecord } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";

interface SourceTableProps {
  sources: KnowledgeSourceRecord[];
  isLoading: boolean;
  onProcess: (id: string) => void;
  onDelete: (source: KnowledgeSourceRecord) => void;
  processingId?: string | null;
  deletingId?: string | null;
}

export function SourceTable({
  sources,
  isLoading,
  onProcess,
  onDelete,
  processingId,
  deletingId,
}: SourceTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 w-full rounded-xl skeleton" />
        ))}
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-container-low/50 px-6 py-20 text-center ring-1 ring-inset ring-outline-variant/10">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container text-on-surface-variant/40">
          <FileText className="h-8 w-8" />
        </div>
        <h3 className="mt-6 text-lg font-bold text-on-surface">No sources found</h3>
        <p className="mt-2 max-w-sm text-sm text-on-surface-variant/70 text-balance">
          You haven&apos;t added any knowledge yet. Use the bento grid above to add your first source.
        </p>
      </div>
    );
  }

  return (
    <div className="group/table relative overflow-hidden rounded-2xl bg-surface-container-low shadow-sm ring-1 ring-outline-variant/10">
      <div className="overflow-x-auto font-label">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container/60 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/80">
              <th className="px-6 py-5">Source Name</th>
              <th className="px-6 py-5">Type</th>
              <th className="px-6 py-5 text-center">Status</th>
              <th className="px-6 py-5">Last Modified</th>
              <th className="px-6 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {sources.map((source) => {
              const isProcessing = processingId === source.id;
              const isDeleting = deletingId === source.id;
              const status = source.status;

              return (
                <tr 
                  key={source.id} 
                  className="group/row transition-all hover:bg-surface-container-lowest active:bg-surface-container-high/20"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant group-hover/row:bg-primary/10 group-hover/row:text-primary transition-colors">
                        <FileText className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-on-surface tracking-tight">
                          {source.name}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-on-surface-variant/60">
                          {source.chunk_count} chunks • {source.description || "No description"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-lg bg-surface-container-high px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      {source.source_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all">
                      {status === "ready" && (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          <span className="text-success uppercase tracking-wider">Ready</span>
                        </>
                      )}
                      {status === "processing" && (
                        <>
                          <Clock className="h-3.5 w-3.5 text-primary animate-pulse" />
                          <span className="text-primary uppercase tracking-wider">Syncing</span>
                        </>
                      )}
                      {status === "failed" && (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 text-error" />
                          <span className="text-error uppercase tracking-wider">Failed</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-on-surface-variant/80 font-medium">
                    {formatRelativeDate(source.updated_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onProcess(source.id)}
                        disabled={isProcessing}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary disabled:opacity-50 transition-colors"
                        title="Reprocess source"
                      >
                        <RefreshCw className={`h-4 w-4 ${isProcessing ? "animate-spin" : ""}`} />
                      </button>
                      <button
                        onClick={() => onDelete(source)}
                        disabled={isDeleting}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error disabled:opacity-50 transition-colors"
                        title="Delete source"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
