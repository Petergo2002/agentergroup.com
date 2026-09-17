'use client';

import dynamic from 'next/dynamic';
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { AgentSurface } from '@/lib/types';

const CreateAgentModal = dynamic(
  () => import('../modals/CreateAgentModal').then((mod) => mod.CreateAgentModal),
  {
    ssr: false,
  },
);

interface ModalContextType {
  openCreateAgent: (surface?: AgentSurface) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModals = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModals must be used within a ModalProvider');
  }
  return context;
};

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [isCreateAgentOpen, setIsCreateAgentOpen] = useState(false);
  const [hasOpenedCreateAgent, setHasOpenedCreateAgent] = useState(false);
  const [initialSurface, setInitialSurface] = useState<AgentSurface>('widget');

  const openCreateAgent = useCallback((surface: AgentSurface = 'widget') => {
    setHasOpenedCreateAgent(true);
    setInitialSurface(surface);
    setIsCreateAgentOpen(true);
  }, []);
  const closeCreateAgent = useCallback(() => {
    setIsCreateAgentOpen(false);
    setInitialSurface('widget');
  }, []);
  const contextValue = useMemo(() => ({ openCreateAgent }), [openCreateAgent]);

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      {hasOpenedCreateAgent ? (
        <CreateAgentModal 
          isOpen={isCreateAgentOpen} 
          onClose={closeCreateAgent} 
          initialSurface={initialSurface}
        />
      ) : null}
    </ModalContext.Provider>
  );
};
