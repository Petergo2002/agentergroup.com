'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/components/app/AppContext';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { LogOut, ChevronsUpDown, Check, Plus, Building2 } from 'lucide-react';
import { CreateWorkspaceModal } from '@/components/modals/CreateWorkspaceModal';

interface WorkspaceSwitcherProps {
  isCollapsed: boolean;
  mobile?: boolean;
}

export function WorkspaceSwitcher({ isCollapsed, mobile }: WorkspaceSwitcherProps) {
  const { workspace, workspaces, membership, user } = useAppContext();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userEmail = user?.email;
  const initials = userEmail?.slice(0, 2).toUpperCase() ?? 'AG';

  // Format array to ensure it's not nested incorrectly due to joins
  const availableWorkspaces = Array.isArray(workspaces) ? workspaces : [];

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

      if (response.ok) {
        // Force a hard reload to ensure all app contexts are completely fresh
        window.location.assign('/dashboard');
      } else {
        setIsSwitching(false);
      }
    } catch {
      setIsSwitching(false);
    }
  };

  const isMinimized = isCollapsed && !mobile;

  return (
    <div className={`relative w-full ${isMinimized ? 'flex justify-center' : ''}`} ref={dropdownRef}>
      {/* Switcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex w-full items-center gap-3 rounded-2xl bg-surface-container/55 p-3 ring-1 ring-transparent transition-all hover:bg-surface-container-high hover:ring-outline-variant ${
          isOpen ? 'bg-surface-container-high ring-outline-variant' : ''
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        disabled={isSwitching}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-bold text-on-surface-variant transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          {isSwitching ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          ) : (
            initials
          )}
        </div>
        
        {!isMinimized && (
          <>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-xs font-bold text-on-surface">
                {userEmail ?? t('nav.workspace')}
              </p>
              <div className="mt-1 inline-flex rounded-md bg-surface-container-high px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
                {t(`roles.${membership.role}Lower`) || membership.role}
              </div>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-on-surface-variant" />
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
          className={`absolute bottom-full z-50 mb-2 w-[280px] overflow-hidden rounded-[1.4rem] border border-outline-variant/20 bg-surface-container-lowest p-2 shadow-2xl ${
            isMinimized ? 'left-full ml-4 bottom-0' : 'left-0'
          }`}
        >
          <div className="px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {t('nav.switchWorkspace') || 'Switch Workspace'}
            </p>
          </div>
          
          <div className="max-h-[240px] overflow-y-auto overflow-x-hidden scrollbar-hide">
            {availableWorkspaces.map((wsItem) => {
              const ws = wsItem.workspace;
              const isActive = ws.id === workspace.id;
              
              return (
                <button
                  key={ws.id}
                  onClick={() => handleSwitchWorkspace(ws.id)}
                  disabled={isActive || isSwitching}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-primary/20' : 'bg-surface-container-high'}`}>
                    <Building2 className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-on-surface-variant'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{ws.name}</p>
                    <p className="truncate text-[10px] text-on-surface-variant">
                       {/* This could dynamically state their role in the other workspace if needed, 
                           but to keep it fast, we just show the name */}
                       {ws.slug}
                    </p>
                  </div>
                  {isActive && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="my-2 h-px w-full bg-outline-variant/10" />

          {/* Create New Workspace */}
          <button
            onClick={() => {
              setIsOpen(false);
              setIsCreateModalOpen(true);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container"
          >
            <Plus className="h-4 w-4 text-on-surface-variant" />
            {t('nav.createWorkspace') || 'Create workspace'}
          </button>

          <form action="/auth/logout" method="post" className="w-full">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-on-surface transition-colors hover:bg-error/10 hover:text-error"
            >
              <LogOut className="h-4 w-4 text-on-surface-variant" />
              {t('nav.signOut') || 'Sign out'}
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
