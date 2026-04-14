'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AppIcon } from '@/components/icons/AppIcon';
import { useLanguage } from '@/components/i18n/LanguageProvider';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  const { t } = useLanguage();

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-lg glass-panel border border-outline-variant/15 rounded-[2.5rem] shadow-premium animate-in zoom-in-95 duration-300 overflow-hidden">
        {/* Physical Top-Light Detail */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
          <h3 className="text-2xl font-headline font-bold text-on-surface tracking-tight">
            {title || t('modals.defaultTitle')}
          </h3>
          <button 
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all active:scale-95"
          >
            <AppIcon name="close" className="h-6 w-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
