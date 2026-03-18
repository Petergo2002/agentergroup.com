"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/ToastProvider";
import {
  SUPPORTED_KNOWLEDGE_EXTENSIONS,
  SUPPORTED_KNOWLEDGE_MIME_TYPES,
} from "@/lib/knowledge";
import type { DriveImportFileRecord, KnowledgeSourceRecord } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";

const ACCEPTED_FILE_TYPES = [...SUPPORTED_KNOWLEDGE_MIME_TYPES, ...SUPPORTED_KNOWLEDGE_EXTENSIONS].join(",");

function inferMimeType(file: File) {
  if (file.type) {
    return file.type;
  }

  const lower = file.name.toLowerCase();

  if (lower.endsWith(".md")) {
    return "text/markdown";
  }

  if (lower.endsWith(".txt")) {
    return "text/plain";
  }

  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }

  return "";
}

type InputTab = "text" | "file" | "drive";

export default function KnowledgePage() {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const [sources, setSources] = useState<KnowledgeSourceRecord[]>([]);
  const [sourceSearch, setSourceSearch] = useState("");
  const [textName, setTextName] = useState("");
  const [textDescription, setTextDescription] = useState("");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileDescription, setFileDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingText, setIsCreatingText] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [processingSourceId, setProcessingSourceId] = useState<string | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [driveSearch, setDriveSearch] = useState("");
  const [driveFiles, setDriveFiles] = useState<DriveImportFileRecord[]>([]);
  const [driveNextPageToken, setDriveNextPageToken] = useState<string | null>(null);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
  const [isImportingDriveFileId, setIsImportingDriveFileId] = useState<string | null>(null);
  const [driveStatus, setDriveStatus] = useState<string>(
    "Connect Google Drive to browse and import files into the workspace library.",
  );
  const [activeTab, setActiveTab] = useState<InputTab>("text");

  const filteredSources = useMemo(() => {
    if (!sourceSearch.trim()) return sources;
    const search = sourceSearch.toLowerCase();
    return sources.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.description?.toLowerCase().includes(search) ||
        s.source_type.toLowerCase().includes(search),
    );
  }, [sources, sourceSearch]);

  const stats = useMemo(() => ({
    total: sources.length,
    ready: sources.filter((source) => source.status === "ready").length,
    processing: sources.filter((source) => source.status === "processing").length,
    failed: sources.filter((source) => source.status === "failed").length,
  }), [sources]);

  const loadSources = useCallback(async () => {
    const response = await fetch("/api/knowledge/sources", {
      next: { revalidate: 30 },
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load knowledge sources.");
    }

    setSources(payload.sources ?? []);
  }, []);

  const loadDriveFiles = useCallback(
    async ({ reset, pageToken }: { reset: boolean; pageToken?: string }) => {
      setIsLoadingDriveFiles(true);

      try {
        const query = new URLSearchParams();

        if (driveSearch.trim()) {
          query.set("search", driveSearch.trim());
        }

        if (pageToken) {
          query.set("pageToken", pageToken);
        }

        const response = await fetch(`/api/knowledge/drive/files?${query.toString()}`, {
          next: { revalidate: 30 },
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load Google Drive files.");
        }

        const nextFiles = (payload.files ?? []) as DriveImportFileRecord[];
        setDriveFiles((current) => (reset ? nextFiles : [...current, ...nextFiles]));
        setDriveNextPageToken(payload.nextPageToken ?? null);
        setDriveStatus(
          nextFiles.length > 0 || (!reset && driveFiles.length > 0)
            ? "Browse supported Google Drive files and import them into Supabase."
            : "No supported Google Drive files were found for this search.",
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load Google Drive files.";
        setDriveStatus(message);
        showToast(message, "error");
      } finally {
        setIsLoadingDriveFiles(false);
      }
    },
    [driveFiles.length, driveSearch, showToast],
  );

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        await loadSources();
      } catch (error) {
        if (mounted) {
          showToast(
            error instanceof Error ? error.message : "Failed to load knowledge sources.",
            "error",
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [loadSources, showToast]);

  const handleCreateTextSource = async () => {
    const trimmedName = textName.trim();
    const trimmedText = rawText.trim();

    if (!trimmedName || !trimmedText) {
      showToast("Give the source a name and some content first.", "error");
      return;
    }

    setIsCreatingText(true);

    try {
      const response = await fetch("/api/knowledge/sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          description: textDescription.trim(),
          sourceType: "text",
          rawText: trimmedText,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create text knowledge source.");
      }

      setTextName("");
      setTextDescription("");
      setRawText("");
      await loadSources();
      showToast("Text source created and queued for processing.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to create text knowledge source.",
        "error",
      );
    } finally {
      setIsCreatingText(false);
    }
  };

  const handleUploadFileSource = async () => {
    const file = selectedFile;
    const trimmedName = fileName.trim();

    if (!trimmedName || !file) {
      showToast("Choose a file and give it a name first.", "error");
      return;
    }

    setIsUploadingFile(true);

    try {
      const createResponse = await fetch("/api/knowledge/sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          description: fileDescription.trim(),
          sourceType: "file",
          fileName: file.name,
          mimeType: inferMimeType(file),
          fileSizeBytes: file.size,
        }),
      });
      const createPayload = await createResponse.json();

      if (!createResponse.ok) {
        throw new Error(createPayload.error ?? "Failed to create file knowledge source.");
      }

      const upload = createPayload.upload as { bucket: string; path: string };
      const source = createPayload.source as KnowledgeSourceRecord;

      const uploadResult = await supabase.storage.from(upload.bucket).upload(upload.path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: inferMimeType(file) || undefined,
      });

      if (uploadResult.error) {
        throw uploadResult.error;
      }

      const processResponse = await fetch(`/api/knowledge/sources/${source.id}/process`, {
        method: "POST",
      });
      const processPayload = await processResponse.json();

      if (!processResponse.ok) {
        throw new Error(processPayload.error ?? "Failed to start knowledge processing.");
      }

      setSelectedFile(null);
      setFileName("");
      setFileDescription("");
      await loadSources();
      showToast("File uploaded and queued for processing.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to upload file knowledge source.",
        "error",
      );
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleDriveImport = async (file: DriveImportFileRecord) => {
    setIsImportingDriveFileId(file.id);

    try {
      const response = await fetch("/api/knowledge/drive/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId: file.id,
          name: file.name,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to import Google Drive file.");
      }

      await loadSources();
      showToast("Google Drive file imported and queued for processing.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to import Google Drive file.",
        "error",
      );
    } finally {
      setIsImportingDriveFileId(null);
    }
  };

  const handleProcess = async (sourceId: string) => {
    setProcessingSourceId(sourceId);

    try {
      const response = await fetch(`/api/knowledge/sources/${sourceId}/process`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to process knowledge source.");
      }

      await loadSources();
      showToast("Knowledge source queued for processing.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to process knowledge source.",
        "error",
      );
    } finally {
      setProcessingSourceId(null);
    }
  };

  const handleDelete = async (source: KnowledgeSourceRecord) => {
    const confirmed = window.confirm(
      `Delete "${source.name}"? This will remove the source, its chunks, and any agent attachments.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingSourceId(source.id);

    try {
      const response = await fetch(`/api/knowledge/sources/${source.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete knowledge source.");
      }

      await loadSources();
      showToast("Knowledge source removed.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to delete knowledge source.",
        "error",
      );
    } finally {
      setDeletingSourceId(null);
    }
  };

  const renderStatPill = (icon: string, label: string, value: number, colorClass: string) => (
    <div className="flex items-center gap-3 rounded-full border border-outline-variant/15 bg-surface-container px-4 py-2">
      <span className={`material-symbols-outlined text-lg ${colorClass}`}>{icon}</span>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</span>
        <span className="text-sm font-bold text-on-surface">{value}</span>
      </div>
    </div>
  );

  const tabs = [
    { id: "text" as const, label: "Paste Text", icon: "edit_note" },
    { id: "file" as const, label: "Upload File", icon: "upload_file" },
    { id: "drive" as const, label: "Google Drive", icon: "cloud" },
  ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Header Section */}
      <section className="rounded-[1.8rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              Knowledge Library
            </p>
            <h1 className="mt-3 font-headline text-[2.15rem] font-bold text-on-surface sm:text-[2.35rem]">
              Reusable context for your agents
            </h1>
            <p className="mt-3 text-sm leading-7 text-on-surface-variant">
              Add documents or paste text, then attach to agents for retrieval during conversations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {renderStatPill("folder", "Total", stats.total, "text-on-surface-variant")}
            {renderStatPill("check_circle", "Ready", stats.ready, "text-success")}
            {renderStatPill("sync", "Processing", stats.processing, "text-primary")}
            {renderStatPill("error", "Failed", stats.failed, "text-error")}
          </div>
        </div>
      </section>

      {/* Input Section with Tabs */}
      <section className="overflow-hidden rounded-[1.8rem] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        {/* Tab Navigation */}
        <div className="flex border-b border-outline-variant/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-4 text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-surface-container-lowest text-primary border-b-2 border-primary -mb-px"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "text" && (
            <div className="space-y-4">
              <div className="max-w-xl">
                <p className="text-sm text-on-surface-variant">
                  Paste policies, handbooks, or notes for immediate agent access.
                </p>
              </div>
              <div className="space-y-3">
                <input
                  value={textName}
                  onChange={(event) => setTextName(event.target.value)}
                  placeholder="Source name (e.g., Refund Policy)"
                  className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/5"
                />
                <textarea
                  value={textDescription}
                  onChange={(event) => setTextDescription(event.target.value)}
                  rows={2}
                  placeholder="Optional short description"
                  className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/5"
                />
                <textarea
                  value={rawText}
                  onChange={(event) => setRawText(event.target.value)}
                  rows={8}
                  placeholder="Paste the text content you want the agent to retrieve..."
                  className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm leading-6 outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/5"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => void handleCreateTextSource()}
                    disabled={isCreatingText}
                    className="signature-gradient rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:brightness-110 disabled:opacity-50"
                  >
                    {isCreatingText ? "Creating..." : "Create Text Source"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "file" && (
            <div className="space-y-4">
              <div className="max-w-xl">
                <p className="text-sm text-on-surface-variant">
                  Upload `.txt`, `.md`, or `.pdf` files. They will be chunked and embedded automatically.
                </p>
              </div>
              <div className="space-y-3">
                <input
                  value={fileName}
                  onChange={(event) => setFileName(event.target.value)}
                  placeholder="Source name (e.g., Support Handbook)"
                  className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/5"
                />
                <textarea
                  value={fileDescription}
                  onChange={(event) => setFileDescription(event.target.value)}
                  rows={2}
                  placeholder="Optional short description"
                  className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/5"
                />
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline-variant/20 bg-background px-6 py-10 text-center transition-all hover:border-primary/30 hover:bg-surface-container">
                  <span className="material-symbols-outlined text-4xl text-primary">upload_file</span>
                  <p className="mt-3 text-sm font-semibold text-on-surface">
                    {selectedFile ? selectedFile.name : "Drop a file or click to browse"}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {selectedFile
                      ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                      : `Supported: ${SUPPORTED_KNOWLEDGE_EXTENSIONS.join(", ")}`}
                  </p>
                  <input
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    className="hidden"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                <div className="flex justify-end">
                  <button
                    onClick={() => void handleUploadFileSource()}
                    disabled={isUploadingFile || !selectedFile}
                    className="rounded-full border border-outline-variant/15 bg-surface-container px-6 py-3 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container-high disabled:opacity-50"
                  >
                    {isUploadingFile ? "Uploading..." : "Upload and Process"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "drive" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-xl">
                  <p className="text-sm text-on-surface-variant">
                    Import files from your connected Google Drive account.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    value={driveSearch}
                    onChange={(event) => setDriveSearch(event.target.value)}
                    placeholder="Search files..."
                    className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-2 text-sm outline-none transition-all focus:border-primary/40 sm:w-48"
                  />
                  <button
                    onClick={() => void loadDriveFiles({ reset: true })}
                    disabled={isLoadingDriveFiles}
                    className="rounded-full border border-outline-variant/15 bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container-high disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">search</span>
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-surface-container px-4 py-3">
                <p className="text-sm text-on-surface-variant">{driveStatus}</p>
              </div>

              <div className="space-y-2">
                {driveFiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container px-6 py-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant">cloud_off</span>
                    <p className="mt-3 font-semibold text-on-surface">No Drive files loaded</p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Connect Google Drive from the Connections page to browse files.
                    </p>
                  </div>
                ) : (
                  driveFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-3 transition-all hover:border-primary/20"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-on-surface">{file.name}</p>
                        <p className="text-xs text-on-surface-variant">
                          {file.size ? `${(parseInt(file.size) / 1024).toFixed(1)} KB` : ""}
                          {file.modifiedTime ? ` · Updated ${formatRelativeDate(file.modifiedTime)}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 ml-4">
                        {file.webViewLink ? (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-outline-variant/15 px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
                          >
                            Open
                          </a>
                        ) : null}
                        <button
                          onClick={() => void handleDriveImport(file)}
                          disabled={isImportingDriveFileId === file.id}
                          className="signature-gradient rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {isImportingDriveFileId === file.id ? "..." : "Import"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {driveNextPageToken && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => void loadDriveFiles({ reset: false, pageToken: driveNextPageToken })}
                    disabled={isLoadingDriveFiles}
                    className="rounded-full border border-outline-variant/15 px-5 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-50"
                  >
                    {isLoadingDriveFiles ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Sources List */}
      <section className="rounded-[1.8rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
              Workspace Sources
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {sources.length} source{sources.length !== 1 ? "s" : ""} in library
            </p>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant">
              search
            </span>
            <input
              value={sourceSearch}
              onChange={(event) => setSourceSearch(event.target.value)}
              placeholder="Filter sources..."
              className="w-full rounded-full border border-outline-variant/10 bg-background pl-10 pr-4 py-2 text-sm outline-none transition-all focus:border-primary/40 sm:w-64"
            />
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-2xl bg-surface-container"
              />
            ))
          ) : filteredSources.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container px-6 py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant">folder_open</span>
              <p className="mt-3 font-headline text-lg font-bold text-on-surface">
                {sourceSearch ? "No matching sources" : "No knowledge sources yet"}
              </p>
              <p className="mt-1 mx-auto max-w-md text-sm text-on-surface-variant">
                {sourceSearch
                  ? "Try adjusting your search terms."
                  : "Add a text source or upload a file to get started."}
              </p>
            </div>
          ) : (
            filteredSources.map((source) => (
              <div
                key={source.id}
                className="group flex items-center justify-between rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-3 transition-all hover:border-primary/20 hover:shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        source.status === "ready"
                          ? "bg-success"
                          : source.status === "processing"
                            ? "bg-primary animate-pulse"
                            : "bg-error"
                      }`}
                    />
                    <p className="truncate text-sm font-semibold text-on-surface">{source.name}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        source.status === "ready"
                          ? "bg-success/10 text-success"
                          : source.status === "processing"
                            ? "bg-primary/10 text-primary"
                            : "bg-error/10 text-error"
                      }`}
                    >
                      {source.status}
                    </span>
                    <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      {source.source_type}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                    <span>{source.chunk_count} chunks</span>
                    <span>Updated {formatRelativeDate(source.updated_at)}</span>
                    {source.description && (
                      <span className="truncate max-w-xs">· {source.description}</span>
                    )}
                  </div>
                  {source.error_message && (
                    <p className="mt-2 rounded-xl bg-error/5 px-3 py-2 text-xs text-error">
                      {source.error_message}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 ml-4">
                  <button
                    onClick={() => void handleProcess(source.id)}
                    disabled={processingSourceId === source.id || deletingSourceId === source.id}
                    className="rounded-full border border-outline-variant/15 px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50"
                  >
                    {processingSourceId === source.id ? "..." : source.status === "ready" ? "Reprocess" : "Process"}
                  </button>
                  <button
                    onClick={() => void handleDelete(source)}
                    disabled={deletingSourceId === source.id || processingSourceId === source.id}
                    className="rounded-full border border-error/20 px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/5 disabled:opacity-50"
                  >
                    {deletingSourceId === source.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
