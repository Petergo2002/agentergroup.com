'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAppContext } from '@/components/app/AppContext';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useToast } from '@/components/ui/ToastProvider';
import type { PlatformLanguage } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import type { PrivacySubjectLookupResponse } from '@/lib/types';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { profile, user, workspace, membership, workspaces } = useAppContext();
  const { language, setLanguage, t } = useLanguage();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(profile.full_name ?? '');
  const [companyName, setCompanyName] = useState(workspace.name);
  const [workspaceDescription, setWorkspaceDescription] = useState(
    workspace.description ?? '',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [privacyEmail, setPrivacyEmail] = useState('');
  const [privacySessionId, setPrivacySessionId] = useState('');
  const [privacyLookupResult, setPrivacyLookupResult] =
    useState<PrivacySubjectLookupResponse | null>(null);
  const [privacyRequestReference, setPrivacyRequestReference] = useState('');
  const [privacyDeleteConfirmation, setPrivacyDeleteConfirmation] = useState('');
  const [includeTranscriptMatches, setIncludeTranscriptMatches] = useState(false);
  const [isLookingUpPrivacyData, setIsLookingUpPrivacyData] = useState(false);
  const [isExportingPrivacyData, setIsExportingPrivacyData] = useState(false);
  const [isDeletingPrivacyData, setIsDeletingPrivacyData] = useState(false);
  const canEditWorkspace =
    membership.role === 'owner' || membership.role === 'admin';
  const canManagePrivacy = membership.role === 'owner';
  const roleLabel = t(`roles.${membership.role}Lower`);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const profilePromise = supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          email: user.email,
        })
        .eq('id', user.id);

      const workspacePromise = canEditWorkspace
        ? fetch(`/api/workspaces/${workspace.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: companyName.trim(),
              description: workspaceDescription.trim(),
            }),
          })
        : null;

      const [profileResult, workspaceResponse] = await Promise.all([
        profilePromise,
        workspacePromise,
      ]);

      if (profileResult.error) {
        throw profileResult.error;
      }

      if (workspaceResponse) {
        const workspacePayload = await workspaceResponse.json().catch(() => null);

        if (!workspaceResponse.ok) {
          throw new Error(workspacePayload?.error ?? t('settings.saveError'));
        }
      }

      router.refresh();
      showToast(t('settings.saved'), 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('settings.saveError');
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (membership.role !== 'owner') {
      showToast(t('settings.ownerDeleteOnly'), 'error');
      return;
    }

    if (workspaces.length <= 1) {
      showToast(t('settings.mustKeepOneWorkspace'), 'error');
      return;
    }

    const confirmation = window.prompt(
      t('settings.deletePrompt', { name: workspace.name }),
    );

    if (confirmation !== workspace.name) {
      if (confirmation !== null) {
        showToast(t('settings.workspaceNameMismatch'), 'error');
      }
      return;
    }

    setIsDeletingWorkspace(true);

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'DELETE',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t('settings.deleteWorkspaceError'));
      }

      showToast(t('settings.workspaceDeleted'), 'success');
      window.location.assign('/dashboard');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('settings.deleteWorkspaceError');
      showToast(message, 'error');
    } finally {
      setIsDeletingWorkspace(false);
    }
  };

  // Sends a password reset email to the currently logged-in user
  const handleResetPassword = async () => {
    if (!user.email) return;
    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
      });
      if (error) throw error;
      showToast('Password reset email sent — check your inbox.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send reset email.';
      showToast(message, 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Sends email change confirmation to both the old and new email addresses
  const handleChangeEmail = async () => {
    if (!newEmail.trim() || newEmail === user.email) return;
    setIsChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: newEmail.trim() },
        { emailRedirectTo: `${window.location.origin}/auth/callback?next=/settings` }
      );
      if (error) throw error;
      showToast('Verification emails sent to both addresses. Please confirm to finalize the change.', 'success');
      setNewEmail('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send email change confirmation.';
      showToast(message, 'error');
    } finally {
      setIsChangingEmail(false);
    }
  };

  const buildPrivacyRequestPayload = () => ({
    ...(privacyEmail.trim() ? { email: privacyEmail.trim() } : {}),
    ...(privacySessionId.trim() ? { sessionId: privacySessionId.trim() } : {}),
  });

  const handlePrivacyLookup = async () => {
    setIsLookingUpPrivacyData(true);

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/privacy/dsar/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildPrivacyRequestPayload()),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? t('settings.privacyLookupError'));
      }

      setPrivacyLookupResult(payload as PrivacySubjectLookupResponse);
      showToast(t('settings.privacyLookupLoaded'), 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('settings.privacyLookupError');
      showToast(message, 'error');
    } finally {
      setIsLookingUpPrivacyData(false);
    }
  };

  const handlePrivacyExport = async () => {
    setIsExportingPrivacyData(true);

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/privacy/dsar/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildPrivacyRequestPayload()),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? t('settings.privacyExportError'));
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers.get('content-disposition') ?? '';
      const filenameMatch = contentDisposition.match(/filename=\"?([^\"]+)\"?/i);
      const filename = filenameMatch?.[1] ?? 'privacy-export.json';
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      showToast(t('settings.privacyExportDownloaded'), 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('settings.privacyExportError');
      showToast(message, 'error');
    } finally {
      setIsExportingPrivacyData(false);
    }
  };

  const handlePrivacyDelete = async () => {
    setIsDeletingPrivacyData(true);

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/privacy/dsar/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...buildPrivacyRequestPayload(),
          includeTranscriptMatches,
          requestReference: privacyRequestReference.trim(),
          confirmation: privacyDeleteConfirmation.trim(),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? t('settings.privacyDeleteError'));
      }

      setPrivacyLookupResult(null);
      setPrivacyRequestReference('');
      setPrivacyDeleteConfirmation('');
      setIncludeTranscriptMatches(false);
      showToast(t('settings.privacyDeleted'), 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('settings.privacyDeleteError');
      showToast(message, 'error');
    } finally {
      setIsDeletingPrivacyData(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {t('settings.badge')}
          </p>
          <h1 className="mt-3 font-headline text-[2.15rem] font-bold tracking-tight text-on-surface sm:text-[2.45rem]">
            {t('settings.title')}
          </h1>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">
            {t('settings.description')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-full bg-on-surface px-5 py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90"
        >
          {isSaving ? t('common.saving') : t('common.saveChanges')}
        </button>
      </div>

      <div className="space-y-6">
        <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {t('settings.profile')}
          </p>
          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                {t('settings.fullName')}
              </label>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-3 text-sm outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                {t('settings.companyName')}
              </label>
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                disabled={!canEditWorkspace}
                className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:text-on-surface-variant"
              />
              <p className="mt-2 text-xs text-on-surface-variant">
                {t('settings.companyNameHelp')}
              </p>
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                {t('common.email')}
              </label>
              <input
                readOnly
                value={user.email ?? ''}
                className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-3 text-sm text-on-surface-variant outline-none"
              />
            </div>
          </div>
        </div>

        {/* ── Security ─────────────────────────────────────────────── */}
        <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            Security
          </p>
          <div className="mt-6 space-y-4">
            {/* Email Address Change */}
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-on-surface">Email Address</p>
                  <p className="mt-1 text-xs text-on-surface-variant max-w-sm">
                    Update your email address. You will need to confirm the change from both your old and new email addresses.
                  </p>
                  <div className="mt-3">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder={user.email ?? 'New email address'}
                      className="w-full max-w-sm rounded-xl border border-outline-variant/10 bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                </div>
                <button
                  onClick={handleChangeEmail}
                  disabled={isChangingEmail || !newEmail.trim() || newEmail === user.email}
                  className="mt-4 shrink-0 rounded-2xl border border-outline-variant/20 bg-background px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0"
                >
                  {isChangingEmail ? 'Sending…' : 'Update Email'}
                </button>
              </div>
            </div>

            {/* Password Reset */}
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-on-surface">Password</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Send a reset link to <strong>{user.email}</strong> to change your password.
                  </p>
                </div>
                <button
                  onClick={handleResetPassword}
                  disabled={isResettingPassword}
                  className="shrink-0 rounded-2xl border border-outline-variant/20 bg-background px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isResettingPassword ? 'Sending…' : 'Send Reset Email'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {t('settings.languageSection')}
          </p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                {t('common.language')}
              </label>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as PlatformLanguage)}
                className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-3 text-sm outline-none"
              >
                <option value="en">{t('common.english')}</option>
                <option value="sv">{t('common.swedish')}</option>
              </select>
            </div>
            <p className="text-sm leading-7 text-on-surface-variant">
              {t('settings.languageDescription')}
            </p>
            <p className="text-xs text-on-surface-variant">
              {t('settings.languageHelp')}
            </p>
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {t('settings.activeWorkspace')}
          </p>
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-4">
              <div className="grid gap-5">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    {t('settings.workspaceSlug')}
                  </label>
                  <input
                    readOnly
                    value={workspace.slug}
                    className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm text-on-surface-variant outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    {t('settings.workspaceDescription')}
                  </label>
                  <textarea
                    value={workspaceDescription}
                    onChange={(event) => setWorkspaceDescription(event.target.value)}
                    disabled={!canEditWorkspace}
                    rows={3}
                    className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:text-on-surface-variant"
                  />
                </div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">
                  {canEditWorkspace
                    ? t('settings.accessCanEdit', { role: roleLabel })
                    : t('settings.accessViewOnly', { role: roleLabel })}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-error/15 bg-error/5 px-4 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-on-surface">{t('settings.deleteWorkspace')}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {t('settings.deleteWorkspaceDescription')}
                  </p>
                </div>
                <button
                  onClick={handleDeleteWorkspace}
                  disabled={
                    isDeletingWorkspace || membership.role !== 'owner' || workspaces.length <= 1
                  }
                  className="rounded-2xl border border-error/20 bg-background px-4 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeletingWorkspace ? t('common.deleting') : t('settings.deleteWorkspace')}
                </button>
              </div>
              <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">
                {membership.role !== 'owner'
                  ? t('settings.ownerRequired')
                  : workspaces.length <= 1
                    ? t('settings.createAnotherBeforeDelete')
                    : t('settings.permanentAction')}
              </div>
            </div>
          </div>
        </div>

        {canManagePrivacy ? (
          <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              {t('settings.privacyCompliance')}
            </p>
            <div className="mt-6 space-y-6">
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{t('settings.retention')}</p>
                    <p className="mt-1 text-xs leading-6 text-on-surface-variant">
                      {t('settings.retentionDescription')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <a
                      href="/privacy-policy"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-outline-variant/15 bg-background px-3 py-1.5 text-on-surface-variant transition-colors hover:text-on-surface"
                    >
                      {t('settings.privacyPolicy')}
                    </a>
                    <a
                      href="/settings/subprocessors"
                      className="rounded-full border border-outline-variant/15 bg-background px-3 py-1.5 text-on-surface-variant transition-colors hover:text-on-surface"
                    >
                      {t('settings.subprocessors')}
                    </a>
                    <a
                      href="/settings/data-processing"
                      className="rounded-full border border-outline-variant/15 bg-background px-3 py-1.5 text-on-surface-variant transition-colors hover:text-on-surface"
                    >
                      {t('settings.dataProcessing')}
                    </a>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-4">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-on-surface">{t('settings.subjectRequests')}</p>
                  <p className="text-xs leading-6 text-on-surface-variant">
                    {t('settings.subjectRequestDescription')}
                  </p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      {t('settings.exactEmail')}
                    </label>
                    <input
                      value={privacyEmail}
                      onChange={(event) => setPrivacyEmail(event.target.value)}
                      placeholder={t('settings.privacyEmailPlaceholder')}
                      className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      {t('settings.exactSessionId')}
                    </label>
                    <input
                      value={privacySessionId}
                      onChange={(event) => setPrivacySessionId(event.target.value)}
                      placeholder={t('settings.privacySessionPlaceholder')}
                      className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={handlePrivacyLookup}
                    disabled={isLookingUpPrivacyData}
                    className="rounded-2xl bg-on-surface px-4 py-2.5 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {isLookingUpPrivacyData ? t('common.loading') : t('settings.previewData')}
                  </button>
                  <button
                    onClick={handlePrivacyExport}
                    disabled={isExportingPrivacyData}
                    className="rounded-2xl border border-outline-variant/20 bg-background px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
                  >
                    {isExportingPrivacyData ? t('common.loading') : t('settings.exportJson')}
                  </button>
                </div>

                {privacyLookupResult ? (
                  <div className="mt-6 space-y-5">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">{t('settings.leads')}</p>
                        <p className="mt-2 text-xl font-semibold text-on-surface">
                          {privacyLookupResult.summary.leadCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">{t('settings.sessions')}</p>
                        <p className="mt-2 text-xl font-semibold text-on-surface">
                          {privacyLookupResult.summary.sessionCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">{t('settings.messages')}</p>
                        <p className="mt-2 text-xl font-semibold text-on-surface">
                          {privacyLookupResult.summary.messageCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">{t('settings.transcriptMatches')}</p>
                        <p className="mt-2 text-xl font-semibold text-on-surface">
                          {privacyLookupResult.summary.transcriptMatchSessionCount}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-4">
                        <p className="text-sm font-semibold text-on-surface">{t('settings.exactLeadMatches')}</p>
                        <div className="mt-3 space-y-3 text-sm text-on-surface-variant">
                          {privacyLookupResult.leadMatches.length === 0 ? (
                            <p>{t('settings.noExactLeadMatches')}</p>
                          ) : (
                            privacyLookupResult.leadMatches.map((lead) => (
                              <div key={lead.id} className="rounded-xl border border-outline-variant/10 bg-surface-container px-3 py-3">
                                <p className="font-medium text-on-surface">{lead.name}</p>
                                <p className="mt-1 break-all">
                                  {lead.email ?? lead.phone ?? "—"}
                                </p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em]">
                                  {lead.widgetName ?? t('common.unknownWidget')}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-4">
                        <p className="text-sm font-semibold text-on-surface">{t('settings.structuredSessionMatches')}</p>
                        <div className="mt-3 space-y-3 text-sm text-on-surface-variant">
                          {privacyLookupResult.sessionMatches.length === 0 ? (
                            <p>{t('settings.noExactSessionMatches')}</p>
                          ) : (
                            privacyLookupResult.sessionMatches.map((session) => (
                              <div key={session.widgetSessionId} className="rounded-xl border border-outline-variant/10 bg-surface-container px-3 py-3">
                                <p className="font-medium text-on-surface">{session.sessionId}</p>
                                <p className="mt-1">
                                  {session.widgetName ?? t('common.unknownWidget')} · {t('settings.messagesCount', { count: session.messageCount })}
                                </p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em]">
                                  {session.matchSource === 'session_id' ? t('settings.directSessionMatch') : t('settings.linkedFromLead')}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-4">
                        <p className="text-sm font-semibold text-on-surface">{t('settings.transcriptOnlyMatches')}</p>
                        <div className="mt-3 space-y-3 text-sm text-on-surface-variant">
                          {privacyLookupResult.transcriptMatches.length === 0 ? (
                            <p>{t('settings.noTranscriptMatches')}</p>
                          ) : (
                            privacyLookupResult.transcriptMatches.map((session) => (
                              <div key={session.widgetSessionId} className="rounded-xl border border-outline-variant/10 bg-surface-container px-3 py-3">
                                <p className="font-medium text-on-surface">{session.sessionId}</p>
                                <p className="mt-1">
                                  {session.widgetName ?? t('common.unknownWidget')} · {t('settings.messagesCount', { count: session.messageCount })}
                                </p>
                                {session.matchedSnippet ? (
                                  <p className="mt-2 text-xs leading-5">{session.matchedSnippet}</p>
                                ) : null}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-error/15 bg-error/5 px-4 py-4">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
                        <div>
                          <p className="text-sm font-semibold text-on-surface">{t('settings.deleteMatchedData')}</p>
                          <p className="mt-1 text-xs leading-6 text-on-surface-variant">
                            {t('settings.deleteMatchedDescription')}
                          </p>
                          <label className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant">
                            <input
                              type="checkbox"
                              checked={includeTranscriptMatches}
                              onChange={(event) => setIncludeTranscriptMatches(event.target.checked)}
                              className="h-4 w-4 rounded border-outline-variant/30"
                            />
                            {t('settings.includeTranscriptMatches')}
                          </label>
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                            {t('settings.requestReference')}
                          </label>
                          <input
                            value={privacyRequestReference}
                            onChange={(event) => setPrivacyRequestReference(event.target.value)}
                            placeholder={t('settings.requestReferencePlaceholder')}
                            className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                            {t('settings.typeDelete')}
                          </label>
                          <input
                            value={privacyDeleteConfirmation}
                            onChange={(event) => setPrivacyDeleteConfirmation(event.target.value)}
                            placeholder="DELETE"
                            className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={handlePrivacyDelete}
                            disabled={isDeletingPrivacyData}
                            className="rounded-2xl border border-error/20 bg-background px-4 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error/5 disabled:opacity-50"
                          >
                            {isDeletingPrivacyData ? t('common.deleting') : t('settings.deleteData')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
