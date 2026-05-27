'use client';

import { useCallback, useMemo, useState } from 'react';
import { CalendarDays, Cloud, Copy, Hash, Link2, Mail, Network, ShoppingBag } from 'lucide-react';
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
        <div className="flex flex-wrap items-center gap-2">
          {canManageAuthLinks ? (
            <button
              type="button"
              onClick={() => setIsAuthLinksOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface transition-colors hover:border-primary/35 hover:bg-primary-container hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
            className="rounded-full bg-on-surface px-5 py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90"
          >
            {isSyncing ? t('common.syncing') : t('connections.syncStatus')}
          </button>
        </div>
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
                className="rounded-[1.65rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_22px_60px_rgba(15,23,42,0.09)]"
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
                      ? t('connections.lastSync', { value: formatDateTime(toolkit.connection.last_synced_at) })
                      : t('connections.noSyncYet')}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {canManageAuthLinks ? (
                      <button
                        type="button"
                        onClick={() => handleCreateAuthLink(toolkit.slug)}
                        disabled={creatingAuthLinkSlug === toolkit.slug}
                        className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/15 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:border-primary/35 hover:bg-primary-container hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
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
                        className="rounded-full border border-outline-variant/15 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:border-error/30 hover:bg-error-container hover:text-error focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-outline-variant/15 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
                      >
                        {disconnectingConnectionId === toolkit.connection.id
                          ? t('connections.disconnecting')
                          : t('connections.disconnect')}
                      </button>
                    ) : null}
                    <button
                      onClick={() => handleConnect(toolkit)}
                      className="rounded-full border border-outline-variant/15 px-4 py-2 text-xs font-semibold text-on-surface transition-colors hover:border-primary/35 hover:bg-primary hover:text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {toolkit.status === 'connected' ? t('connections.replaceAccount') : t('connections.connect')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
      </div>

      {canManageAuthLinks && isAuthLinksOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-4 py-6"
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
                        <span className="rounded-full border border-outline-variant/20 bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
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
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="connection-auth-link-title"
        >
          <div className="w-full max-w-lg rounded-[1.65rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
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

            <label className="mt-5 block text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant/70">
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
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-on-surface px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
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
