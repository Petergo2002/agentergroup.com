'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppIcon } from '@/components/icons/AppIcon';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useToast } from '@/components/ui/ToastProvider';
import type { KnowledgeSourceRecord } from '@/lib/types';

interface ViewSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: KnowledgeSourceRecord | null;
  onSourceUpdated?: () => void;
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

interface TextContent {
  type: 'text';
  content: string;
  name: string;
  mimeType: string;
}

interface FileContent {
  type: 'file';
  url: string;
  name: string;
  mimeType: string;
  fileSizeBytes: number | null;
}

type Content = TextContent | FileContent;

export function ViewSourceModal({ isOpen, onClose, source, onSourceUpdated }: ViewSourceModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [content, setContent] = useState<Content | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !source) return;

    const fetchContent = async () => {
      setLoadingState('loading');
      setContent(null);
      setErrorMessage('');
      setIsEditing(false);
      setEditedText('');

      try {
        const response = await fetch(`/api/knowledge/sources/${source.id}/content`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? t('knowledge.viewContentError'));
        }

        setContent(payload as Content);
        if (payload.type === 'text') {
          setEditedText(payload.content);
        }
        setLoadingState('success');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : t('knowledge.viewContentError'));
        setLoadingState('error');
      }
    };

    void fetchContent();
  }, [isOpen, source, t]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false);
          setEditedText(content?.type === 'text' ? content.content : '');
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, isEditing, content]);

  const handleSave = async () => {
    if (!source || !content || content.type !== 'text') return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/knowledge/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: editedText }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? t('knowledge.updateContentError'));
      }

      setContent({ ...content, content: editedText });
      setIsEditing(false);
      showToast(t('knowledge.contentUpdated'), 'success');
      onSourceUpdated?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('knowledge.updateContentError'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedText(content?.type === 'text' ? content.content : '');
  };

  if (!isOpen || !source) return null;

  const isPdf = content?.type === 'file' && (content.mimeType === 'application/pdf' || content.name.toLowerCase().endsWith('.pdf'));
  const isImage = content?.type === 'file' && content.mimeType.startsWith('image/');
  const isOfficeDoc = content?.type === 'file' && /\.(doc|docx|xls|xlsx|ppt|pptx|csv)$/i.test(content.name);
  const isTextFile = content?.type === 'file' && /\.(txt|md|json|log)$/i.test(content.name);

  const renderContent = () => {
    if (loadingState === 'loading') {
      return (
        <div className="flex h-96 w-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      );
    }

    if (loadingState === 'error') {
      return (
        <div className="flex h-96 w-full flex-col items-center justify-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-error/10">
            <AppIcon name="warning" className="h-8 w-8 text-error" />
          </div>
          <p className="text-sm text-error">{errorMessage}</p>
        </div>
      );
    }

    if (!content) return null;

    if (content.type === 'text') {
      if (isEditing) {
        return (
          <div className="h-[60vh] min-h-[300px] rounded-xl bg-white dark:bg-surface-bright p-8 shadow-inner ring-1 ring-inset ring-outline-variant/10">
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="h-full w-full resize-none bg-transparent text-[15px] leading-relaxed text-gray-800 dark:text-gray-200 outline-none font-body"
              placeholder={t('knowledge.enterTextContent')}
            />
          </div>
        );
      }

      return (
        <div className="max-h-[60vh] min-h-[200px] overflow-auto rounded-xl bg-white dark:bg-surface-bright p-8 shadow-inner ring-1 ring-inset ring-outline-variant/10">
          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none font-body text-gray-700 dark:text-gray-300">
            {content.content.split('\n').map((line, i) => (
              <p key={i} className="my-1.5 leading-relaxed">
                {line || '\u00A0'}
              </p>
            ))}
          </div>
        </div>
      );
    }

    if (isPdf) {
      const pdfUrl = `${content.url}#toolbar=0&navpanes=0&scrollbar=0`;
      return (
        <div className="h-[70vh] w-full overflow-hidden rounded-xl bg-white dark:bg-surface-bright shadow-inner ring-1 ring-inset ring-outline-variant/10">
          <object
            data={pdfUrl}
            type="application/pdf"
            className="h-full w-full border-0"
          >
            <iframe
              src={pdfUrl}
              className="h-full w-full border-0"
              title={content.name}
            />
          </object>
        </div>
      );
    }

    if (isOfficeDoc) {
      const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(content.url)}&embedded=true`;
      return (
        <div className="h-[70vh] w-full overflow-hidden rounded-xl bg-surface-container-low shadow-inner ring-1 ring-inset ring-outline-variant/10">
          <iframe
            src={googleViewerUrl}
            className="h-full w-full border-0 bg-white"
            title={content.name}
          />
        </div>
      );
    }

    if (isTextFile) {
      return (
        <div className="h-[70vh] w-full overflow-hidden rounded-xl bg-white dark:bg-surface-bright shadow-inner ring-1 ring-inset ring-outline-variant/10 p-2">
          <iframe
            src={content.url}
            className="h-full w-full border-0 bg-transparent rounded-lg"
            title={content.name}
          />
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="flex h-[70vh] items-center justify-center overflow-auto rounded-xl bg-surface-container-low p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.url}
            alt={content.name}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        </div>
      );
    }

    return (
      <div className="flex h-96 w-full flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container">
          <AppIcon name="info" className="h-8 w-8 text-on-surface-variant" />
        </div>
        <p className="text-sm text-on-surface-variant">{t('knowledge.previewNotAvailable')}</p>
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          download={content.name}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-all hover:bg-primary/90"
        >
          {t('knowledge.downloadFile')}
        </a>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={isEditing ? handleCancelEdit : onClose}
      />
      <div className="relative w-full max-w-4xl glass-panel border border-outline-variant/15 rounded-[2.5rem] shadow-premium animate-in zoom-in-95 duration-300 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="px-8 pt-8 pb-4 flex items-center justify-between shrink-0">
          <div className="min-w-0 flex-1 mr-4">
            <h3 className="text-xl font-headline font-bold text-on-surface tracking-tight truncate">
              {source.name}
            </h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              {content?.type === 'text' && (
                isEditing 
                  ? t('knowledge.editingContent') 
                  : source.source_type === 'website' 
                    ? t('knowledge.websiteContent') 
                    : t('knowledge.textContent')
              )}
              {content?.type === 'file' && t('knowledge.fileContent')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {content?.type === 'text' && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 rounded-full bg-surface-container px-4 py-2 text-xs font-semibold text-on-surface transition-all hover:bg-surface-container-high"
              >
                <AppIcon name="edit" className="h-4 w-4" />
                {t('common.edit')}
              </button>
            )}
            {content?.type === 'text' && isEditing && (
              <>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-full border border-outline-variant/20 px-4 py-2 text-xs font-semibold text-on-surface transition-all hover:bg-surface-container disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSaving ? t('common.saving') : t('common.save')}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all active:scale-95"
            >
              <AppIcon name="close" className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 pt-2 overflow-auto flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
    </div>,
    document.body
  );
}