'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppContext } from '@/components/app/AppContext';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal';
import { EntityActionsMenu } from '@/components/ui/EntityActionsMenu';
import { StatusToggle } from '@/components/ui/StatusToggle';
import { useToast } from '@/components/ui/ToastProvider';
import { MessageSquare, Loader2, RefreshCw } from 'lucide-react';
import { formatRelativeDate } from '@/lib/utils';

interface WidgetListItem {
  id: string;
  name: string;
  status: 'draft' | 'deployed';
  attachedAgentCount: number;
  needsRedeploy: boolean;
  description: string;
  updatedAt: string;
}

/**
 * Modal that collects a widget name before creating it.
 * Prevents the "Untitled Widget" confusion by requiring a name upfront.
 */
function CreateWidgetModal({
  isOpen,
  isLoading,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: (name: string, description: string) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus the input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onConfirm(trimmedName, description.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-widget-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => { if (!isLoading) onClose(); }}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-[2.5rem] border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Icon */}
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-on-surface/5">
          <MessageSquare className="h-7 w-7 text-on-surface" strokeWidth={1.5} />
        </div>

        <h2 id="create-widget-modal-title" className="font-headline text-2xl font-bold tracking-tight text-on-surface">
          {t('widgets.createModalTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant/60">
          {t('widgets.createModalDescription')}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="widget-name-input" className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">
                {t('common.name')}
              </label>
              <input
                ref={inputRef}
                id="widget-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('widgets.createModalPlaceholder')}
                maxLength={80}
                disabled={isLoading}
                className="w-full rounded-md border border-outline-variant/30 bg-background px-6 py-4 text-sm text-on-surface outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 placeholder:text-on-surface-variant/30 disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="widget-description-input" className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">
                {t('widgets.createModalDescriptionLabel')}
              </label>
              <textarea
                id="widget-description-input"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                placeholder={t('widgets.createModalDescriptionPlaceholder')}
                rows={3}
                disabled={isLoading}
                className="w-full resize-none rounded-md border border-outline-variant/30 bg-background px-6 py-4 text-sm text-on-surface outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 placeholder:text-on-surface-variant/30 disabled:opacity-50"
              />
              <div className="flex justify-end pr-2">
                <span className={`text-[9px] font-bold uppercase tracking-[0.1em] ${description.length >= 180 ? 'text-primary' : 'text-on-surface-variant/30'}`}>
                  {description.length}/200
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 rounded-xl bg-on-surface/5 px-6 py-3.5 text-sm font-semibold text-on-surface transition-all hover:bg-on-surface/10 disabled:opacity-40"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex-1 rounded-xl bg-on-surface px-6 py-3.5 text-sm font-semibold text-background transition-all hover:bg-on-surface/90 active:scale-95 disabled:opacity-50 shadow-lg shadow-on-surface/5"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('widgets.creating')}</span>
                </div>
              ) : t('widgets.createConfirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Modal that allows editing a widget's name and description.
 */
function EditWidgetModal({
  isOpen,
  isLoading,
  initialName,
  initialDescription,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  isLoading: boolean;
  initialName: string;
  initialDescription: string;
  onConfirm: (name: string, description: string) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialName || '');
  const [description, setDescription] = useState(initialDescription || '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus the input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onConfirm(trimmedName, description.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-widget-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => { if (!isLoading) onClose(); }}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-[2.5rem] border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Icon */}
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-on-surface/5">
          <MessageSquare className="h-7 w-7 text-on-surface" strokeWidth={1.5} />
        </div>

        <h2 id="edit-widget-modal-title" className="font-headline text-2xl font-bold tracking-tight text-on-surface">
          {t('widgets.editModalTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant/60">
          {t('widgets.editModalDescription')}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="edit-widget-name-input" className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">
                {t('common.name')}
              </label>
              <input
                ref={inputRef}
                id="edit-widget-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('widgets.createModalPlaceholder')}
                maxLength={80}
                disabled={isLoading}
                className="w-full rounded-md border border-outline-variant/30 bg-background px-6 py-4 text-sm text-on-surface outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 placeholder:text-on-surface-variant/30 disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-widget-description-input" className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">
                {t('widgets.createModalDescriptionLabel')}
              </label>
              <textarea
                id="edit-widget-description-input"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                placeholder={t('widgets.createModalDescriptionPlaceholder')}
                rows={3}
                disabled={isLoading}
                className="w-full resize-none rounded-md border border-outline-variant/30 bg-background px-6 py-4 text-sm text-on-surface outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 placeholder:text-on-surface-variant/30 disabled:opacity-50"
              />
              <div className="flex justify-end pr-2">
                <span className={`text-[9px] font-bold uppercase tracking-[0.1em] ${description.length >= 180 ? 'text-primary' : 'text-on-surface-variant/30'}`}>
                  {description.length}/200
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 rounded-xl bg-on-surface/5 px-6 py-3.5 text-sm font-semibold text-on-surface transition-all hover:bg-on-surface/10 disabled:opacity-40"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex-1 rounded-xl bg-on-surface px-6 py-3.5 text-sm font-semibold text-background transition-all hover:bg-on-surface/90 active:scale-95 disabled:opacity-50 shadow-lg shadow-on-surface/5"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('common.saving')}</span>
                </div>
              ) : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WidgetsPageClient({
  initialWidgets,
}: {
  initialWidgets: WidgetListItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { membership } = useAppContext();
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const [widgets, setWidgets] = useState<WidgetListItem[]>(initialWidgets);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [widgetToEdit, setWidgetToEdit] = useState<WidgetListItem | null>(null);
  const [deletingWidgetId, setDeletingWidgetId] = useState<string | null>(null);
  const [togglingWidgetId, setTogglingWidgetId] = useState<string | null>(null);
  const [syncingWidgetId, setSyncingWidgetId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [widgetToDelete, setWidgetToDelete] = useState<WidgetListItem | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const highlightedAgentId = searchParams.get('agent');
  const isLoading = false;

  const needsSyncCount = useMemo(
    () => widgets.filter((w) => w.needsRedeploy && w.status === 'deployed').length,
    [widgets],
  );

  const sortedWidgets = useMemo(
    () =>
      [...widgets].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      ),
    [widgets],
  );

  const handleSync = async (widgetId: string) => {
    setSyncingWidgetId(widgetId);
    try {
      const response = await fetch(`/api/widgets/${widgetId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'deployed',
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || t('widgetBuilder.updateDeploymentError'));
      }

      setWidgets((current) =>
        current.map((w) =>
          w.id === widgetId ? { ...w, needsRedeploy: false, updatedAt: new Date().toISOString() } : w
        )
      );
      showToast(t('widgetBuilder.deployed'), 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('widgetBuilder.updateDeploymentError'),
        'error',
      );
    } finally {
      setSyncingWidgetId(null);
    }
  };

  const handleSyncAll = async () => {
    const toSync = widgets.filter((w) => w.needsRedeploy && w.status === 'deployed');
    if (toSync.length === 0) return;

    setIsSyncingAll(true);
    let successCount = 0;
    let failCount = 0;

    for (const widget of toSync) {
      try {
        const response = await fetch(`/api/widgets/${widget.id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'deployed' }),
        });
        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      setWidgets((current) =>
        current.map((w) => {
          const match = toSync.find((ts) => ts.id === w.id);
          if (match) {
            return { ...w, needsRedeploy: false, updatedAt: new Date().toISOString() };
          }
          return w;
        })
      );
      showToast(t('widgetBuilder.deployed'), 'success');
    }

    if (failCount > 0) {
      showToast(t('widgetBuilder.updateDeploymentError'), 'error');
    }

    setIsSyncingAll(false);
  };

  /**
   * Actually creates the widget once the user has confirmed a name.
   * The API already supports a `name` field in the POST body.
   */
  const createWidget = async (name: string, description: string) => {
    setIsCreating(true);

    try {
      const response = await fetch('/api/widgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          agentId: highlightedAgentId || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.id) {
        throw new Error(payload?.error || t('widgets.createError'));
      }

      router.push(`/widgets/${payload.id}`);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('widgets.createError'),
        'error',
      );
      setIsCreating(false);
      // Keep modal open so user can retry
    }
  };

  const handleUpdateWidget = async (name: string, description: string) => {
    if (!widgetToEdit) return;
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/widgets/${widgetToEdit.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || t('widgets.updateError') || 'Failed to update widget');
      }

      setWidgets((current) =>
        current.map((w) =>
          w.id === widgetToEdit.id ? { ...w, name, description, updatedAt: new Date().toISOString() } : w
        )
      );
      setWidgetToEdit(null);
      showToast(t('common.saveChanges'), 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('widgets.updateError') || 'Failed to update widget',
        'error',
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePermanentDelete = async (widget: WidgetListItem) => {
    if (membership.role !== 'owner') {
      showToast(t('widgets.ownerDeleteOnly'), 'error');
      return;
    }

    setWidgetToDelete(widget);
    setDeleteConfirmation('');
  };

  const handleStatusToggle = async (widget: WidgetListItem) => {
    const nextStatus = widget.status === 'deployed' ? 'draft' : 'deployed';
    setTogglingWidgetId(widget.id);

    try {
      const response = await fetch(`/api/widgets/${widget.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || t('widgets.updateStatusError'));
      }

      setWidgets((current) =>
        current.map((item) =>
          item.id === widget.id
            ? {
                ...item,
                status: nextStatus,
                needsRedeploy: false,
              }
            : item,
        ),
      );
      showToast(nextStatus === 'deployed' ? t('widgets.turnedOn') : t('widgets.turnedOff'), 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('widgets.updateStatusError'),
        'error',
      );
    } finally {
      setTogglingWidgetId(null);
    }
  };

  const closeDeleteModal = () => {
    if (deletingWidgetId) {
      return;
    }

    setWidgetToDelete(null);
    setDeleteConfirmation('');
  };

  const confirmPermanentDelete = async () => {
    if (!widgetToDelete) {
      return;
    }

    setDeletingWidgetId(widgetToDelete.id);

    try {
      const response = await fetch(`/api/widgets/${widgetToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmationName: deleteConfirmation,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || t('widgets.deleteError'));
      }

      setWidgets((current) => current.filter((item) => item.id !== widgetToDelete.id));
      setWidgetToDelete(null);
      setDeleteConfirmation('');
      showToast(t('widgets.deleted'), 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('widgets.deleteError'),
        'error',
      );
    } finally {
      setDeletingWidgetId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-10 sm:px-8 lg:px-10">
      {/* Page Header */}
      <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
            {t('widgets.badge')}
          </p>
          <h1 className="mt-4 text-[2.5rem] font-headline font-bold tracking-tight text-on-surface sm:text-[3rem]">
            {t('widgets.title')}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-on-surface-variant/60">
            {t('widgets.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {needsSyncCount > 0 && (
            <button
              onClick={() => void handleSyncAll()}
              disabled={isSyncingAll}
              className="group relative flex items-center gap-3 overflow-hidden rounded-full border border-primary/20 bg-primary/5 px-8 py-4 text-sm font-bold uppercase tracking-[0.16em] text-primary transition-all hover:bg-primary/10 active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
              <span className="relative z-10">
                {isSyncingAll ? t('widgetBuilder.syncing') : `${t('widgetBuilder.syncChanges')} (${needsSyncCount})`}
              </span>
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={isCreating}
            className="group relative flex items-center gap-3 overflow-hidden rounded-full bg-on-surface px-8 py-4 text-sm font-bold uppercase tracking-[0.16em] text-background shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
          >
            <span className="relative z-10">
              {isCreating ? t('widgets.creatingWorkspace') : highlightedAgentId ? t('widgets.newWidgetFromAgent') : t('widgets.initializeWidget')}
            </span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/12 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
          </button>
        </div>
      </div>

      {highlightedAgentId && (
        <div className="mb-8 flex items-center gap-4 rounded-[1.8rem] border border-primary/20 bg-primary/5 px-6 py-4 text-sm font-medium text-primary shadow-sm animate-in fade-in slide-in-from-top-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] text-background">!</span>
          {t('widgets.managementSessionActive')}
        </div>
      )}

      {/* Grid Registry */}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-[2.5rem] bg-surface-container-low" />
          ))}
        </div>
      ) : sortedWidgets.length === 0 ? (
        <div className="rounded-[3rem] border border-dashed border-outline-variant/20 bg-surface-container-lowest px-6 py-24 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-low">
             <span className="text-3xl opacity-20">💬</span>
          </div>
          <h2 className="font-headline text-2xl font-bold text-on-surface">{t('widgets.noWidgets')}</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-on-surface-variant/50 leading-relaxed">
            {t('widgets.noWidgetsDescription')}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sortedWidgets.map((widget) => {
             const isLive = widget.status === 'deployed';
             return (
               <div
                 key={widget.id}
                 className="group relative flex flex-col rounded-[2.5rem] border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-sm transition-all hover:border-primary/20 hover:shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500"
               >
                 {/* Card Header: Identity */}
                 <div className="mb-8 flex items-start justify-between">
                   <div className="flex-1 min-w-0">
                     <Link href={`/widgets/${widget.id}`}>
                       <h3 className="truncate font-headline text-xl font-bold tracking-tight text-on-surface group-hover:text-primary transition-colors">
                         {widget.name}
                       </h3>
                     </Link>
                     <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/40">
                       {t('widgets.idUpdated', {
                         id: widget.id.slice(0, 8),
                         value: formatRelativeDate(widget.updatedAt, language),
                       })}
                     </p>
                      {widget.description && (
                        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-on-surface-variant/60">
                          {widget.description}
                        </p>
                      )}
                   </div>
                   <div className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-2.5 py-1 ring-1 ring-inset ring-outline-variant/5">
                      <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-primary animate-pulse' : 'bg-on-surface-variant/20'}`} />
                      <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/60">
                        {isLive ? t('statuses.agent.live') : t('statuses.widget.draft')}
                      </span>
                   </div>
                 </div>

                 {/* Metrics / Metadata */}
                 <div className="mb-10 flex flex-wrap gap-3">
                   <span className="rounded-full bg-background px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/60 ring-1 ring-outline-variant/10">
                     {widget.attachedAgentCount} {widget.attachedAgentCount === 1 ? t('widgets.specialist') : t('widgets.specialists')}
                   </span>
                   {widget.needsRedeploy && (
                     <span className="rounded-full bg-primary/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                        {t('statuses.widget.redeployRequired')}
                     </span>
                   )}
                 </div>

                 {/* Bottom Actions */}
                 <div className="mt-auto flex items-center justify-between border-t border-outline-variant/5 pt-6">
                    <StatusToggle
                       checked={isLive}
                       onClick={() => void handleStatusToggle(widget)}
                       disabled={togglingWidgetId === widget.id || deletingWidgetId === widget.id}
                       label={`${t('common.status')} ${widget.name}`}
                    />
                    
                    <div className="flex items-center gap-2">
                       {widget.needsRedeploy && (
                         <button
                           onClick={() => void handleSync(widget.id)}
                           disabled={syncingWidgetId === widget.id || togglingWidgetId === widget.id || deletingWidgetId === widget.id}
                           title={t('widgetBuilder.syncChanges')}
                           className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-all hover:bg-primary hover:text-background disabled:opacity-50"
                         >
                           <RefreshCw className={`h-4 w-4 ${syncingWidgetId === widget.id ? 'animate-spin' : ''}`} />
                         </button>
                       )}
                       <Link
                         href={`/widgets/${widget.id}`}
                         className="rounded-full border border-outline-variant/15 px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant transition-all hover:bg-on-surface hover:text-background"
                       >
                         {t('common.open')}
                       </Link>
                       <EntityActionsMenu
                         onEdit={() => setWidgetToEdit(widget)}
                         onDelete={() => void handlePermanentDelete(widget)}
                         deleteDisabled={
                           deletingWidgetId === widget.id ||
                           togglingWidgetId === widget.id ||
                           membership.role !== 'owner'
                         }
                       />
                    </div>
                 </div>
               </div>
             );
          })}
        </div>
      )}

      {/* Create Widget Name Modal */}
      {showCreateModal && (
        <CreateWidgetModal
          isOpen={showCreateModal}
          isLoading={isCreating}
          onConfirm={(name, description) => void createWidget(name, description)}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {widgetToEdit && (
        <EditWidgetModal
          isOpen={Boolean(widgetToEdit)}
          isLoading={isUpdating}
          initialName={widgetToEdit.name}
          initialDescription={widgetToEdit.description}
          onConfirm={(name, description) => void handleUpdateWidget(name, description)}
          onClose={() => setWidgetToEdit(null)}
        />
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(widgetToDelete)}
        title={t('widgets.deleteTitle')}
        entityName={widgetToDelete?.name ?? ''}
        entityLabel={t('widgets.deleteEntityLabel')}
        description={t('widgets.deleteDescription')}
        confirmationValue={deleteConfirmation}
        onConfirmationChange={setDeleteConfirmation}
        onClose={closeDeleteModal}
        onConfirm={() => void confirmPermanentDelete()}
        isDeleting={deletingWidgetId === widgetToDelete?.id}
      />
    </div>
  );
}
