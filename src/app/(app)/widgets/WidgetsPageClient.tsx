'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppContext } from '@/components/app/AppContext';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal';
import { EntityActionsMenu } from '@/components/ui/EntityActionsMenu';
import { StatusToggle } from '@/components/ui/StatusToggle';
import { useToast } from '@/components/ui/ToastProvider';
import { formatRelativeDate } from '@/lib/utils';

interface WidgetListItem {
  id: string;
  name: string;
  status: 'draft' | 'deployed';
  attachedAgentCount: number;
  needsRedeploy: boolean;
  updatedAt: string;
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
  const [deletingWidgetId, setDeletingWidgetId] = useState<string | null>(null);
  const [togglingWidgetId, setTogglingWidgetId] = useState<string | null>(null);
  const [widgetToDelete, setWidgetToDelete] = useState<WidgetListItem | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const highlightedAgentId = searchParams.get('agent');
  const isLoading = false;

  const sortedWidgets = useMemo(
    () =>
      [...widgets].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      ),
    [widgets],
  );

  const createWidget = async () => {
    setIsCreating(true);

    try {
      const response = await fetch('/api/widgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        <button
          onClick={() => void createWidget()}
          disabled={isCreating}
          className="group relative flex items-center gap-3 overflow-hidden rounded-full bg-on-surface px-8 py-4 text-sm font-bold uppercase tracking-[0.16em] text-background shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          <span className="relative z-10">
            {isCreating ? t('widgets.creatingWorkspace') : highlightedAgentId ? t('widgets.newWidgetFromAgent') : t('widgets.initializeWidget')}
          </span>
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/12 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
        </button>
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
                       <Link
                         href={`/widgets/${widget.id}`}
                         className="rounded-full border border-outline-variant/15 px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant transition-all hover:bg-on-surface hover:text-background"
                       >
                         {t('common.open')}
                       </Link>
                       <EntityActionsMenu
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
