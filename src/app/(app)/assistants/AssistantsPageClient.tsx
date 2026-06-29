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
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-5 py-5 shadow-sm sm:px-6 lg:px-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/8 px-2.5 py-1 text-primary">
              <AppIcon name="forum" className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{t('assistants.badge')}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold leading-tight tracking-normal text-on-surface sm:text-3xl">
                {t('assistants.title')}
              </h1>
              <span className="rounded-full border border-primary/15 bg-primary/8 px-2.5 py-1 text-xs font-semibold text-primary">
                {t('common.beta')}
              </span>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant/75">
              {t('assistants.description')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCreateAgent('assistant')}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-on-surface px-4 text-sm font-semibold text-background transition-colors hover:bg-on-surface/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]"
          >
            {t('assistants.newAssistant')}
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-52 animate-pulse rounded-2xl border border-outline-variant/20 bg-surface-container-low"
            />
          ))}
        </div>
      ) : sortedAssistants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container-lowest px-6 py-16 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant ring-1 ring-outline-variant/15">
            <AppIcon name="forum" className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-base font-semibold tracking-normal text-on-surface">
            {t('assistants.noAssistants')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant/70">
            {t('assistants.noAssistantsDescription')}
          </p>
          <button
            type="button"
            onClick={() => openCreateAgent('assistant')}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-on-surface px-4 text-sm font-semibold text-background transition-colors hover:bg-on-surface/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
              className="group rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm transition-colors hover:border-primary/25 hover:bg-surface-container-low/45"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-primary">
                    {t('assistants.assistant')}
                  </p>
                  <h2 className="mt-2 text-base font-semibold tracking-normal text-on-surface">
                    {assistant.name}
                  </h2>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    assistant.status === 'paused'
                      ? 'bg-surface-container text-on-surface-variant'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  {assistant.status === 'paused' ? t('statuses.agent.paused') : t('statuses.agent.active')}
                </span>
              </div>

              <p className="mt-3 line-clamp-3 text-sm leading-6 text-on-surface-variant/75">
                {assistant.description || t('assistants.noDescription')}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface-variant">
                  {assistant.model}
                </span>
                <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface-variant">
                  {t('assistants.chats', { count: assistant.threadCount })}
                </span>
                {assistant.canEdit ? (
                  <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface-variant">
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
