'use client';

import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, Cloud, Copy, Hash, Link2, Mail, Network, RefreshCw, ShoppingBag } from 'lucide-react';
import { AppIcon } from '@/components/icons/AppIcon';
import { SimpleIcon } from '@/components/icons/SimpleIcon';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useToast } from '@/components/ui/ToastProvider';
import type { ConnectionAuthLinkRecord, ConnectionRecord } from '@/lib/types';

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

type ConnectionAuthLinkListItem = Omit<ConnectionAuthLinkRecord, 'token_hash'>;

interface GeneratedAuthLink {
  url: string;
  toolkitName: string;
  expiresAt: string;
}

function resolveToolkitIcon(icon: string) {
  if (icon === 'mail') return <Mail className="h-7 w-7" />;
  if (icon === 'event') return <CalendarDays className="h-7 w-7" />;
  if (icon === 'cloud') return <Cloud className="h-7 w-7" />;
  if (icon === 'tag') return <Hash className="h-7 w-7" />;
  if (icon === 'hub') return <Network className="h-7 w-7" />;
  if (icon === 'shopping_bag') return <ShoppingBag className="h-7 w-7" />;
  return <AppIcon name="cloud" className="h-7 w-7" />;
}

function readConnectionStatusReason(connection: ConnectionRecord | null) {
  if (!connection) {
    return null;
  }

  const data = connection.toolkit_data ?? {};
  const lastExpiryEvent = data.lastExpiryEvent;
  const lastExpiryReason =
    lastExpiryEvent && typeof lastExpiryEvent === 'object'
      ? (lastExpiryEvent as Record<string, unknown>).statusReason
      : null;
  const reason = data.statusReason ?? data.status_reason ?? lastExpiryReason;

  return typeof reason === 'string' && reason.trim() ? reason.trim() : null;
}

