'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CreateAgentModal } from '../modals/CreateAgentModal';

interface ModalContextType {
  openCreateAgent: () => void;
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

  const openCreateAgent = () => setIsCreateAgentOpen(true);
  const closeCreateAgent = () => setIsCreateAgentOpen(false);

  return (
    <ModalContext.Provider value={{ openCreateAgent }}>
      {children}
      <CreateAgentModal 
        isOpen={isCreateAgentOpen} 
        onClose={closeCreateAgent} 
      />
    </ModalContext.Provider>
  );
};
