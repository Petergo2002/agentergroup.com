"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpenText,
  CheckCircle2,
  ChevronRight,
  Cloud,
  FileText,
  Filter,
  FolderOpen,
  FolderPlus,
  FolderInput,
  FolderMinus,
  RefreshCw,
  Search,
  TriangleAlert,
  Upload,
  X,
  Database,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { AppIcon } from "@/components/icons/AppIcon";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useToast } from "@/components/ui/ToastProvider";
import {
  SUPPORTED_KNOWLEDGE_EXTENSIONS,
  SUPPORTED_KNOWLEDGE_MIME_TYPES,
  inferKnowledgeMimeType,
  isSupportedKnowledgeMimeType,
} from "@/lib/knowledge";
import type {
  ConnectionRecord,
  DriveImportFileRecord,
  KnowledgeFolderWithSources,
  KnowledgeSourceRecord,
  WorkspaceSubscriptionRecord,
} from "@/lib/types";
import { SourceBentoGrid } from "@/components/knowledge/SourceBentoGrid";
import { SourceTable } from "@/components/knowledge/SourceTable";
import { ViewSourceModal } from "@/components/modals/ViewSourceModal";
import { ConfirmSimpleModal } from "@/components/modals/ConfirmSimpleModal";
import { formatRelativeDate } from "@/lib/utils";

const ACCEPTED_FILE_TYPES = [...SUPPORTED_KNOWLEDGE_MIME_TYPES, ...SUPPORTED_KNOWLEDGE_EXTENSIONS].join(",");

const formLabelClass = "ml-1 text-sm font-medium text-on-surface-variant";
const formControlClass =
  "w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant/45 focus:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2";
const primaryActionClass =
  "inline-flex h-11 items-center justify-center rounded-xl bg-on-surface px-5 text-sm font-semibold text-background transition-colors hover:bg-on-surface/90 disabled:opacity-50";
const secondaryActionClass =
  "inline-flex h-10 items-center justify-center rounded-xl border border-outline-variant/15 px-4 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-50";

type InputTab = "text" | "file" | "drive" | "website" | null;