export default function ConnectionsPageClient({
  initialToolkits,
  initialConnections,
  initialAuthLinks,
  canManageAuthLinks,
}: {
  initialToolkits: ConnectionToolkitCard[];
  initialConnections: ConnectionRecord[];
  initialAuthLinks: ConnectionAuthLinkListItem[];
  canManageAuthLinks: boolean;
}) {
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const [toolkits, setToolkits] = useState<ConnectionToolkitCard[]>(initialToolkits);
  const [connections, setConnections] = useState<ConnectionRecord[]>(initialConnections);
  const [authLinks, setAuthLinks] = useState<ConnectionAuthLinkListItem[]>(initialAuthLinks);
  const [isLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [disconnectingConnectionId, setDisconnectingConnectionId] = useState<string | null>(null);
  const [creatingAuthLinkSlug, setCreatingAuthLinkSlug] = useState<string | null>(null);
  const [revokingAuthLinkId, setRevokingAuthLinkId] = useState<string | null>(null);
  const [generatedAuthLink, setGeneratedAuthLink] = useState<GeneratedAuthLink | null>(null);
  const [isAuthLinksOpen, setIsAuthLinksOpen] = useState(false);

  const formatDateTime = useCallback(
    (value: string) => new Date(value).toLocaleString(language === 'sv' ? 'sv-SE' : 'en-US'),
    [language],
  );

  const getToolkitName = useCallback(
    (toolkitSlug: string) =>
      toolkits.find((toolkit) => toolkit.slug === toolkitSlug)?.displayName ?? toolkitSlug,
    [toolkits],
  );

  const loadAuthLinks = useCallback(async () => {
    if (!canManageAuthLinks) {
      return;
    }

    const response = await fetch('/api/connections/auth-links', {
      cache: 'no-store',
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? t('connections.loadError'));
    }

    setAuthLinks(payload.authLinks ?? []);
  }, [canManageAuthLinks, t]);

  const load = useCallback(async (force = false) => {
    try {
      const response = await fetch(`/api/connections/toolkits${force ? '?force=true' : ''}`, {
        cache: 'no-store',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t('connections.loadError'));
      }

      setToolkits(payload.toolkits ?? []);
      setConnections(payload.connections ?? []);
      await loadAuthLinks();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('connections.loadError');
      showToast(message, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [loadAuthLinks, showToast, t]);

  const handleConnect = useCallback(async (toolkit: ConnectionToolkitCard) => {
    try {
      if (toolkit.status === 'connected') {
        showToast(
          t('connections.replaceFlowWarning', { integration: toolkit.displayName }),
          'info',
        );
      }

      const response = await fetch('/api/connections/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toolkitSlug: toolkit.slug }),
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
  }, [showToast, t]);

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
      await load(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('connections.disconnectError');
      showToast(message, 'error');
    } finally {
      setDisconnectingConnectionId(null);
    }
  };

  const handleCreateAuthLink = async (toolkitSlug: string) => {
    setCreatingAuthLinkSlug(toolkitSlug);

    try {
      const response = await fetch('/api/connections/auth-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toolkitSlug }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t('connections.authLinkCreateError'));
      }

      setGeneratedAuthLink({
        url: payload.link,
        toolkitName: getToolkitName(toolkitSlug),
        expiresAt: payload.expiresAt,
      });
      showToast(t('connections.authLinkCreated'), 'success');
      await loadAuthLinks();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('connections.authLinkCreateError');
      showToast(message, 'error');
    } finally {
      setCreatingAuthLinkSlug(null);
    }
  };

  const handleCopyAuthLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    showToast(t('connections.authLinkCopied'), 'success');
  };

  const handleRevokeAuthLink = async (authLinkId: string) => {
    setRevokingAuthLinkId(authLinkId);

    try {
      const response = await fetch(`/api/connections/auth-links/${authLinkId}/revoke`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? t('connections.authLinkRevokeError'));
      }

      showToast(t('connections.authLinkRevoked'), 'success');
      await loadAuthLinks();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('connections.authLinkRevokeError');
      showToast(message, 'error');
    } finally {
      setRevokingAuthLinkId(null);
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
    <div className="app-page">
      <header className="app-section-header">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-2xl">
            <h1 className="text-2xl font-bold leading-tight tracking-normal text-on-surface sm:text-3xl">
              {t('connections.title')}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant/75">
              {t('connections.description')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageAuthLinks ? (
              <button
                type="button"
                onClick={() => setIsAuthLinksOpen(true)}
                className="app-secondary-button"
              >
                <Link2 className="h-4 w-4" />
                {t('connections.authLinksTitle')}
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">
                  {authLinks.length}
                </span>
              </button>
            ) : null}
            <button
              onClick={() => {
                setIsSyncing(true);
                void load(true);
              }}
              className="app-primary-button group transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : 'transition-transform duration-300 group-hover:rotate-180'}`} />
              {isSyncing ? t('common.syncing') : t('connections.syncStatus')}
            </button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: t('common.connected'), value: String(stats.connected), dot: 'bg-success animate-pulse' },
          { label: t('common.pending'), value: String(stats.pending), dot: 'bg-warning' },
          { label: t('common.errors'), value: String(stats.errors), dot: stats.errors > 0 ? 'bg-error animate-pulse' : 'bg-on-surface-variant/40' },
        ].map(({ label, value, dot }) => (
          <div
            key={label}
            className="app-card group relative transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-md hover:bg-surface-container-low/60"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-on-surface-variant/70 uppercase tracking-wider">
                {label}
              </p>
              <span className={`flex h-2.5 w-2.5 rounded-full ${dot}`} />
            </div>
            <p className="mt-3 text-3xl font-extrabold tabular-nums text-on-surface tracking-tight">{value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-56 animate-pulse rounded-2xl border border-outline-variant/10 bg-surface-container-low"
              />
            ))
          : toolkits.map((toolkit) => {
              const statusReason = readConnectionStatusReason(toolkit.connection);

              return (
                <div
                  key={toolkit.slug}
                  className="app-card group relative flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md hover:bg-surface-container-low/60"
                >
                  <div>
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-105 ${
                        toolkit.status === 'connected'
                          ? 'bg-success/10 text-success ring-1 ring-success/20'
                          : 'bg-surface-container text-on-surface-variant'
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
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                        toolkit.status === 'connected'
                          ? 'bg-success/10 text-success border border-success/20 shadow-xs'
                          : 'bg-surface-container text-on-surface-variant ring-1 ring-outline-variant/15'
                      }`}>
                        {toolkit.status === 'connected' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                        )}
                        {toolkit.status}
                      </span>
                    </div>
                    <p className="text-base font-bold tracking-tight text-on-surface transition-colors group-hover:text-primary">
                      {toolkit.displayName}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-on-surface-variant/80">
                      {toolkit.description}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-primary/80 tracking-tight">
                      {toolkit.category} · {toolkit.surface}
                    </p>
                    {statusReason && toolkit.status !== 'connected' ? (
                      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-error/20 bg-error/8 dark:bg-error/15 px-3.5 py-3 text-xs leading-relaxed text-error shadow-xs">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p className="font-medium">{t('connections.statusReason', { value: statusReason })}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 border-t border-outline-variant/10 pt-4">
                    <div className="text-xs font-medium text-on-surface-variant/70">
                      {toolkit.connection?.last_synced_at
                        ? t('connections.lastSync', { value: formatDateTime(toolkit.connection.last_synced_at) })
                        : t('connections.noSyncYet')}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canManageAuthLinks ? (
                        <button
                          type="button"
                          onClick={() => handleCreateAuthLink(toolkit.slug)}
                          disabled={creatingAuthLinkSlug === toolkit.slug}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-outline-variant/15 px-3 text-xs font-semibold text-on-surface-variant transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          {creatingAuthLinkSlug === toolkit.slug
                            ? t('common.processing')
                            : t('connections.shareAuthLink')}
                        </button>
                      ) : null}
                      {toolkit.connection && toolkit.status === 'connected' ? (
                        <button
                          onClick={() => handleDisconnect(toolkit.connection!.id)}
                          disabled={disconnectingConnectionId === toolkit.connection.id}
                          className="h-9 rounded-xl border border-outline-variant/15 px-3 text-xs font-semibold text-on-surface-variant transition-all duration-200 hover:border-error/30 hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-outline-variant/15 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
                        >
                          {disconnectingConnectionId === toolkit.connection.id
                            ? t('connections.disconnecting')
                            : t('connections.disconnect')}
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleConnect(toolkit)}
                        className="app-primary-button min-h-9 px-3.5 text-xs group-hover:shadow-xs transition-all active:scale-[0.98]"
                      >
                        {toolkit.status === 'connected' ? t('connections.replaceAccount') : t('connections.connect')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      {canManageAuthLinks && isAuthLinksOpen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 backdrop-blur-md px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shared-auth-links-title"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-[1.65rem] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant/10 p-6">
              <div>
                <h2
                  id="shared-auth-links-title"
                  className="font-headline text-2xl font-bold text-on-surface"
                >
                  {t('connections.authLinksTitle')}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">
                  {t('connections.authLinksDescription')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAuthLinksOpen(false)}
                className="shrink-0 rounded-full border border-outline-variant/20 px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:border-on-surface/20 hover:text-on-surface"
              >
                {t('common.close')}
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              <div className="divide-y divide-outline-variant/10 overflow-hidden rounded-2xl border border-outline-variant/20">
                {authLinks.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-on-surface-variant">
                    {t('connections.authLinksEmpty')}
                  </p>
                ) : (
                  authLinks.map((authLink) => (
                    <div
                      key={authLink.id}
                      className="flex flex-col gap-3 bg-background/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface">
                          {getToolkitName(authLink.toolkit_slug)}
                        </p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {t('connections.authLinkExpires', {
                            value: formatDateTime(authLink.expires_at),
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-outline-variant/20 bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface-variant">
                          {authLink.status}
                        </span>
                        {authLink.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => handleRevokeAuthLink(authLink.id)}
                            disabled={revokingAuthLinkId === authLink.id}
                            className="rounded-full border border-outline-variant/15 px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:border-error/30 hover:bg-error-container hover:text-error disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {revokingAuthLinkId === authLink.id
                              ? t('common.revoking')
                              : t('common.revoke')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {generatedAuthLink ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 backdrop-blur-md px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="connection-auth-link-title"
        >
          <div className="w-full max-w-lg rounded-[1.65rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-primary">
                  {generatedAuthLink.toolkitName}
                </p>
                <h2
                  id="connection-auth-link-title"
                  className="mt-2 font-headline text-2xl font-bold text-on-surface"
                >
                  {t('connections.shareAuthLink')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setGeneratedAuthLink(null)}
                className="rounded-full border border-outline-variant/20 px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:border-on-surface/20 hover:text-on-surface"
              >
                {t('common.close')}
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-on-surface-variant">
              {t('connections.authLinkWarning')}
            </p>

            <label className="mt-5 block text-sm font-medium text-on-surface-variant">
              {t('connections.authLinkCopyLabel')}
            </label>
            <div className="mt-2 flex gap-2">
              <input
                readOnly
                value={generatedAuthLink.url}
                className="min-w-0 flex-1 rounded-2xl border border-outline-variant/25 bg-background px-4 py-3 text-sm text-on-surface outline-none"
              />
              <button
                type="button"
                onClick={() => handleCopyAuthLink(generatedAuthLink.url)}
                className="app-primary-button min-h-12 rounded-2xl px-4"
              >
                <Copy className="h-4 w-4" />
                {t('common.copy')}
              </button>
            </div>

            <p className="mt-3 text-xs font-medium text-on-surface-variant">
              {t('connections.authLinkExpires', {
                value: formatDateTime(generatedAuthLink.expiresAt),
              })}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
