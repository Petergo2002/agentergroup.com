"use client";

import { useEffect, useRef } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Folder,
  Globe,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { KnowledgeFolderWithSources, KnowledgeSourceRecord } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";

interface SourceTableProps {
  sources: KnowledgeSourceRecord[];
  folders?: KnowledgeFolderWithSources[];
  allFolders?: KnowledgeFolderWithSources[];
  isLoading: boolean;
  onProcess: (id: string) => void;
  onDelete: (source: KnowledgeSourceRecord) => void;
  onView: (source: KnowledgeSourceRecord) => void;
  onOpenFolder?: (folder: KnowledgeFolderWithSources) => void;
  onEditFolder?: (folder: KnowledgeFolderWithSources) => void;
  onDeleteFolder?: (folder: KnowledgeFolderWithSources) => void;
  selectedSourceIds?: string[];
  onToggleSource?: (sourceId: string, checked: boolean) => void;
  onToggleAllSources?: (checked: boolean) => void;
  processingId?: string | null;
  deletingId?: string | null;
  deletingFolderId?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function SourceTable({
  sources,
  folders = [],
  allFolders = folders,
  isLoading,
  onProcess,
  onDelete,
  onView,
  onOpenFolder,
  onEditFolder,
  onDeleteFolder,
  selectedSourceIds = [],
  onToggleSource,
  onToggleAllSources,
  processingId,
  deletingId,
  deletingFolderId,
  emptyTitle,
  emptyDescription,
}: SourceTableProps) {
  const { language, t } = useLanguage();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectedSourceSet = new Set(selectedSourceIds);
  const selectable = Boolean(onToggleSource);
  const allVisibleSourcesSelected =
    sources.length > 0 && sources.every((source) => selectedSourceSet.has(source.id));
  const someVisibleSourcesSelected =
    sources.some((source) => selectedSourceSet.has(source.id)) && !allVisibleSourcesSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSourcesSelected;
    }
  }, [someVisibleSourcesSelected]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 w-full rounded-xl skeleton" />
        ))}
      </div>
    );
  }

  if (sources.length === 0 && folders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container-lowest px-6 py-16 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant ring-1 ring-outline-variant/15">
          <FileText className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-base font-semibold tracking-normal text-on-surface">
          {emptyTitle ?? t("knowledge.noSourcesFound")}
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-on-surface-variant text-balance">
          {emptyDescription ?? t("knowledge.connectDriveStatus")}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm font-headline">
          <thead className="border-b border-outline-variant/10 bg-surface-container-low/50 text-xs font-semibold text-on-surface-variant">
            <tr>
              {selectable ? (
                <th className="w-12 px-6 py-5">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allVisibleSourcesSelected}
                    onChange={(event) => onToggleAllSources?.(event.target.checked)}
                    aria-label={t("knowledge.selectAllSources")}
                    className="h-4 w-4 rounded-md border-outline-variant/20 bg-surface-container-low text-primary focus:ring-primary/20"
                  />
                </th>
              ) : null}
              <th className="px-6 py-5">{t("knowledge.sourceName")}</th>
              <th className="px-6 py-5">{t("knowledge.type")}</th>
              <th className="px-6 py-5 text-center">{t("common.status")}</th>
              <th className="px-6 py-5">{t("knowledge.lastModified")}</th>
              <th className="px-6 py-5 text-right">{t("knowledge.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {folders.map((folder) => {
              const isDeleting = deletingFolderId === folder.id;

              return (
                <tr
                  key={`folder-${folder.id}`}
                  className="group/row transition-colors hover:bg-surface-container-low/70 active:bg-surface-container-high/20"
                >
                  {selectable ? <td className="px-6 py-4" /> : null}
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => onOpenFolder?.(folder)}
                      className="flex w-full items-center gap-3 rounded-xl text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-low"
                      aria-label={t("knowledge.openFolder", { name: folder.name })}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover/row:bg-primary/15">
                        <Folder className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-normal text-on-surface">
                          {folder.name}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-on-surface-variant">
                          {folder.description || t("knowledge.noFolderDescription")}
                        </p>
                      </div>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      {t("knowledge.folderType")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex rounded-full bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface-variant">
                      {t("knowledge.folderSourceCountShort", { count: folder.sourceIds.length })}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-on-surface-variant/80 font-medium">
                    {formatRelativeDate(folder.updated_at, language)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onOpenFolder?.(folder)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                        title={t("common.view")}
                        aria-label={t("knowledge.openFolder", { name: folder.name })}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onEditFolder?.(folder)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                        title={t("common.edit")}
                        aria-label={t("knowledge.editFolder")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDeleteFolder?.(folder)}
                        disabled={isDeleting}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error disabled:opacity-50 transition-colors"
                        title={t("common.delete")}
                        aria-label={t("knowledge.deleteFolder")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {sources.map((source) => {
              const isProcessing = processingId === source.id;
              const isDeleting = deletingId === source.id;
              const status = source.status;
              const sourceFolders = allFolders.filter((folder) => folder.sourceIds.includes(source.id));
              const checked = selectedSourceSet.has(source.id);

              return (
                <tr 
                  key={source.id} 
                  className="group/row transition-colors hover:bg-surface-container-low/60 active:bg-surface-container-high/20"
                >
                  {selectable ? (
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => onToggleSource?.(source.id, event.target.checked)}
                        className="h-4 w-4 rounded border-outline-variant/40 text-primary focus:ring-primary/30"
                        aria-label={t("knowledge.selectSource", { name: source.name })}
                      />
                    </td>
                  ) : null}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant group-hover/row:bg-primary/10 group-hover/row:text-primary transition-colors">
                        {source.source_type === "website" ? (
                          <Globe className="h-4.5 w-4.5" />
                        ) : (
                          <FileText className="h-4.5 w-4.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-normal text-on-surface">
                          {source.name}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-on-surface-variant/60">
                          {sourceFolders.length > 0
                            ? sourceFolders.map((folder) => folder.name).join(", ")
                            : `${source.chunk_count} chunks • ${source.source_type === "website" && typeof source.metadata?.sourceUrl === "string" ? source.metadata.sourceUrl : source.description || t("assistants.noDescription")}`}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-lg bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface-variant">
                      {source.source_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors">
                      {status === "ready" && (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          <span className="text-success">{t("statuses.knowledge.ready")}</span>
                        </>
                      )}
                      {status === "processing" && (
                        <>
                          <Clock className="h-3.5 w-3.5 text-primary animate-pulse" />
                          <span className="text-primary">{t("statuses.knowledge.syncing")}</span>
                        </>
                      )}
                      {status === "pending" && (
                        <>
                          <Clock className="h-3.5 w-3.5 text-on-surface-variant animate-pulse" />
                          <span className="text-on-surface-variant">{t("statuses.knowledge.pending")}</span>
                        </>
                      )}
                      {status === "failed" && (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 text-error" />
                          <span className="text-error">{t("statuses.knowledge.failed")}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-on-surface-variant/80 font-medium">
                    {formatRelativeDate(source.updated_at, language)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onView(source)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                        title={t("common.view")}
                        aria-label={t("knowledge.viewSource", { name: source.name })}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onProcess(source.id)}
                        disabled={isProcessing}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary disabled:opacity-50 transition-colors"
                        title={t("knowledge.queuedForProcessing")}
                        aria-label={t("knowledge.retrySourceProcessing", { name: source.name })}
                      >
                        <RefreshCw className={`h-4 w-4 ${isProcessing ? "animate-spin" : ""}`} />
                      </button>
                      <button
                        onClick={() => onDelete(source)}
                        disabled={isDeleting}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error disabled:opacity-50 transition-colors"
                        title={t("common.delete")}
                        aria-label={t("knowledge.deleteSource", { name: source.name })}
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
