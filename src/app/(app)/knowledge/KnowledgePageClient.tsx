"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BookOpenText,
  CheckCircle2,
  Cloud,
  FileText,
  Filter,
  FolderOpen,
  RefreshCw,
  Search,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { AppIcon } from "@/components/icons/AppIcon";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useToast } from "@/components/ui/ToastProvider";
import {
  SUPPORTED_KNOWLEDGE_EXTENSIONS,
  SUPPORTED_KNOWLEDGE_MIME_TYPES,
} from "@/lib/knowledge";
import type {
  ConnectionRecord,
  DriveImportFileRecord,
  KnowledgeSourceRecord,
} from "@/lib/types";
import { SourceBentoGrid } from "@/components/knowledge/SourceBentoGrid";
import { SourceTable } from "@/components/knowledge/SourceTable";
import { ViewSourceModal } from "@/components/modals/ViewSourceModal";
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

type InputTab = "text" | "file" | "drive" | "website" | null;

export default function KnowledgePageClient({
  initialSources,
  initialDriveConnections,
}: {
  initialSources: KnowledgeSourceRecord[];
  initialDriveConnections: ConnectionRecord[];
}) {
  const [supabase] = useState(() => createClient());
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const [sources, setSources] = useState<KnowledgeSourceRecord[]>(initialSources);
  const [sourceSearch, setSourceSearch] = useState("");
  const [textName, setTextName] = useState("");
  const [textDescription, setTextDescription] = useState("");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileDescription, setFileDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteName, setWebsiteName] = useState("");
  const [websiteDescription, setWebsiteDescription] = useState("");
  const [isScrapingWebsite, setIsScrapingWebsite] = useState(false);
  const isLoading = false;
  const [isCreatingText, setIsCreatingText] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [processingSourceId, setProcessingSourceId] = useState<string | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [driveSearch, setDriveSearch] = useState("");
  const driveConnections = initialDriveConnections;
  const [selectedDriveConnectionId, setSelectedDriveConnectionId] = useState(
    initialDriveConnections.length === 1 ? initialDriveConnections[0]?.id ?? "" : "",
  );
  const [driveFiles, setDriveFiles] = useState<DriveImportFileRecord[]>([]);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
  const [isImportingDriveFileId, setIsImportingDriveFileId] = useState<string | null>(null);
  const [driveStatus, setDriveStatus] = useState<string>(
    initialDriveConnections.length > 0
      ? t("knowledge.browseDriveStatus")
      : t("knowledge.connectDriveStatus"),
  );
  const [activeTab, setActiveTab] = useState<InputTab>(null);
  const [selectedSource, setSelectedSource] = useState<KnowledgeSourceRecord | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

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
      cache: "no-store",
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? t("knowledge.loadError"));
    }

    setSources(payload.sources ?? []);
  }, [t]);

  const loadDriveFiles = useCallback(
    async ({ reset, pageToken }: { reset: boolean; pageToken?: string }) => {
      setIsLoadingDriveFiles(true);

      try {
        const query = new URLSearchParams();

        if (driveSearch.trim()) {
          query.set("search", driveSearch.trim());
        }

        if (selectedDriveConnectionId) {
          query.set("connectionId", selectedDriveConnectionId);
        }

        if (pageToken) {
          query.set("pageToken", pageToken);
        }

        const response = await fetch(`/api/knowledge/drive/files?${query.toString()}`, {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? t("knowledge.loadDriveError"));
        }

        const nextFiles = (payload.files ?? []) as DriveImportFileRecord[];
        setDriveFiles((current) => (reset ? nextFiles : [...current, ...nextFiles]));
        setDriveStatus(
          nextFiles.length > 0 || (!reset && driveFiles.length > 0)
            ? t("knowledge.browseDriveStatus")
            : t("knowledge.noDriveFilesStatus"),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("knowledge.loadDriveError");
        setDriveStatus(message);
        showToast(message, "error");
      } finally {
        setIsLoadingDriveFiles(false);
      }
    },
    [driveFiles.length, driveSearch, selectedDriveConnectionId, showToast, t],
  );

  const handleCreateTextSource = async () => {
    const trimmedName = textName.trim();
    const trimmedText = rawText.trim();

    if (!trimmedName || !trimmedText) {
      showToast(t("knowledge.missingTextNameOrContent"), "error");
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
        throw new Error(payload.error ?? t("knowledge.createTextError"));
      }

      setTextName("");
      setTextDescription("");
      setRawText("");
      await loadSources();
      showToast(t("knowledge.textCreated"), "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("knowledge.createTextError"),
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
      showToast(t("knowledge.missingFileNameOrFile"), "error");
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
        throw new Error(createPayload.error ?? t("knowledge.createFileError"));
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
        throw new Error(processPayload.error ?? t("knowledge.processStartError"));
      }

      setSelectedFile(null);
      setFileName("");
      setFileDescription("");
      await loadSources();
      showToast(t("knowledge.fileUploaded"), "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("knowledge.createFileError"),
        "error",
      );
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleScrapeWebsite = async () => {
    const trimmedUrl = websiteUrl.trim();
    const trimmedName = websiteName.trim();

    if (!trimmedUrl || !trimmedName) {
      showToast(t("knowledge.missingTextNameOrContent"), "error");
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      showToast(t("knowledge.missingUrl"), "error");
      return;
    }

    setIsScrapingWebsite(true);

    try {
      const response = await fetch("/api/knowledge/sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          description: websiteDescription.trim(),
          sourceType: "website",
          url: trimmedUrl,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t("knowledge.scrapeError"));
      }

      setWebsiteUrl("");
      setWebsiteName("");
      setWebsiteDescription("");
      await loadSources();
      showToast(t("knowledge.websiteScraped"), "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("knowledge.scrapeError"),
        "error",
      );
    } finally {
      setIsScrapingWebsite(false);
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
          connectionId: selectedDriveConnectionId || null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t("knowledge.importDriveError"));
      }

      await loadSources();
      showToast(t("knowledge.driveImported"), "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("knowledge.importDriveError"),
        "error",
      );
    } finally {
      setIsImportingDriveFileId(null);
    }
  };

  const handleView = (source: KnowledgeSourceRecord) => {
    setSelectedSource(source);
    setIsViewerOpen(true);
  };

  const handleProcess = async (sourceId: string) => {
    setProcessingSourceId(sourceId);

    try {
      const response = await fetch(`/api/knowledge/sources/${sourceId}/process`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t("knowledge.processError"));
      }

      await loadSources();
      showToast(t("knowledge.queuedForProcessing"), "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("knowledge.processError"),
        "error",
      );
    } finally {
      setProcessingSourceId(null);
    }
  };

  const handleDelete = async (source: KnowledgeSourceRecord) => {
    const confirmed = window.confirm(
      t("knowledge.deleteConfirm", { name: source.name }),
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
        throw new Error(payload.error ?? t("knowledge.deleteError"));
      }

      await loadSources();
      showToast(t("knowledge.removed"), "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("knowledge.deleteError"),
        "error",
      );
    } finally {
      setDeletingSourceId(null);
    }
  };

  const renderStatPill = (
    Icon: LucideIcon,
    label: string,
    value: number,
    colorClass: string,
  ) => (
    <div className="flex flex-col gap-1 px-4 py-2 border-r border-outline-variant/10 last:border-0">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-[15px] w-[15px] ${colorClass}`} />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">{label}</span>
      </div>
      <span className="text-sm font-bold text-on-surface">{value}</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-10 font-label">
      {/* Editorial Header */}
      <header className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between border-b border-outline-variant/10 pb-10">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-primary-container/10 text-primary-container mb-4">
            <BookOpenText className="h-[14px] w-[14px]" />
            <span className="text-[10px] font-bold uppercase tracking-widest">{t("knowledge.badge")}</span>
          </div>
          <h1 className="font-headline text-[2.5rem] font-bold leading-[1.1] text-on-surface tracking-tight">
            {t("knowledge.title")}
          </h1>
          <p className="mt-4 text-[13px] font-medium leading-relaxed text-on-surface-variant/80 max-w-lg">
            {t("knowledge.description")}
          </p>
        </div>
        
        <div className="flex rounded-2xl bg-surface-container-low/40 p-1 ring-1 ring-outline-variant/5">
          {renderStatPill(FolderOpen, t("knowledge.total"), stats.total, "text-on-surface-variant")}
          {renderStatPill(CheckCircle2, t("knowledge.ready"), stats.ready, "text-success")}
          {renderStatPill(RefreshCw, t("knowledge.syncing"), stats.processing, "text-primary")}
          {renderStatPill(TriangleAlert, t("knowledge.failed"), stats.failed, "text-error")}
        </div>
      </header>

      {/* Add Knowledge Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">
            {t("knowledge.addKnowledgeSource")}
          </h2>
          <div className="h-[1px] flex-1 bg-outline-variant/10 ml-4" />
        </div>

        {activeTab ? (
          <div className="rounded-2xl bg-surface-container-low p-8 ring-1 ring-outline-variant/10 admin-fade-in">
            <div className="mb-6 flex items-center justify-between border-b border-outline-variant/10 pb-4">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveTab(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-container transition-colors"
                >
                  <AppIcon name="arrow_back" className="h-5 w-5" />
                </button>
                <h3 className="font-headline text-lg font-bold text-on-surface">
                  {activeTab === "text" && t("knowledge.writeNewKnowledgeSource")}
                  {activeTab === "file" && t("knowledge.uploadDocument")}
                  {activeTab === "drive" && t("knowledge.importFromCloud")}
                </h3>
              </div>
            </div>

            {activeTab === "text" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 focus-within:text-primary transition-colors">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1">{t("knowledge.sourceName")}</label>
                    <input
                      value={textName}
                      onChange={(event) => setTextName(event.target.value)}
                      placeholder={t("knowledge.sourceNamePlaceholder")}
                      className="w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1">{t("knowledge.descriptionOptional")}</label>
                    <input
                      value={textDescription}
                      onChange={(event) => setTextDescription(event.target.value)}
                      placeholder={t("knowledge.sourceDescriptionPlaceholder")}
                      className="w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest ml-1">{t("knowledge.content")}</label>
                  <textarea
                    value={rawText}
                    onChange={(event) => setRawText(event.target.value)}
                    rows={12}
                    placeholder={t("knowledge.contentPlaceholder")}
                    className="w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-4 py-4 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 transition-all"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => void handleCreateTextSource()}
                    disabled={isCreatingText || !textName || !rawText}
                    className="signature-gradient h-11 rounded-md px-8 text-xs font-bold shadow-lg shadow-black/25 transition-all duration-150 hover:border-primary/25 hover:bg-primary/8 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {isCreatingText ? t("common.processing") : t("knowledge.finishAndSync")}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "website" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 focus-within:text-primary transition-colors">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1">{t("knowledge.sourceName")}</label>
                    <input
                      value={websiteName}
                      onChange={(event) => setWebsiteName(event.target.value)}
                      placeholder={t("knowledge.sourceNamePlaceholder")}
                      className="w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1">{t("knowledge.descriptionOptional")}</label>
                    <input
                      value={websiteDescription}
                      onChange={(event) => setWebsiteDescription(event.target.value)}
                      placeholder={t("knowledge.sourceDescriptionPlaceholder")}
                      className="w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5 focus-within:text-primary transition-colors">
                  <label className="text-[10px] font-bold uppercase tracking-widest ml-1">{t("knowledge.websiteUrl")}</label>
                  <input
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    placeholder={t("knowledge.urlPlaceholder")}
                    className="w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 transition-all"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => void handleScrapeWebsite()}
                    disabled={isScrapingWebsite || !websiteName || !websiteUrl}
                    className="signature-gradient h-11 rounded-md px-8 text-xs font-bold shadow-lg shadow-black/25 transition-all duration-150 hover:border-primary/25 hover:bg-primary/8 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {isScrapingWebsite ? t("knowledge.scraping") : t("knowledge.finishAndSync")}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "file" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1">{t("knowledge.sourceName")}</label>
                    <input
                      value={fileName}
                      onChange={(event) => setFileName(event.target.value)}
                      placeholder={t("knowledge.fileNamePlaceholder")}
                      className="w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1">{t("knowledge.fileDescription")}</label>
                    <input
                      value={fileDescription}
                      onChange={(event) => setFileDescription(event.target.value)}
                      placeholder={t("knowledge.fileDescriptionPlaceholder")}
                      className="w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 transition-all"
                    />
                  </div>
                </div>
                <label className="flex h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest/50 transition-all hover:bg-surface-container hover:border-primary/20">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container shadow-sm mb-4">
                    <Upload className="h-5 w-5 text-on-surface-variant" />
                  </div>
                  <p className="text-sm font-bold text-on-surface">
                    {selectedFile ? selectedFile.name : t("knowledge.dropFileHere")}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant/60">
                    {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : t("knowledge.supportedFileTypes")}
                  </p>
                  <input
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setSelectedFile(file);
                      if (file && !fileName) setFileName(file.name.replace(/\.[^/.]+$/, ""));
                    }}
                  />
                </label>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => void handleUploadFileSource()}
                    disabled={isUploadingFile || !selectedFile || !fileName}
                    className="signature-gradient h-11 rounded-md px-8 text-xs font-bold shadow-lg shadow-black/25 transition-all duration-150 hover:border-primary/25 hover:bg-primary/8 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {isUploadingFile ? t("common.uploading") : t("knowledge.importDocument")}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "drive" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  {driveConnections.length > 1 ? (
                    <select
                      value={selectedDriveConnectionId}
                      onChange={(event) => {
                        setSelectedDriveConnectionId(event.target.value);
                        setDriveFiles([]);
                      }}
                      className="min-w-[220px] rounded-md border border-outline-variant/30 bg-surface-container-lowest px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 transition-all"
                    >
                      <option value="">{t("knowledge.selectDriveAccount")}</option>
                      {driveConnections.map((connection) => (
                        <option key={connection.id} value={connection.id}>
                          {connection.account_label || connection.display_name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant/40" />
                    <input
                      value={driveSearch}
                      onChange={(event) => setDriveSearch(event.target.value)}
                      placeholder={t("knowledge.driveSearchPlaceholder")}
                      className="w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest pl-11 pr-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 transition-all"
                    />
                  </div>
                  <button
                    onClick={() => void loadDriveFiles({ reset: true })}
                    disabled={isLoadingDriveFiles || (driveConnections.length > 1 && !selectedDriveConnectionId)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant hover:text-primary transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4.5 w-4.5 ${isLoadingDriveFiles ? "animate-spin" : ""}`} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {driveFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 opacity-40">
                      <Cloud className="h-8 w-8 mb-3" />
                      <p className="text-xs font-bold uppercase tracking-widest">{driveStatus}</p>
                    </div>
                  ) : (
                    driveFiles.map((file) => (
                      <div
                        key={file.id}
                        className="group/item flex items-center justify-between rounded-xl bg-surface-container-lowest p-3 ring-1 ring-outline-variant/10 transition-all hover:bg-surface-container hover:ring-primary/20 hover:shadow-sm"
                      >
                        <div className="flex items-center gap-3 truncate">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container group-hover/item:bg-primary/10 group-hover/item:text-primary transition-colors">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="truncate">
                            <p className="truncate text-xs font-bold text-on-surface">{file.name}</p>
                            <p className="mt-0.5 text-[10px] text-on-surface-variant/50">
                              {formatRelativeDate(file.modifiedTime, language)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => void handleDriveImport(file)}
                          disabled={
                            isImportingDriveFileId === file.id ||
                            (driveConnections.length > 1 && !selectedDriveConnectionId)
                          }
                          className="rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary transition-all hover:bg-primary/18 hover:text-on-surface disabled:opacity-50"
                        >
                          {isImportingDriveFileId === file.id ? "..." : t("common.import")}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <SourceBentoGrid 
            onAddText={() => setActiveTab("text")}
            onUploadFile={() => setActiveTab("file")}
            onCloudImport={() => setActiveTab("drive")}
            onScrapeWebsite={() => setActiveTab("website")}
          />
        )}
      </section>

      {/* List Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">
              {t("knowledge.activeKnowledgeSources")}
            </h2>
            <div className="flex items-center gap-2 rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] font-bold text-on-surface-variant">
              {t("knowledge.totalSuffix", { count: sources.length })}
            </div>
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-on-surface-variant/40" />
            <input
              value={sourceSearch}
              onChange={(event) => setSourceSearch(event.target.value)}
              placeholder={t("knowledge.filterPlaceholder")}
              className="w-full rounded-md border border-outline-variant/30 bg-surface-container-low px-10 py-2 text-[12px] text-on-surface outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 sm:w-64"
            />
          </div>
        </div>

        <SourceTable 
          sources={filteredSources}
          isLoading={isLoading}
          onProcess={handleProcess}
          onDelete={handleDelete}
          onView={handleView}
          processingId={processingSourceId}
          deletingId={deletingSourceId}
        />
      </section>

      <ViewSourceModal
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setSelectedSource(null);
        }}
        source={selectedSource}
        onSourceUpdated={loadSources}
      />
    </div>
  );
}
