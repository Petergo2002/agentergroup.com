'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/components/app/AppContext';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { LogOut, ChevronsUpDown, Check, Plus, Building2, Settings } from 'lucide-react';
import { CreateWorkspaceModal } from '@/components/modals/CreateWorkspaceModal';
import {
  canCreateWorkspace,
  getOwnedWorkspaceCount,
  getWorkspaceLimitForPlan,
} from '@/lib/workspace-limits';
import { SELF_SERVE_BILLING_ENABLED } from '@/lib/billing-mode';
import { useToast } from '@/components/ui/ToastProvider';

interface WorkspaceSwitcherProps {
  isCollapsed: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}

export function WorkspaceSwitcher({ isCollapsed, mobile, onNavigate }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const { workspace, workspaces, membership, subscription, user } = useAppContext();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userEmail = user?.email;
  const initials = userEmail?.slice(0, 2).toUpperCase() ?? 'AG';

  // Format array to ensure it's not nested incorrectly due to joins
  const availableWorkspaces = Array.isArray(workspaces) ? workspaces : [];
  const ownedWorkspaceCount = getOwnedWorkspaceCount(availableWorkspaces);
  const workspaceLimit = getWorkspaceLimitForPlan(subscription?.plan_tier);
  const hasWorkspaceCapacity = canCreateWorkspace({
    plan: subscription?.plan_tier,
    ownedWorkspaceCount,
  });
  const createWorkspaceLimitLabel =
    subscription?.plan_tier === 'premium'
      ? `Premium allows up to ${workspaceLimit} workspaces.`
      : SELF_SERVE_BILLING_ENABLED
        ? 'Upgrade to Premium to create more workspaces.'
        : 'Contact your account manager to increase the workspace limit.';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    setIsSwitching(false);
  }, [workspace.id]);

  const handleSwitchWorkspace = async (targetWorkspaceId: string) => {
    if (targetWorkspaceId === workspace.id || isSwitching) return;
    
    setIsSwitching(true);
    setIsOpen(false);

    try {
      const response = await fetch('/api/workspaces/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: targetWorkspaceId }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to switch workspace.');
      }

      onNavigate?.();
      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to switch workspace.',
        'error',
      );
      setIsSwitching(false);
    }
  };

  const isMinimized = isCollapsed && !mobile;

  return (
    <div className={`relative w-full ${isMinimized ? 'flex justify-center' : ''}`} ref={dropdownRef}>
      {/* Switcher Button */}
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`depth-button group flex items-center gap-2.5 rounded-xl border border-outline-variant/10 bg-surface-container-lowest transition-all duration-200 active:scale-[0.98] hover:border-primary/15 hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          isOpen ? 'border-primary/20 bg-surface-container-low' : ''
        } ${isMinimized ? 'h-12 w-12 justify-center p-0' : 'w-full px-2 py-2'}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        disabled={isSwitching}
      >
        <div className={`flex shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-tr from-primary via-primary/95 to-orange-400 text-xs font-bold text-white shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:shadow-primary/10 ${isMinimized ? 'h-9 w-9 text-[10px]' : 'h-8 w-8'}`}>
          {isSwitching ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          ) : (
            initials
          )}
        </div>
        
        {!isMinimized && (
          <>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-[13px] font-semibold text-on-surface">
                {userEmail ?? t('nav.workspace')}
              </p>
              <div className="mt-0.5 inline-flex rounded-md bg-surface-container-high px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
                {t(`roles.${membership.role}Lower`) || membership.role}
              </div>
            </div>
            <ChevronsUpDown className={`h-4 w-4 shrink-0 text-on-surface-variant transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : 'rotate-0 group-hover:text-on-surface'}`} />
          </>
        )}
      </button>

      {/* Tooltip for collapsed mode */}
      {isMinimized && !isOpen && (
        <div className="fixed left-[70px] z-[9999] pointer-events-none whitespace-nowrap rounded-md bg-on-surface px-3 py-2 text-xs font-bold text-background opacity-0 shadow-xl ring-1 ring-outline-variant transition-opacity duration-200 group-hover:opacity-100">
          {userEmail ?? t('nav.workspace')}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`depth-panel absolute bottom-full z-50 mb-2 w-[280px] overflow-hidden rounded-2xl solid-panel p-2 animate-in fade-in slide-in-from-bottom-2 zoom-in-95 duration-200 ease-out origin-bottom-left ${
            isMinimized ? 'left-full ml-4 bottom-0 origin-bottom-left' : 'left-0'
          }`}
        >
          <div className="px-2 pb-1.5 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/60">
              {t('nav.switchWorkspace') || 'Switch Workspace'}
            </p>
          </div>
          
          <div className="max-h-[240px] overflow-y-auto overflow-x-hidden scrollbar-hide">
            {availableWorkspaces.map((wsItem) => {
              const ws = wsItem.workspace;
              const isActive = ws.id === workspace.id;
              
              return (
                <button type="button"
                  key={ws.id}
                  onClick={() => handleSwitchWorkspace(ws.id)}
                  disabled={isActive || isSwitching}
                  className={`depth-nav-item group/ws-item flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    isActive
                      ? 'depth-nav-item-active border-primary/20 border-l-2 border-l-primary bg-primary/[0.08] text-primary shadow-xs'
                      : 'border-transparent text-on-surface-variant hover:border-outline-variant/12 hover:bg-on-surface/[0.04] hover:text-on-surface'
                  }`}
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${isActive ? 'bg-primary/15' : 'bg-surface-container-high group-hover/ws-item:bg-surface-container-highest'}`}>
                    <Building2 className={`h-3.5 w-3.5 transition-transform duration-200 ${isActive ? 'text-primary' : 'text-on-surface-variant group-hover/ws-item:text-on-surface'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[13px] transition-all duration-200 ${isActive ? 'font-bold' : 'font-medium'}`}>{ws.name}</p>
                  </div>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary uppercase tracking-wider">
                      <Check className="h-3 w-3 shrink-0 text-primary animate-in zoom-in-75 duration-300" />
                      Active
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="my-1 h-px w-full bg-outline-variant/10" />

          {/* Settings Section */}
          <Link
            href="/settings"
            onClick={() => {
              setIsOpen(false);
              onNavigate?.();
            }}
            className="depth-nav-item group/settings flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 text-left text-[13px] font-medium text-on-surface-variant transition-all duration-200 active:scale-[0.98] hover:border-outline-variant/12 hover:bg-on-surface/[0.04] hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Settings className="h-4 w-4 text-on-surface-variant transition-transform duration-300 group-hover/settings:rotate-45 group-hover/settings:text-on-surface" />
            <span>{t('nav.settings') || 'Settings'}</span>
          </Link>

          {/* Create New Workspace */}
          <button type="button"
            onClick={() => {
              setIsOpen(false);
              if (hasWorkspaceCapacity) {
                setIsCreateModalOpen(true);
              } else if (
                SELF_SERVE_BILLING_ENABLED &&
                subscription?.plan_tier !== 'premium'
              ) {
                router.push('/settings/billing');
              }
            }}
            disabled={
              !hasWorkspaceCapacity &&
              (!SELF_SERVE_BILLING_ENABLED || subscription?.plan_tier === 'premium')
            }
            title={!hasWorkspaceCapacity ? createWorkspaceLimitLabel : undefined}
            className={`depth-nav-item group/create flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 text-left text-[13px] font-medium transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              hasWorkspaceCapacity
                ? 'text-on-surface-variant hover:border-outline-variant/12 hover:bg-on-surface/[0.04] hover:text-on-surface'
                : !SELF_SERVE_BILLING_ENABLED || subscription?.plan_tier === 'premium'
                  ? 'cursor-not-allowed text-on-surface-variant/50'
                  : 'text-primary hover:bg-primary/10 hover:text-primary'
            }`}
          >
            <Plus className={`h-4 w-4 transition-transform duration-300 ${hasWorkspaceCapacity ? 'text-on-surface-variant group-hover/create:rotate-90 group-hover/create:text-on-surface' : 'text-current group-hover/create:rotate-90'}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate">
                {hasWorkspaceCapacity
                  ? t('nav.createWorkspace') || 'Create workspace'
                  : !SELF_SERVE_BILLING_ENABLED || subscription?.plan_tier === 'premium'
                    ? t('nav.workspaceLimitReached') || 'Workspace limit reached'
                    : t('nav.upgradeForWorkspaces') || 'Upgrade for more workspaces'}
              </span>
              {!hasWorkspaceCapacity && (
                <span className="mt-0.5 block truncate text-[10px] font-medium text-on-surface-variant/60">
                  {ownedWorkspaceCount}/{workspaceLimit} workspaces
                </span>
              )}
            </span>
          </button>

          {/* Sign Out */}
          <form action="/auth/logout" method="post" className="w-full">
            <button
              type="submit"
              className="depth-nav-item group/logout flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 text-left text-[13px] font-medium text-on-surface-variant transition-all duration-200 active:scale-[0.98] hover:border-error/15 hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <LogOut className="h-4 w-4 text-on-surface-variant transition-colors duration-200 group-hover/logout:text-error" />
              <span className="transition-colors duration-200">{t('nav.signOut') || 'Sign out'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />
    </div>
  );
}
