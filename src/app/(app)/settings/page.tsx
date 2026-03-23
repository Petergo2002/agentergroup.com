'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAppContext } from '@/components/app/AppContext';
import { useToast } from '@/components/ui/ToastProvider';
import { createClient } from '@/lib/supabase/client';
import type { PrivacySubjectLookupResponse } from '@/lib/types';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { profile, user, workspace, membership, workspaces } = useAppContext();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(profile.full_name ?? '');
  const [companyName, setCompanyName] = useState(workspace.name);
  const [workspaceDescription, setWorkspaceDescription] = useState(
    workspace.description ?? '',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
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
          throw new Error(workspacePayload?.error ?? 'Failed to save company settings.');
        }
      }

      router.refresh();
      showToast('Settings saved.', 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save settings.';
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (membership.role !== 'owner') {
      showToast('Only workspace owners can delete a workspace.', 'error');
      return;
    }

    if (workspaces.length <= 1) {
      showToast('You must keep at least one workspace.', 'error');
      return;
    }

    const confirmation = window.prompt(
      `Type "${workspace.name}" to permanently delete this workspace.`,
    );

    if (confirmation !== workspace.name) {
      if (confirmation !== null) {
        showToast('Workspace name did not match.', 'error');
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
        throw new Error(payload.error ?? 'Failed to delete workspace.');
      }

      showToast('Workspace deleted.', 'success');
      window.location.assign('/dashboard');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete workspace.';
      showToast(message, 'error');
    } finally {
      setIsDeletingWorkspace(false);
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
        throw new Error(payload?.error ?? 'Failed to preview subject data.');
      }

      setPrivacyLookupResult(payload as PrivacySubjectLookupResponse);
      showToast('Subject data preview loaded.', 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to preview subject data.';
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
        throw new Error(payload?.error ?? 'Failed to export subject data.');
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

      showToast('Subject data export downloaded.', 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to export subject data.';
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
        throw new Error(payload?.error ?? 'Failed to delete subject data.');
      }

      setPrivacyLookupResult(null);
      setPrivacyRequestReference('');
      setPrivacyDeleteConfirmation('');
      setIncludeTranscriptMatches(false);
      showToast('Subject data deleted.', 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete subject data.';
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
            Profile and workspace
          </p>
          <h1 className="mt-3 font-headline text-[2.15rem] font-bold tracking-tight text-on-surface sm:text-[2.45rem]">
            Settings
          </h1>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">
            Manage your personal profile and workspace settings.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-full bg-on-surface px-5 py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-6">
        <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            Profile
          </p>
          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                Full Name
              </label>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-3 text-sm outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                Company Name
              </label>
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                disabled={!canEditWorkspace}
                className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:text-on-surface-variant"
              />
              <p className="mt-2 text-xs text-on-surface-variant">
                This name is the current workspace name and is used as your company name in the app.
              </p>
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                Email
              </label>
              <input
                readOnly
                value={user.email ?? ''}
                className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-3 text-sm text-on-surface-variant outline-none"
              />
            </div>
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            Active Workspace
          </p>
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-4">
              <div className="grid gap-5">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    Workspace Slug
                  </label>
                  <input
                    readOnly
                    value={workspace.slug}
                    className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm text-on-surface-variant outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    Workspace Description
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
                  {membership.role} access · {canEditWorkspace ? 'Can edit company settings' : 'View only'}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-error/15 bg-error/5 px-4 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-on-surface">Delete workspace</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    This permanently removes the workspace and all agents, knowledge, connections,
                    chats, and runs inside it.
                  </p>
                </div>
                <button
                  onClick={handleDeleteWorkspace}
                  disabled={
                    isDeletingWorkspace || membership.role !== 'owner' || workspaces.length <= 1
                  }
                  className="rounded-2xl border border-error/20 bg-background px-4 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeletingWorkspace ? 'Deleting...' : 'Delete workspace'}
                </button>
              </div>
              <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">
                {membership.role !== 'owner'
                  ? 'Owner access required'
                  : workspaces.length <= 1
                    ? 'Create another workspace before deleting this one'
                    : 'Permanent action'}
              </div>
            </div>
          </div>
        </div>

        {canManagePrivacy ? (
          <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              Privacy &amp; Compliance
            </p>
            <div className="mt-6 space-y-6">
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">Retention</p>
                    <p className="mt-1 text-xs leading-6 text-on-surface-variant">
                      Widget sessions, widget messages, and widget leads are removed after 180 days.
                      Imported knowledge stays in place until your workspace deletes it manually.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <a
                      href="/privacy-policy"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-outline-variant/15 bg-background px-3 py-1.5 text-on-surface-variant transition-colors hover:text-on-surface"
                    >
                      Privacy policy
                    </a>
                    <a
                      href="/subprocessors"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-outline-variant/15 bg-background px-3 py-1.5 text-on-surface-variant transition-colors hover:text-on-surface"
                    >
                      Subprocessors
                    </a>
                    <a
                      href="/data-processing"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-outline-variant/15 bg-background px-3 py-1.5 text-on-surface-variant transition-colors hover:text-on-surface"
                    >
                      Data processing
                    </a>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container px-4 py-4">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-on-surface">Subject data requests</p>
                  <p className="text-xs leading-6 text-on-surface-variant">
                    Use one exact identifier at a time. Email is the primary path. Session ID is the
                    fallback for anonymous support cases.
                  </p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      Exact email
                    </label>
                    <input
                      value={privacyEmail}
                      onChange={(event) => setPrivacyEmail(event.target.value)}
                      placeholder="person@example.com"
                      className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      Exact session ID
                    </label>
                    <input
                      value={privacySessionId}
                      onChange={(event) => setPrivacySessionId(event.target.value)}
                      placeholder="session_123"
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
                    {isLookingUpPrivacyData ? 'Loading…' : 'Preview data'}
                  </button>
                  <button
                    onClick={handlePrivacyExport}
                    disabled={isExportingPrivacyData}
                    className="rounded-2xl border border-outline-variant/20 bg-background px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
                  >
                    {isExportingPrivacyData ? 'Exporting…' : 'Export JSON'}
                  </button>
                </div>

                {privacyLookupResult ? (
                  <div className="mt-6 space-y-5">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">Leads</p>
                        <p className="mt-2 text-xl font-semibold text-on-surface">
                          {privacyLookupResult.summary.leadCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">Sessions</p>
                        <p className="mt-2 text-xl font-semibold text-on-surface">
                          {privacyLookupResult.summary.sessionCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">Messages</p>
                        <p className="mt-2 text-xl font-semibold text-on-surface">
                          {privacyLookupResult.summary.messageCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">Transcript matches</p>
                        <p className="mt-2 text-xl font-semibold text-on-surface">
                          {privacyLookupResult.summary.transcriptMatchSessionCount}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-4">
                        <p className="text-sm font-semibold text-on-surface">Exact lead matches</p>
                        <div className="mt-3 space-y-3 text-sm text-on-surface-variant">
                          {privacyLookupResult.leadMatches.length === 0 ? (
                            <p>No exact lead rows matched.</p>
                          ) : (
                            privacyLookupResult.leadMatches.map((lead) => (
                              <div key={lead.id} className="rounded-xl border border-outline-variant/10 bg-surface-container px-3 py-3">
                                <p className="font-medium text-on-surface">{lead.name}</p>
                                <p className="mt-1 break-all">{lead.email}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em]">
                                  {lead.widgetName ?? 'Unknown widget'}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-4">
                        <p className="text-sm font-semibold text-on-surface">Structured session matches</p>
                        <div className="mt-3 space-y-3 text-sm text-on-surface-variant">
                          {privacyLookupResult.sessionMatches.length === 0 ? (
                            <p>No exact session rows matched.</p>
                          ) : (
                            privacyLookupResult.sessionMatches.map((session) => (
                              <div key={session.widgetSessionId} className="rounded-xl border border-outline-variant/10 bg-surface-container px-3 py-3">
                                <p className="font-medium text-on-surface">{session.sessionId}</p>
                                <p className="mt-1">
                                  {session.widgetName ?? 'Unknown widget'} · {session.messageCount} messages
                                </p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em]">
                                  {session.matchSource === 'session_id' ? 'Direct session match' : 'Linked from lead'}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-outline-variant/10 bg-background px-4 py-4">
                        <p className="text-sm font-semibold text-on-surface">Transcript-only matches</p>
                        <div className="mt-3 space-y-3 text-sm text-on-surface-variant">
                          {privacyLookupResult.transcriptMatches.length === 0 ? (
                            <p>No transcript-only matches found.</p>
                          ) : (
                            privacyLookupResult.transcriptMatches.map((session) => (
                              <div key={session.widgetSessionId} className="rounded-xl border border-outline-variant/10 bg-surface-container px-3 py-3">
                                <p className="font-medium text-on-surface">{session.sessionId}</p>
                                <p className="mt-1">
                                  {session.widgetName ?? 'Unknown widget'} · {session.messageCount} messages
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
                          <p className="text-sm font-semibold text-on-surface">Delete matched data</p>
                          <p className="mt-1 text-xs leading-6 text-on-surface-variant">
                            This is permanent. Email deletion removes exact lead rows by default. Transcript-only
                            sessions are only deleted if you explicitly include them.
                          </p>
                          <label className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant">
                            <input
                              type="checkbox"
                              checked={includeTranscriptMatches}
                              onChange={(event) => setIncludeTranscriptMatches(event.target.checked)}
                              className="h-4 w-4 rounded border-outline-variant/30"
                            />
                            Include transcript-only session matches
                          </label>
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                            Request reference
                          </label>
                          <input
                            value={privacyRequestReference}
                            onChange={(event) => setPrivacyRequestReference(event.target.value)}
                            placeholder="ticket-123"
                            className="w-full rounded-2xl border border-outline-variant/10 bg-background px-4 py-3 text-sm outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                            Type DELETE
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
                            {isDeletingPrivacyData ? 'Deleting…' : 'Delete data'}
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
