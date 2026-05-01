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
  size?: 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full';
}

export const Modal = ({ isOpen, onClose, title, children, size = 'lg' }: ModalProps) => {
  const { t } = useLanguage();

  const sizeClasses = {
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    full: 'max-w-[calc(100vw-2rem)]',
  }[size];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div
        className={`relative flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-xl border border-outline-variant/20 glass-panel shadow-xl animate-in zoom-in-95 duration-300 sm:max-h-[calc(100vh-2rem)] ${sizeClasses}`}
      >
        {/* Physical Top-Light Detail */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-4 pt-5 sm:px-8 sm:pt-8">
          <h3 className="text-2xl font-headline font-bold text-on-surface tracking-tight">
            {title || t('modals.defaultTitle')}
          </h3>
          <button 
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <AppIcon name="close" className="h-6 w-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
