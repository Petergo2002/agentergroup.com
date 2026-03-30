'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CreateAgentModal } from '../modals/CreateAgentModal';
import type { AgentSurface } from '@/lib/types';

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
  const [initialSurface, setInitialSurface] = useState<AgentSurface>('widget');

  const openCreateAgent = (surface: AgentSurface = 'widget') => {
    setInitialSurface(surface);
    setIsCreateAgentOpen(true);
  };
  const closeCreateAgent = () => {
    setIsCreateAgentOpen(false);
    setInitialSurface('widget');
  };

  return (
    <ModalContext.Provider value={{ openCreateAgent }}>
      {children}
      <CreateAgentModal 
        isOpen={isCreateAgentOpen} 
        onClose={closeCreateAgent} 
        initialSurface={initialSurface}
      />
    </ModalContext.Provider>
  );
};
