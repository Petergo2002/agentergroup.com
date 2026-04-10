'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useModals } from '@/components/ui/ModalProvider';
import { formatRelativeDate } from '@/lib/utils';
import type { AssistantListItem } from '@/lib/types';

export default function AssistantsPageClient({
  initialAssistants,
}: {
  initialAssistants: AssistantListItem[];
}) {
  const { language, t } = useLanguage();
  const { openCreateAgent } = useModals();
  const isLoading = false;

  const sortedAssistants = useMemo(
    () =>
      [...initialAssistants].sort((left, right) => {
        const leftValue = left.lastActivityAt ?? left.updatedAt;
        const rightValue = right.lastActivityAt ?? right.updatedAt;
        return new Date(rightValue).getTime() - new Date(leftValue).getTime();
      }),
    [initialAssistants],
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {t('assistants.badge')}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-[2.15rem] font-headline font-bold tracking-tight text-on-surface sm:text-[2.45rem]">
              {t('assistants.title')}
            </h1>
            <span className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              {t('common.beta')}
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
            {t('assistants.description')}
          </p>
        </div>
        <button
          onClick={() => openCreateAgent('assistant')}
          className="rounded-full bg-on-surface px-5 py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90"
        >
          {t('assistants.newAssistant')}
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-52 animate-pulse rounded-[1.75rem] border border-outline-variant/20 bg-surface-container-low"
            />
          ))}
        </div>
      ) : sortedAssistants.length === 0 ? (
        <div className="rounded-[1.8rem] border border-dashed border-outline-variant/20 bg-surface-container-lowest px-6 py-20 text-center">
          <span className="inline-flex rounded-full bg-primary/5 p-4 text-primary">
            <AppIcon name="forum" className="h-8 w-8" />
          </span>
          <h2 className="mt-4 font-headline text-2xl font-bold text-on-surface">
            {t('assistants.noAssistants')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-on-surface-variant">
            {t('assistants.noAssistantsDescription')}
          </p>
          <button
            onClick={() => openCreateAgent('assistant')}
            className="mt-6 rounded-full bg-on-surface px-5 py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90"
          >
            {t('assistants.createInternalAssistant')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedAssistants.map((assistant) => (
            <Link
              key={assistant.id}
              href={`/assistants/${assistant.id}`}
              className="group rounded-[1.75rem] border border-outline-variant/25 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition-colors hover:bg-surface-container-low"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                    {t('assistants.assistant')}
                  </p>
                  <h2 className="mt-3 text-xl font-semibold text-on-surface">
                    {assistant.name}
                  </h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                    assistant.status === 'paused'
                      ? 'bg-surface-container text-on-surface-variant'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  {assistant.status === 'paused' ? t('statuses.agent.paused') : t('statuses.agent.active')}
                </span>
              </div>

              <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                {assistant.description || t('assistants.noDescription')}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                  {assistant.model}
                </span>
                <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                  {t('assistants.chats', { count: assistant.threadCount })}
                </span>
                {assistant.canEdit ? (
                  <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                    {t('assistants.canEdit')}
                  </span>
                ) : null}
              </div>

              <div className="mt-6 flex items-center justify-between text-xs text-on-surface-variant">
                <span>
                  {assistant.lastActivityAt
                    ? t('assistants.activeSince', { value: formatRelativeDate(assistant.lastActivityAt, language) })
                    : t('assistants.updatedAt', { value: formatRelativeDate(assistant.updatedAt, language) })}
                </span>
                <span className="font-semibold text-on-surface transition-colors group-hover:text-primary">
                  {t('assistants.open')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