export default function KnowledgePageClient({
  initialSources,
  initialFolders,
  initialDriveConnections,
  subscription,
}: {
  initialSources: KnowledgeSourceRecord[];
  initialFolders: KnowledgeFolderWithSources[];
  initialDriveConnections: ConnectionRecord[];
  subscription: WorkspaceSubscriptionRecord;
}) {
  const [supabase] = useState(() => createClient());
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const [sources, setSources] = useState<KnowledgeSourceRecord[]>(initialSources);
  const [folders, setFolders] = useState<KnowledgeFolderWithSources[]>(initialFolders);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [isMovingSelectedSources, setIsMovingSelectedSources] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [targetFolderId, setTargetFolderId] = useState("");
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
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [isMappingWebsite, setIsMappingWebsite] = useState(false);
  const [pageSearch, setPageSearch] = useState("");
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
  const [isDeleteDialogOpen, setIsDeleteOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<KnowledgeSourceRecord | null>(null);

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) ?? null,
    [folders, selectedFolderId],
  );

  const selectedFolderSources = useMemo(() => {
    if (!selectedFolder) return [];
    const sourceIdSet = new Set(selectedFolder.sourceIds);
    return sources.filter((source) => sourceIdSet.has(source.id));
  }, [selectedFolder, sources]);

  const rootSources = useMemo(() => {
    const filedSourceIds = new Set(folders.flatMap((folder) => folder.sourceIds));
    return sources.filter((source) => !filedSourceIds.has(source.id));
  }, [folders, sources]);

  const visibleSources = selectedFolder ? selectedFolderSources : rootSources;

  const filteredSources = useMemo(() => {
    if (!sourceSearch.trim()) return visibleSources;
    const search = sourceSearch.toLowerCase();
    return visibleSources.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.description?.toLowerCase().includes(search) ||
        s.metadata?.sourceUrl != null && typeof s.metadata.sourceUrl === "string" && s.metadata.sourceUrl.toLowerCase().includes(search),
    );
  }, [visibleSources, sourceSearch]);

  const filteredFolders = useMemo(() => {
    if (selectedFolder) return [];
    if (!sourceSearch.trim()) return folders;
    const search = sourceSearch.toLowerCase();
    return folders.filter(
      (folder) =>
        folder.name.toLowerCase().includes(search) ||
        folder.description.toLowerCase().includes(search),
    );
  }, [folders, selectedFolder, sourceSearch]);

  const startEditingFolder = (folder: KnowledgeFolderWithSources) => {
    setEditingFolderId(folder.id);
    setSelectedFolderId(folder.id);
    setFolderName(folder.name);
    setFolderDescription(folder.description);
    setIsFolderDialogOpen(true);
  };

  const resetFolderForm = () => {
    setEditingFolderId(null);
    setFolderName("");
    setFolderDescription("");
  };

  const openCreateFolderDialog = () => {
    resetFolderForm();
    setIsFolderDialogOpen(true);
  };

  const openSourceForm = (tab: Exclude<InputTab, null>) => {
    setTargetFolderId(selectedFolderId ?? "");
    setActiveTab(tab);
  };

  const filteredDiscoveredUrls = useMemo(() => {
    if (!pageSearch.trim()) return discoveredUrls;
    const search = pageSearch.toLowerCase();
    return discoveredUrls.filter((url) => url.toLowerCase().includes(search));
  }, [discoveredUrls, pageSearch]);

  const storageStats = useMemo(() => {
    const usedBytes = sources.reduce((acc, curr) => acc + (curr.file_size_bytes ?? 0), 0);
    const limitBytes = subscription?.storage_limit_bytes ?? 10485760;
    const percent = Math.min(Math.round((usedBytes / limitBytes) * 100), 100);
    
    return {
      usedMB: (usedBytes / 1024 / 1024).toFixed(2),
      limitMB: (limitBytes / 1024 / 1024).toFixed(0),
      percent,
    };
  }, [sources, subscription]);

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

  const loadFolders = useCallback(async () => {
    const response = await fetch("/api/knowledge/folders", {
      cache: "no-store",
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? t("knowledge.loadFoldersError"));
    }

    const nextFolders = (payload.folders ?? []) as KnowledgeFolderWithSources[];
    setFolders(nextFolders);
    setSelectedFolderId((current) =>
      current && nextFolders.some((folder) => folder.id === current)
        ? current
        : null,
    );
  }, [t]);

  const handleSaveFolder = async () => {
    const trimmedName = folderName.trim();

    if (!trimmedName) {
      showToast(t("knowledge.folderNameRequired"), "error");
      return;
    }

    setIsSavingFolder(true);

    try {
      const response = await fetch(
        editingFolderId
          ? `/api/knowledge/folders/${editingFolderId}`
          : "/api/knowledge/folders",
        {
          method: editingFolderId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            description: folderDescription.trim(),
          }),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t("knowledge.saveFolderError"));
      }

      await loadFolders();
      setSelectedFolderId(payload.folder?.id ?? editingFolderId ?? null);
      resetFolderForm();
      setIsFolderDialogOpen(false);
      showToast(
        editingFolderId ? t("knowledge.folderUpdated") : t("knowledge.folderCreated"),
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("knowledge.saveFolderError"),
        "error",
      );
    } finally {
      setIsSavingFolder(false);
    }
  };

  const patchFolderSourceIds = async (folderId: string, sourceIds: string[]) => {
    const response = await fetch(`/api/knowledge/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceIds }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? t("knowledge.updateFolderSourcesError"));
    }

    return payload.folder as KnowledgeFolderWithSources;
  };

  const handleMoveSelectedSourcesToFolder = async (folderId: string) => {
    const targetFolder = folders.find((item) => item.id === folderId);

    if (!targetFolder || selectedSourceIds.length === 0) {
      return;
    }

    setIsMovingSelectedSources(true);

    try {
      const changedFolders: KnowledgeFolderWithSources[] = [];
      const selectedSet = new Set(selectedSourceIds);

      // 1. Add selected sources to the target folder (deduped)
      const nextTarget = await patchFolderSourceIds(
        targetFolder.id,
        Array.from(new Set([...targetFolder.sourceIds, ...selectedSourceIds])),
      );
      changedFolders.push(nextTarget);

      // 2. Remove selected sources from EVERY other folder they currently belong to.
      //    This is what makes it a true "move" — not just a copy.
      const otherFoldersContainingSelected = folders.filter(
        (folder) =>
          folder.id !== targetFolder.id &&
          folder.sourceIds.some((id) => selectedSet.has(id)),
      );

      await Promise.all(
        otherFoldersContainingSelected.map(async (folder) => {
          const updated = await patchFolderSourceIds(
            folder.id,
            folder.sourceIds.filter((id) => !selectedSet.has(id)),
          );
          changedFolders.push(updated);
        }),
      );

      setFolders((current) =>
        current.map((folder) =>
          changedFolders.find((changed) => changed.id === folder.id) ?? folder,
        ),
      );
      setSelectedSourceIds([]);
      setSelectedFolderId(targetFolder.id);
      setSourceSearch("");
      showToast(t("knowledge.sourcesMovedToFolder", { count: selectedSourceIds.length }), "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("knowledge.updateFolderSourcesError"),
        "error",
      );
    } finally {
      setIsMovingSelectedSources(false);
    }
  };

  const handleRemoveSelectedFromFolder = async () => {
    if (!selectedFolder || selectedSourceIds.length === 0) {
      return;
    }

    setIsMovingSelectedSources(true);

    try {
      const selectedSet = new Set(selectedSourceIds);
      const updatedFolder = await patchFolderSourceIds(
        selectedFolder.id,
        selectedFolder.sourceIds.filter((sourceId) => !selectedSet.has(sourceId)),
      );

      setFolders((current) =>
        current.map((folder) => (folder.id === updatedFolder.id ? updatedFolder : folder)),
      );
      setSelectedSourceIds([]);
      showToast(t("knowledge.sourcesRemovedFromFolder", { count: selectedSourceIds.length }), "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("knowledge.updateFolderSourcesError"),
        "error",
      );
    } finally {
      setIsMovingSelectedSources(false);
    }
  };

  const handleDeleteFolder = async (folder: KnowledgeFolderWithSources) => {
    setDeletingFolderId(folder.id);

    try {
      const response = await fetch(`/api/knowledge/folders/${folder.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t("knowledge.deleteFolderError"));
      }

      await loadFolders();
      if (selectedFolderId === folder.id) {
        setSelectedFolderId(null);
        setSelectedSourceIds([]);
      }
      resetFolderForm();
      showToast(t("knowledge.folderDeleted"), "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("knowledge.deleteFolderError"),
        "error",
      );
    } finally {
      setDeletingFolderId(null);
    }
  };

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
          folderId: targetFolderId || null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t("knowledge.createTextError"));
      }

      setTextName("");
      setTextDescription("");
      setRawText("");
      await Promise.all([loadSources(), loadFolders()]);
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

    const mimeType = inferKnowledgeMimeType(file.name, file.type);
    if (!isSupportedKnowledgeMimeType(mimeType)) {
      showToast(t("knowledge.unsupportedFileType"), "error");
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
          mimeType,
          fileSizeBytes: file.size,
          folderId: targetFolderId || null,
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
        contentType: mimeType,
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
      await Promise.all([loadSources(), loadFolders()]);
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

  const handleFindPages = async () => {
    let targetUrl = websiteUrl.trim();
    if (!targetUrl) {
      showToast(t("knowledge.missingUrl"), "error");
      return;
    }

    // Prepend https:// if no protocol is provided
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    try {
      new URL(targetUrl);
    } catch {
      showToast(t("knowledge.missingUrl"), "error");
      return;
    }

    setIsMappingWebsite(true);
    setDiscoveredUrls([]);
    setSelectedUrls([]);

    try {
      const response = await fetch("/api/knowledge/sources/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("knowledge.scrapeError"));

      setDiscoveredUrls(data.links || []);
      if (data.links?.length === 0) {
        showToast(t("knowledge.noPagesFound"), "info");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("knowledge.scrapeError"), "error");
    } finally {
      setIsMappingWebsite(false);
    }
  };

  const handleScrapeWebsite = async () => {
    let targetUrl = websiteUrl.trim();
    const trimmedName = websiteName.trim();

    if (!targetUrl || !trimmedName) {
      showToast(t("knowledge.missingTextNameOrContent"), "error");
      return;
    }

    // Prepend https:// if no protocol is provided
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    try {
      new URL(targetUrl);
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
          url: targetUrl,
          urls: selectedUrls,
          folderId: targetFolderId || null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t("knowledge.scrapeError"));
      }

      setWebsiteUrl("");
      setWebsiteName("");
      setWebsiteDescription("");
      setDiscoveredUrls([]);
      setSelectedUrls([]);
      await Promise.all([loadSources(), loadFolders()]);
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
          folderId: targetFolderId || null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t("knowledge.importDriveError"));
      }

      await Promise.all([loadSources(), loadFolders()]);
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

  const handleDeleteClick = (source: KnowledgeSourceRecord) => {
    setSourceToDelete(source);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!sourceToDelete) return;

    setDeletingSourceId(sourceToDelete.id);
    setIsDeleteOpen(false);

    try {
      const response = await fetch(`/api/knowledge/sources/${sourceToDelete.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t("knowledge.deleteError"));
      }

      await Promise.all([loadSources(), loadFolders()]);
      showToast(t("knowledge.removed"), "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("knowledge.deleteError"),
        "error",
      );
    } finally {
      setDeletingSourceId(null);
      setSourceToDelete(null);
    }
  };

  const renderStatPill = (
    Icon: LucideIcon,
    label: string,
    value: string | number,
    colorClass: string,
  ) => (
    <div className="flex min-w-24 flex-col gap-1 rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-[15px] w-[15px] ${colorClass}`} />
        <span className="text-xs font-medium text-on-surface-variant/70">{label}</span>
      </div>
      <span className="text-2xl font-bold tabular-nums text-on-surface">{value}</span>
    </div>
  );

  const renderFolderTargetSelect = () => {
    if (folders.length === 0) {
      return null;
    }

    return (
      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <label className="text-sm font-medium text-on-surface-variant">
              {t("knowledge.targetFolder")}
            </label>
            <p className="mt-1 text-xs text-on-surface-variant/60">
              {t("knowledge.targetFolderDescription")}
            </p>
          </div>
          <select
            value={targetFolderId}
            onChange={(event) => setTargetFolderId(event.target.value)}
            className="min-w-[220px] rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
          >
            <option value="">{t("knowledge.noTargetFolder")}</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  const toggleSourceSelection = (sourceId: string, checked: boolean) => {
    setSelectedSourceIds((current) =>
      checked
        ? Array.from(new Set([...current, sourceId]))
        : current.filter((id) => id !== sourceId),
    );
  };

  const toggleAllVisibleSources = (checked: boolean) => {
    setSelectedSourceIds(checked ? filteredSources.map((source) => source.id) : []);
  };

  const moveTargetFolders = folders.filter((folder) => folder.id !== selectedFolder?.id);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-5 py-5 shadow-sm sm:px-6 lg:px-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/8 px-2.5 py-1 text-primary">
              <BookOpenText className="h-3.5 w-3.5" strokeWidth={2.2} />
              <span className="text-xs font-semibold">{t("knowledge.badge")}</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold leading-tight tracking-normal text-on-surface sm:text-3xl">
              {t("knowledge.title")}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant/75">
              {t("knowledge.description")}
            </p>

            <div className="mt-5 max-w-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant/70">
                <span className="flex items-center gap-1.5">
                  <Database className="h-3 w-3" />
                  Knowledge Storage
                </span>
                <span>{storageStats.usedMB} MB / {storageStats.limitMB} MB</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
                <div
                  className={`h-full transition-all duration-500 ${storageStats.percent > 90 ? "bg-error" : "bg-primary"}`}
                  style={{ width: `${storageStats.percent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {renderStatPill(FolderOpen, t("knowledge.total"), stats.total, "text-on-surface-variant")}
            {renderStatPill(CheckCircle2, t("knowledge.ready"), stats.ready, "text-success")}
            {renderStatPill(RefreshCw, t("knowledge.syncing"), stats.processing, "text-primary")}
            {renderStatPill(TriangleAlert, t("knowledge.failed"), stats.failed, "text-error")}
          </div>
        </div>
      </header>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-on-surface">
            {t("knowledge.addKnowledgeSource")}
          </h2>
        </div>

        {activeTab ? (
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm sm:p-6 lg:p-7">
            <div className="mb-6 flex items-center justify-between border-b border-outline-variant/10 pb-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                  aria-label="Back"
                >
                  <AppIcon name="arrow_back" className="h-4.5 w-4.5" />
                </button>
                <h3 className="text-lg font-semibold text-on-surface">
                  {activeTab === "text" && t("knowledge.writeNewKnowledgeSource")}
                  {activeTab === "file" && t("knowledge.uploadDocument")}
                  {activeTab === "website" && t("knowledge.scrapeWebsite")}
                  {activeTab === "drive" && t("knowledge.importFromCloud")}
                </h3>
              </div>
            </div>

            {activeTab === "text" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className={formLabelClass}>{t("knowledge.sourceName")}</label>
                    <input
                      value={textName}
                      onChange={(event) => setTextName(event.target.value)}
                      placeholder={t("knowledge.sourceNamePlaceholder")}
                      className={formControlClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={formLabelClass}>{t("knowledge.descriptionOptional")}</label>
                    <input
                      value={textDescription}
                      onChange={(event) => setTextDescription(event.target.value)}
                      placeholder={t("knowledge.sourceDescriptionPlaceholder")}
                      className={formControlClass}
                    />
                  </div>
                </div>
                {renderFolderTargetSelect()}
                <div className="space-y-1.5">
                  <label className={formLabelClass}>{t("knowledge.content")}</label>
                  <textarea
                    value={rawText}
                    onChange={(event) => setRawText(event.target.value)}
                    rows={12}
                    placeholder={t("knowledge.contentPlaceholder")}
                    className={`${formControlClass} leading-relaxed`}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => void handleCreateTextSource()}
                    disabled={isCreatingText || !textName || !rawText}
                    className={primaryActionClass}
                  >
                    {isCreatingText ? t("common.processing") : t("knowledge.finishAndSync")}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "website" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className={formLabelClass}>{t("knowledge.sourceName")}</label>
                    <input
                      value={websiteName}
                      onChange={(event) => setWebsiteName(event.target.value)}
                      placeholder={t("knowledge.sourceNamePlaceholder")}
                      className={formControlClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={formLabelClass}>{t("knowledge.descriptionOptional")}</label>
                    <input
                      value={websiteDescription}
                      onChange={(event) => setWebsiteDescription(event.target.value)}
                      placeholder={t("knowledge.sourceDescriptionPlaceholder")}
                      className={formControlClass}
                    />
                  </div>
                </div>

                {renderFolderTargetSelect()}

                <div className="space-y-1.5">
                  <label className={formLabelClass}>{t("knowledge.websiteUrl")}</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={websiteUrl}
                      onChange={(event) => setWebsiteUrl(event.target.value)}
                      placeholder={t("knowledge.urlPlaceholder")}
                      className={formControlClass}
                    />
                    <button
                      onClick={() => void handleFindPages()}
                      disabled={isMappingWebsite || !websiteUrl}
                      className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary/10 px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                    >
                      {isMappingWebsite ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>{t("knowledge.findingPages")}</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3 h-3" />
                          <span>{t("knowledge.findPages")}</span>
                        </>
                      )}
                    </button>
                  </div>
                  {subscription?.plan_tier !== "premium" && (
                    <p className="ml-1 mt-2 flex items-center gap-1 text-xs font-medium text-primary">
                      <TriangleAlert className="w-3 h-3" />
                      {t("knowledge.premiumOnly")} - {t("knowledge.sitemapRequiredForMulti")}
                    </p>
                  )}
                  {discoveredUrls.length === 0 && (
                    <p className="ml-1 mt-2 text-xs text-on-surface-variant/65">
                      {t("knowledge.singlePageDirectHint")}
                    </p>
                  )}
                </div>

                {discoveredUrls.length > 0 && (
                  <div className="space-y-3 rounded-2xl border border-outline-variant/15 bg-surface-container p-4">
                    <div className="mb-2 flex items-center gap-2 border-b border-outline-variant/10 pb-2">
                      <Database className="h-3.5 w-3.5 text-primary" />
                      <p className="text-sm font-semibold text-on-surface">
                        {t("knowledge.multiPageMode")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-1 items-center gap-2 rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-3 py-2">
                        <Search className="h-3.5 w-3.5 text-on-surface-variant/40" />
                        <input
                          value={pageSearch}
                          onChange={(e) => setPageSearch(e.target.value)}
                          placeholder={t("knowledge.searchPages")}
                          className="flex-1 bg-transparent text-sm outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedUrls(discoveredUrls.slice(0, 30))}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          {t("knowledge.selectAll")}
                        </button>
                        <button
                          onClick={() => setSelectedUrls([])}
                          className="text-xs font-semibold text-on-surface-variant/70 hover:text-on-surface"
                        >
                          {t("knowledge.deselectAll")}
                        </button>
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                      {filteredDiscoveredUrls.length > 0 ? (
                        filteredDiscoveredUrls.map((url) => {
                          const isSelected = selectedUrls.includes(url);
                          const isDisabled = !isSelected && selectedUrls.length >= 30;
                          return (
                            <label
                              key={url}
                              className={`flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-colors ${
                                isSelected 
                                  ? "bg-primary/8 text-primary" 
                                  : "hover:bg-surface-container-highest text-on-surface-variant/80"
                              } ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isDisabled}
                                onChange={() => {
                                  if (isSelected) {
                                    setSelectedUrls(selectedUrls.filter((u) => u !== url));
                                  } else if (selectedUrls.length < 30) {
                                    setSelectedUrls([...selectedUrls, url]);
                                  }
                                }}
                                className="h-3.5 w-3.5 cursor-pointer rounded border-outline-variant/50 text-primary transition-all focus:ring-primary/40"
                              />
                              <span className="flex-1 truncate text-xs">{url}</span>
                            </label>
                          );
                        })
                      ) : (
                        <div className="py-8 text-center">
                          <p className="text-xs text-on-surface-variant/50">{t("knowledge.noPagesFound")}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className={`text-xs font-semibold ${selectedUrls.length >= 30 ? "text-error" : "text-primary"}`}>
                        {selectedUrls.length >= 30 ? t("knowledge.maxPagesReached") : t("knowledge.pagesSelected", { count: selectedUrls.length })}
                      </span>
                    </div>
                  </div>
                )}

                {isScrapingWebsite && (selectedUrls.length > 1) && (
                  <div className="flex items-center gap-2 rounded-xl border border-primary/10 bg-primary/5 px-4 py-2">
                    <Loader2 className="w-3 h-3 text-primary animate-spin" />
                    <p className="text-xs font-medium text-primary">
                      {t("knowledge.crawlingWait")}
                    </p>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => void handleScrapeWebsite()}
                    disabled={isScrapingWebsite || !websiteName || !websiteUrl || (discoveredUrls.length > 0 && selectedUrls.length === 0)}
                    className={primaryActionClass}
                  >
                    {isScrapingWebsite ? t("knowledge.scraping") : t("knowledge.finishAndSync")}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "file" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className={formLabelClass}>{t("knowledge.sourceName")}</label>
                    <input
                      value={fileName}
                      onChange={(event) => setFileName(event.target.value)}
                      placeholder={t("knowledge.fileNamePlaceholder")}
                      className={formControlClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={formLabelClass}>{t("knowledge.fileDescription")}</label>
                    <input
                      value={fileDescription}
                      onChange={(event) => setFileDescription(event.target.value)}
                      placeholder={t("knowledge.fileDescriptionPlaceholder")}
                      className={formControlClass}
                    />
                  </div>
                </div>
                {renderFolderTargetSelect()}
                <label className="flex h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/35 bg-surface-container-lowest transition-colors hover:border-primary/25 hover:bg-surface-container">
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
                    className={primaryActionClass}
                  >
                    {isUploadingFile ? t("common.uploading") : t("knowledge.importDocument")}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "drive" && (
              <div className="space-y-6">
                {renderFolderTargetSelect()}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {driveConnections.length > 1 ? (
                    <select
                      value={selectedDriveConnectionId}
                      onChange={(event) => {
                        setSelectedDriveConnectionId(event.target.value);
                        setDriveFiles([]);
                      }}
                      className="h-11 min-w-[220px] rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 text-sm text-on-surface outline-none transition-all focus:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
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
                      className="h-11 w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest pl-11 pr-4 text-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant/45 focus:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
                    />
                  </div>
                  <button
                    onClick={() => void loadDriveFiles({ reset: true })}
                    disabled={isLoadingDriveFiles || (driveConnections.length > 1 && !selectedDriveConnectionId)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant transition-colors hover:text-primary disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4.5 w-4.5 ${isLoadingDriveFiles ? "animate-spin" : ""}`} />
                  </button>
                </div>

                <div className="grid max-h-[400px] grid-cols-1 gap-2 overflow-y-auto pr-2 custom-scrollbar">
                  {driveFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container-low px-6 py-10 text-center">
                      <Cloud className="mb-3 h-8 w-8 text-on-surface-variant/55" />
                      <p className="text-sm font-medium text-on-surface-variant">{driveStatus}</p>
                    </div>
                  ) : (
                    driveFiles.map((file) => {
                      const isPdf = file.mimeType === "application/pdf";
                      const isGoogleDoc = file.mimeType === "application/vnd.google-apps.document";
                      
                      return (
                        <div
                          key={file.id}
                          className="group/item flex items-center justify-between gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-3 transition-colors hover:bg-surface-container"
                        >
                          <div className="flex items-center gap-3 truncate">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              isPdf ? "bg-error/10 text-error" : 
                              isGoogleDoc ? "bg-primary/10 text-primary" : 
                              "bg-surface-container"
                            } transition-colors`}>
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold text-on-surface">{file.name}</p>
                                {isPdf && (
                                  <span className="rounded-md bg-error/10 px-1.5 py-0.5 text-[10px] font-semibold text-error">PDF</span>
                                )}
                                {isGoogleDoc && (
                                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">DOC</span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-on-surface-variant/60">
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
                            className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                          >
                            {isImportingDriveFileId === file.id ? "..." : t("common.import")}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <SourceBentoGrid 
            onAddText={() => openSourceForm("text")}
            onUploadFile={() => openSourceForm("file")}
            onCloudImport={() => openSourceForm("drive")}
            onScrapeWebsite={() => openSourceForm("website")}
          />
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            {selectedFolder ? (
              <button
                onClick={() => {
                  setSelectedFolderId(null);
                  setTargetFolderId("");
                  setSelectedSourceIds([]);
                  setSourceSearch("");
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                aria-label="Back to all sources"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant/70">
                {selectedFolder ? (
                  <>
                    <button
                      onClick={() => {
                        setSelectedFolderId(null);
                        setTargetFolderId("");
                        setSelectedSourceIds([]);
                        setSourceSearch("");
                      }}
                      className="transition-colors hover:text-on-surface"
                    >
                      {t("knowledge.activeKnowledgeSources")}
                    </button>
                    <ChevronRight className="h-3 w-3 opacity-40" />
                    <span className="text-on-surface">{selectedFolder.name}</span>
                  </>
                ) : (
                  <span>{t("knowledge.activeKnowledgeSources")}</span>
                )}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface-variant">
                {t("knowledge.totalSuffix", {
                  count: selectedFolder
                    ? selectedFolderSources.length
                    : rootSources.length + folders.length,
                })}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Filter className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-on-surface-variant/40" />
              <input
                value={sourceSearch}
                onChange={(event) => setSourceSearch(event.target.value)}
                placeholder={t("knowledge.filterPlaceholder")}
                className="h-10 w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest py-2 pl-10 pr-9 text-sm text-on-surface outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 sm:w-64"
              />
              {sourceSearch ? (
                <button
                  type="button"
                  onClick={() => setSourceSearch("")}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant/50 transition-colors hover:bg-surface-container-high hover:text-on-surface"
                  aria-label={t("knowledge.clearFilter")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <button
              onClick={openCreateFolderDialog}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-on-surface px-4 text-sm font-semibold text-background transition-colors hover:bg-on-surface/90"
            >
              <FolderPlus className="h-4 w-4" />
              {t("knowledge.createFolder")}
            </button>
          </div>
        </div>

        {selectedSourceIds.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-on-primary">
                {selectedSourceIds.length}
              </span>
              <span className="text-sm font-semibold text-on-surface">
                {t("knowledge.selectedSources", { count: selectedSourceIds.length })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {moveTargetFolders.length > 0 && !isMovingSelectedSources && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="flex items-center gap-1 text-xs font-medium text-on-surface-variant/70">
                    <FolderInput className="h-3 w-3" />
                    {t("knowledge.moveSelectedTo")}
                  </span>
                  {moveTargetFolders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => void handleMoveSelectedSourcesToFolder(folder.id)}
                      disabled={isMovingSelectedSources}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 text-xs font-semibold text-on-surface transition-colors hover:border-primary/30 hover:bg-primary/8 hover:text-primary disabled:opacity-50"
                    >
                      <FolderOpen className="h-3 w-3" />
                      {folder.name}
                    </button>
                  ))}
                </div>
              )}

              {isMovingSelectedSources ? (
                <span className="flex items-center gap-1.5 text-xs text-primary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("common.saving")}
                </span>
              ) : null}

              {selectedFolder ? (
                <button
                  onClick={() => void handleRemoveSelectedFromFolder()}
                  disabled={isMovingSelectedSources}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-error/20 bg-error/5 px-3 text-xs font-semibold text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                >
                  <FolderMinus className="h-3.5 w-3.5" />
                  {t("knowledge.removeFromFolder")}
                </button>
              ) : null}

              <div className="h-5 w-px bg-outline-variant/20" />

              <button
                onClick={() => setSelectedSourceIds([])}
                className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                aria-label={t("common.cancel")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}

        <SourceTable 
          sources={filteredSources}
          folders={filteredFolders}
          allFolders={folders}
          isLoading={isLoading}
          onProcess={handleProcess}
          onDelete={handleDeleteClick}
          onView={handleView}
          onOpenFolder={(folder) => {
            setSelectedFolderId(folder.id);
            setTargetFolderId(folder.id);
            setSelectedSourceIds([]);
            setSourceSearch("");
          }}
          onEditFolder={startEditingFolder}
          onDeleteFolder={(folder) => void handleDeleteFolder(folder)}
          selectedSourceIds={selectedSourceIds}
          onToggleSource={toggleSourceSelection}
          onToggleAllSources={toggleAllVisibleSources}
          processingId={processingSourceId}
          deletingId={deletingSourceId}
          deletingFolderId={deletingFolderId}
          emptyTitle={
            selectedFolder
              ? t("knowledge.noFolderSourcesTitle")
              : sourceSearch
                ? t("knowledge.noSourcesFound")
                : undefined
          }
          emptyDescription={
            selectedFolder
              ? t("knowledge.noFolderSourcesDescription")
              : sourceSearch
                ? t("knowledge.noSourcesForFilter")
                : folders.length > 0
                  ? t("knowledge.noRootSourcesDescription")
                  : undefined
          }
        />
      </section>

      {isFolderDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/15 bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FolderPlus className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-on-surface">
                  {editingFolderId ? t("knowledge.editFolder") : t("knowledge.createFolder")}
                </h3>
                <p className="mt-1 text-sm text-on-surface-variant/70">
                  {t("knowledge.createFolderDialogDescription")}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsFolderDialogOpen(false);
                  resetFolderForm();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">
                  {t("knowledge.folderName")}
                </label>
                <input
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  placeholder={t("knowledge.folderNamePlaceholder")}
                  className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">
                  {t("knowledge.folderDescription")}
                </label>
                <input
                  value={folderDescription}
                  onChange={(event) => setFolderDescription(event.target.value)}
                  placeholder={t("knowledge.folderDescriptionPlaceholder")}
                  className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsFolderDialogOpen(false);
                  resetFolderForm();
                }}
                className={secondaryActionClass}
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => void handleSaveFolder()}
                disabled={isSavingFolder || !folderName.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-on-surface px-5 text-sm font-semibold text-background transition-colors hover:bg-on-surface/90 disabled:opacity-50"
              >
                {isSavingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingFolderId ? t("common.save") : t("knowledge.createFolder")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ViewSourceModal
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setSelectedSource(null);
        }}
        source={selectedSource}
        onSourceUpdated={loadSources}
      />

      <ConfirmSimpleModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={confirmDelete}
        title={t("knowledge.deleteTitle")}
        description={t("knowledge.deleteConfirm", { name: sourceToDelete?.name ?? "" })}
        confirmLabel={t("common.delete")}
        isProcessing={deletingSourceId !== null}
      />    </div>
  );
}
