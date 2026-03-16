'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { formatRelativeDate } from '@/lib/utils';

interface WidgetListItem {
  id: string;
  name: string;
  status: 'draft' | 'deployed';
  widgetPublicKey: string;
  attachedAgentCount: number;
  hostedUrl: string;
  needsRedeploy: boolean;
  updatedAt: string;
}

export default function WidgetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [widgets, setWidgets] = useState<WidgetListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const highlightedAgentId = searchParams.get('agent');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await fetch('/api/widgets', { cache: 'no-store' });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload) {
          throw new Error(payload?.error || 'Failed to load widgets.');
        }

        if (isMounted) {
          setWidgets(Array.isArray(payload.widgets) ? payload.widgets : []);
        }
      } catch (error) {
        if (isMounted) {
          showToast(
            error instanceof Error ? error.message : 'Failed to load widgets.',
            'error',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [showToast]);

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
        throw new Error(payload?.error || 'Failed to create widget.');
      }

      router.push(`/widgets/${payload.id}`);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to create widget.',
        'error',
      );
      setIsCreating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            Customer surfaces
          </p>
          <h1 className="mt-3 text-[2.15rem] font-headline font-bold tracking-tight text-on-surface sm:text-[2.45rem]">
            Widgets
          </h1>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">
            Assemble specialists into customer-facing chat surfaces, preview the result, and keep deployment under control.
          </p>
        </div>
        <button
          onClick={() => void createWidget()}
          disabled={isCreating}
          className="rounded-full bg-on-surface px-5 py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isCreating ? 'Creating...' : highlightedAgentId ? 'New Widget From Agent' : 'New Widget'}
        </button>
      </div>

      {highlightedAgentId ? (
        <div className="mb-6 rounded-[1.6rem] border border-outline-variant/25 bg-surface-container-lowest px-5 py-4 text-sm text-on-surface-variant shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          Widget management moved here. Create a widget and attach that agent from this workspace.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[1.8rem] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-surface-container-low" />
            ))}
          </div>
        ) : sortedWidgets.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <span className="material-symbols-outlined rounded-full bg-primary/5 p-4 text-3xl text-primary">
              chat_bubble
            </span>
            <h2 className="mt-4 font-headline text-2xl font-bold text-on-surface">
              No widgets yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
              Create a widget, attach the right specialists, and deploy a single customer-facing chat surface.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/10">
            {sortedWidgets.map((widget) => (
              <Link
                key={widget.id}
                href={`/widgets/${widget.id}`}
                className="grid gap-4 px-8 py-7 transition-colors hover:bg-surface-container-low/45 lg:grid-cols-[1fr_0.5fr_0.35fr_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-on-surface">{widget.name}</p>
                  <p className="mt-1.5 truncate text-sm text-on-surface-variant">
                    {widget.hostedUrl}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-outline-variant/20 bg-background px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant/85">
                    {widget.attachedAgentCount} agents
                  </span>
                  {widget.needsRedeploy ? (
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
                      Needs Redeploy
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${
                      widget.status === 'deployed'
                        ? 'border border-primary/20 bg-primary/10 text-primary'
                        : 'border border-outline-variant/10 bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        widget.status === 'deployed' ? 'bg-primary' : 'bg-on-surface-variant/40'
                      }`}
                    />
                    {widget.status}
                  </span>
                </div>

                <div className="text-right text-xs font-medium text-on-surface-variant/60">
                  Updated {formatRelativeDate(widget.updatedAt)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
