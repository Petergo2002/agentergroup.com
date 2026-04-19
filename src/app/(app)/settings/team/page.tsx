'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '@/components/app/AppContext';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useToast } from '@/components/ui/ToastProvider';
import type { WorkspaceMemberWithProfile, WorkspaceInviteRecord, ExpandedWorkspaceInviteRecord } from '@/lib/types';
import { Mail, Copy, X, Info } from 'lucide-react';

export default function TeamSettingsPage() {
  const { workspace, membership, user } = useAppContext();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [members, setMembers] = useState<WorkspaceMemberWithProfile[]>([]);
  const [invites, setInvites] = useState<WorkspaceInviteRecord[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<ExpandedWorkspaceInviteRecord[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  // Removal state
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

  const canManageTeam = membership.role === 'owner' || membership.role === 'admin';

  const loadMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/members`);
      const payload = await response.json();
      if (response.ok) {
        setMembers(payload.members ?? []);
      }
    } catch {
      // Silently handle — empty state will show
    } finally {
      setIsLoadingMembers(false);
    }
  }, [workspace.id]);

  const loadInvites = useCallback(async () => {
    setIsLoadingInvites(true);
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/invites`);
      const payload = await response.json();
      if (response.ok) {
        setInvites((payload.invites ?? []).filter((inv: WorkspaceInviteRecord) => inv.status === 'pending'));
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoadingInvites(false);
    }
  }, [workspace.id]);

  const loadIncomingInvites = useCallback(async () => {
    setIsLoadingIncoming(true);
    try {
      const response = await fetch(`/api/invites/incoming`);
      const payload = await response.json();
      if (response.ok) {
        setIncomingInvites(payload.incoming ?? []);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoadingIncoming(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
    loadInvites();
    loadIncomingInvites();
  }, [loadMembers, loadInvites, loadIncomingInvites]);

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    setLastInviteLink(null);

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to send invite.');
      }

      setLastInviteLink(payload.inviteLink ?? null);

      if (payload.emailSent) {
        showToast(t('settings.team.inviteSent') || `Invite sent to ${inviteEmail}`, 'success');
      } else {
        showToast(
          t('settings.team.inviteCreatedNoEmail') || 'Invite created! Copy the link to share it.',
          'success',
        );
      }

      setInviteEmail('');
      loadInvites();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send invite.';
      showToast(message, 'error');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setRevokingInviteId(inviteId);
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/invites/${inviteId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? 'Failed to revoke invite.');
      }
      showToast(t('settings.team.inviteRevoked') || 'Invite revoked.', 'success');
      loadInvites();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to revoke invite.';
      showToast(message, 'error');
    } finally {
      setRevokingInviteId(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const confirmed = window.confirm(
      t('settings.team.removeMemberConfirm') || `Are you sure you want to remove ${memberName} from this workspace?`,
    );
    if (!confirmed) return;

    setRemovingMemberId(memberId);
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? 'Failed to remove member.');
      }
      showToast(t('settings.team.memberRemoved') || 'Member removed.', 'success');
      loadMembers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove member.';
      showToast(message, 'error');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleDeclineIncoming = async (token: string) => {
    const confirmed = window.confirm(t('common.declineConfirm') || 'Are you sure you want to decline this invitation?');
    if (!confirmed) return;

    try {
      const response = await fetch('/api/invites/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? 'Failed to decline invite.');
      }
      showToast(t('common.declined') || 'Invite declined.', 'success');
      loadIncomingInvites();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error declining invite.', 'error');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('common.copied') || 'Copied to clipboard!', 'success');
    } catch {
      showToast('Failed to copy.', 'error');
    }
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return (email ?? 'AG').slice(0, 2).toUpperCase();
  };

  const isLoading = isLoadingMembers || isLoadingInvites;

  const workspaceOwner = members.find((m) => m.role === 'owner');
  const ownerName = workspaceOwner?.profile?.full_name ?? workspaceOwner?.profile?.email ?? 'another user';

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {t('settings.team.badge') || 'TEAM'}
          </p>
          <h1 className="mt-3 font-headline text-[2.15rem] font-bold tracking-tight text-on-surface sm:text-[2.45rem]">
            {t('settings.team.title') || 'Team'}
          </h1>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">
            {t('settings.team.description') || 'Manage your workspace members and invitations.'}
          </p>
        </div>
        {canManageTeam && (
          <button
            onClick={() => {
              setIsInviteModalOpen(true);
              setLastInviteLink(null);
            }}
            className="rounded-full bg-on-surface px-5 py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90"
          >
            {t('settings.team.invite') || 'Invite member'}
          </button>
        )}
      </div>

      {/* Guest Context Banner */}
      {membership.role !== 'owner' && (
        <div className="mb-8 flex items-start gap-4 rounded-[1.4rem] border border-amber-500/20 bg-amber-500/5 px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-on-surface">
              {t('settings.team.guestBannerTitle') || 'Guest Access'}
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              {(t('settings.team.guestBannerText') || `You are participating in this workspace as a {role}. This workspace is owned by {owner}.`)
                .replace('{role}', membership.role.toUpperCase())
                .replace('{owner}', ownerName)}
            </p>
          </div>
        </div>
      )}

      {/* Incoming Invites Banner */}
      {incomingInvites.length > 0 && (
        <div className="mb-8 space-y-3">
          {incomingInvites.map((invite) => (
            <div key={invite.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-[1.4rem] border border-primary/20 bg-primary/5 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-on-surface">
                    {t('settings.team.incomingInviteTitle') || 'You have been invited to join a workspace!'}
                  </h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    <span className="font-semibold text-on-surface">{invite.inviter?.full_name ?? invite.inviter?.email ?? 'Someone'}</span>{' '}
                    {t('settings.team.incomingInviteText') || 'invited you to join'}{' '}
                    <span className="font-semibold text-on-surface">{invite.workspace.name}</span>.
                  </p>
                </div>
              </div>
              <div className="flex w-full sm:w-auto items-center gap-3">
                <button
                  onClick={() => handleDeclineIncoming(invite.token)}
                  className="flex-1 sm:flex-none rounded-full border border-error/20 px-4 py-2 text-sm font-semibold text-error transition-colors hover:bg-error/10"
                >
                  {t('common.decline') || 'Decline'}
                </button>
                <button
                  onClick={() => window.location.href = `/invite/accept?token=${invite.token}`}
                  className="flex-1 sm:flex-none rounded-full bg-primary px-5 py-2 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90"
                >
                  {t('common.accept') || 'Accept'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Members Table */}
      <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest overflow-hidden shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-outline-variant/20 border-t-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/10">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    {t('common.member') || 'Member'}
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    {t('common.role') || 'Role'}
                  </th>
                  <th className="px-6 py-4 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {members.map((member) => {
                  const isSelf = member.user_id === user.id;
                  const isOwner = member.role === 'owner';
                  const canRemove = canManageTeam && !isOwner && !isSelf;

                  return (
                    <tr key={member.id} className="group hover:bg-surface-container/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-bold text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            {getInitials(member.profile.full_name, member.profile.email)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-on-surface">
                              {member.profile.full_name ?? member.profile.email ?? 'Unknown'}
                              {isSelf && (
                                <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-primary">
                                  {t('common.you') || 'you'}
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-on-surface-variant">
                              {member.profile.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                            member.role === 'owner'
                              ? 'bg-primary/10 text-primary'
                              : member.role === 'admin'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-surface-container-high text-on-surface-variant'
                          }`}
                        >
                          {t(`roles.${member.role}Lower`) || member.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {canRemove && (
                          <button
                            onClick={() => handleRemoveMember(member.id, member.profile.full_name ?? member.profile.email ?? '')}
                            disabled={removingMemberId === member.id}
                            className="text-xs font-semibold text-error/70 hover:text-error transition-colors disabled:opacity-50"
                          >
                            {removingMemberId === member.id
                              ? (t('common.removing') || 'Removing...')
                              : (t('common.remove') || 'Remove')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
            {t('settings.team.pendingInvites') || 'Pending Invites'}
          </h2>
          <div className="space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-5 py-4 transition-colors hover:bg-surface-container-low"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-on-surface">{invite.email}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                      {t('settings.team.pending') || 'Pending'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canManageTeam && (
                    <>
                      <button
                        onClick={() => {
                          const link = `${window.location.origin}/invite/accept?token=${invite.token}`;
                          copyToClipboard(link);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                        title={t('common.copyLink') || 'Copy invite link'}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRevokeInvite(invite.id)}
                        disabled={revokingInviteId === invite.id}
                        className="text-xs font-semibold text-error/70 hover:text-error transition-colors disabled:opacity-50"
                      >
                        {revokingInviteId === invite.id
                          ? (t('common.revoking') || 'Revoking...')
                          : (t('common.revoke') || 'Revoke')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-outline-variant/20 bg-surface-container-lowest p-8 shadow-[0_32px_80px_rgba(15,23,42,0.15)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
                {t('settings.team.inviteTitle') || 'Invite a team member'}
              </h2>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/15 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-on-surface-variant mb-6">
              {t('settings.team.inviteDescription') ||
                'They will receive full admin access to this workspace.'}
            </p>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                {t('common.email') || 'Email'}
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inviteEmail.trim() && !isInviting) {
                    handleSendInvite();
                  }
                }}
                placeholder="colleague@company.com"
                className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-3 text-sm outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                autoFocus
              />
            </div>

            {/* Show last invite link for copy */}
            {lastInviteLink && (
              <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-outline-variant/15 bg-surface-container p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {t('settings.team.inviteLinkLabel') || 'Invite Link (copy & share)'}
                </p>
                <div className="group relative flex items-center overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
                  <div className="flex-1 overflow-x-auto whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant scrollbar-hide">
                    {lastInviteLink}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 flex items-center bg-gradient-to-l from-surface-container-lowest via-surface-container-lowest to-transparent pl-8 pr-1.5">
                    <button
                      onClick={() => copyToClipboard(lastInviteLink)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface transition-all hover:bg-primary/10 hover:text-primary active:scale-95"
                      title={t('common.copyLink') || 'Copy link'}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="flex-1 rounded-full border border-outline-variant/20 px-4 py-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleSendInvite}
                disabled={!inviteEmail.trim() || isInviting}
                className="flex-1 rounded-full bg-on-surface px-4 py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isInviting
                  ? (t('settings.team.sending') || 'Sending...')
                  : (t('settings.team.sendInvite') || 'Send Invite')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
