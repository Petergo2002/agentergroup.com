'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAppContext } from '@/components/app/AppContext';
import { useToast } from '@/components/ui/ToastProvider';
import { createClient } from '@/lib/supabase/client';

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
  const canEditWorkspace =
    membership.role === 'owner' || membership.role === 'admin';

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
      </div>
    </div>
  );
}
