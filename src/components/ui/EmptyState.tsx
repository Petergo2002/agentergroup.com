'use client';

import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = ({ title, description, icon, actionLabel, onAction }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-surface-container-low/30 rounded-3xl border-2 border-dashed border-outline-variant/20">
      <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary mb-6">
        <span className="material-symbols-outlined text-3xl">{icon}</span>
      </div>
      <h3 className="text-xl font-headline font-bold text-on-surface mb-2">
        {title}
      </h3>
      <p className="text-sm text-secondary max-w-sm mb-8 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-3 signature-gradient text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          {actionLabel}
        </button>
      )}
    </div>
  );
};
