'use client';

import { useCallback, useMemo, useState } from 'react';
import { CalendarDays, Cloud, Mail } from 'lucide-react';
import { AppIcon } from '@/components/icons/AppIcon';
import { SimpleIcon } from '@/components/icons/SimpleIcon';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useToast } from '@/components/ui/ToastProvider';
import type { ConnectionRecord } from '@/lib/types';

interface ConnectionToolkitCard {
  slug: string;
  displayName: string;
  description: string;
  icon: string;
  simpleIcon?: string;
  simpleIconColor?: string;
  category: string;
  surface: string;
  status: string;
  connection: ConnectionRecord | null;
}

function resolveToolkitIcon(icon: string) {
  if (icon === 'mail') return <Mail className="h-7 w-7" />;
  if (icon === 'event') return <CalendarDays className="h-7 w-7" />;
  if (icon === 'cloud') return <Cloud className="h-7 w-7" />;
  return <AppIcon name="cloud" className="h-7 w-7" />;
}

export default function ConnectionsPageClient({
  initialToolkits,
  initialConnections,
}: {
  initialToolkits: ConnectionToolkitCard[];
  initialConnections: ConnectionRecord[];
}) {
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const [toolkits, setToolkits] = useState<ConnectionToolkitCard[]>(initialToolkits);
  const [connections, setConnections] = useState<ConnectionRecord[]>(initialConnections);
  const [isLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [disconnectingConnectionId, setDisconnectingConnectionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/connections/toolkits', {
        cache: 'no-store',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t('connections.loadError'));
      }

      setToolkits(payload.toolkits ?? []);
      setConnections(payload.connections ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('connections.loadError');
      showToast(message, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [showToast, t]);

  const handleConnect = async (toolkitSlug: string) => {
    try {
      const response = await fetch('/api/connections/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toolkitSlug }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t('connections.startFlowError'));
      }

      if (payload.redirectUrl) {
        window.open(payload.redirectUrl, '_blank', 'noopener,noreferrer');
        showToast(t('connections.completeAuthFlow'), 'info');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('connections.startFlowError');
      showToast(message, 'error');
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    setDisconnectingConnectionId(connectionId);

    try {
      const response = await fetch('/api/connections/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ connectionId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t('connections.disconnectError'));
      }

      showToast(t('connections.disconnectSuccess'), 'success');
      setIsSyncing(true);
      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('connections.disconnectError');
      showToast(message, 'error');
    } finally {
      setDisconnectingConnectionId(null);
    }
  };

  const stats = useMemo(() => {
    return {
      connected: connections.filter((item) => item.status === 'connected').length,
      pending: connections.filter((item) => item.status === 'pending').length,
      errors: connections.filter((item) => item.status === 'error').length,
    };
  }, [connections]);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {t('connections.badge')}
          </p>
          <h1 className="mt-3 font-headline text-[2.15rem] font-bold tracking-tight text-on-surface sm:text-[2.45rem]">
            {t('connections.title')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
            {t('connections.description')}
          </p>
        </div>
        <button
          onClick={() => {
            setIsSyncing(true);
            void load();
          }}
          className="rounded-full bg-on-surface px-5 py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90"
        >
          {isSyncing ? t('common.syncing') : t('connections.syncStatus')}
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          [t('common.connected'), String(stats.connected)],
          [t('common.pending'), String(stats.pending)],
          [t('common.errors'), String(stats.errors)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-[1.6rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant/55">
              {label}
            </p>
            <p className="mt-4 font-headline text-4xl font-bold text-on-surface">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-56 animate-pulse rounded-[2rem] bg-surface-container-low"
              />
            ))
          : toolkits.map((toolkit) => (
              <div
                key={toolkit.slug}
                className="rounded-[1.65rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition-all duration-300"
              >
                <div className="mb-8 flex items-start justify-between gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${
                    toolkit.status === 'connected'
                      ? 'bg-success/10 text-success'
                      : 'bg-surface-container'
                  }`}>
                    {toolkit.simpleIcon ? (
                      <SimpleIcon 
                        iconKey={toolkit.simpleIcon} 
                        color={toolkit.simpleIconColor}
                        size={28} 
                      />
                    ) : (
                      resolveToolkitIcon(toolkit.icon)
                    )}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${
                    toolkit.status === 'connected'
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'bg-background text-on-surface-variant'
                  }`}>
                    {toolkit.status}
                  </span>
                </div>
                <p className="font-headline text-xl font-bold text-on-surface">
                  {toolkit.displayName}
                </p>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  {toolkit.description}
                </p>
                <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-primary/70">
                  {toolkit.category} · {toolkit.surface}
                </p>
                <div className="mt-8 flex items-center justify-between gap-3 border-t border-outline-variant/10 pt-4">
                  <div className="text-xs text-on-surface-variant">
                    {toolkit.connection?.last_synced_at
                      ? t('connections.lastSync', { value: new Date(toolkit.connection.last_synced_at).toLocaleString(language === 'sv' ? 'sv-SE' : 'en-US') })
                      : t('connections.noSyncYet')}
                  </div>
                  <div className="flex items-center gap-2">
                    {toolkit.connection && toolkit.status === 'connected' ? (
                      <button
                        onClick={() => handleDisconnect(toolkit.connection!.id)}
                        disabled={disconnectingConnectionId === toolkit.connection.id}
                        className="rounded-full border border-outline-variant/15 px-4 py-2 text-xs font-semibold text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {disconnectingConnectionId === toolkit.connection.id
                          ? t('connections.disconnecting')
                          : t('connections.disconnect')}
                      </button>
                    ) : null}
                    <button
                      onClick={() => handleConnect(toolkit.slug)}
                      className="rounded-full border border-outline-variant/15 px-4 py-2 text-xs font-semibold text-on-surface"
                    >
                      {toolkit.status === 'connected' ? t('connections.reconnect') : t('connections.connect')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
