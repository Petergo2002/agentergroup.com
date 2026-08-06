import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";
import { getAppRequestContext } from "@/lib/app/request-context";
import { getAppUrl, getWidgetAppUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadWidgetById,
  loadWidgetPreviewDraft,
  verifyWidgetPreviewToken,
  type WidgetAdminSupabase,
} from "@/lib/widgets/server";

export default async function WidgetDraftPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string; preview_token?: string }>;
}) {
  const { id } = await params;
  const { revision, preview_token: previewToken } = await searchParams;
  const language = await getServerLanguage();
  const messages = await getMessages(language);
  const { supabase, user, context } = await getAppRequestContext();

  if (!user || !context) {
    return null;
  }

  const loaded = await loadWidgetById(supabase as never, id);

  if (!loaded || loaded.widget.workspace_id !== context.workspace.id) {
    return null;
  }

  const admin = createAdminClient() as unknown as WidgetAdminSupabase;
  const verifiedPreviewToken =
    previewToken && revision
      ? await verifyWidgetPreviewToken(previewToken, loaded.widget.widget_public_key)
      : null;
  const previewDraft =
    revision && verifiedPreviewToken
      ? await loadWidgetPreviewDraft(admin, loaded.widget.id, revision)
      : null;
  const previewReady = Boolean(previewDraft && revision && verifiedPreviewToken);
  const widgetPreviewUrl =
    previewReady && revision && previewToken
      ? `${getWidgetAppUrl()}/?widget=${encodeURIComponent(
          loaded.widget.widget_public_key,
        )}&preview=1&preview_source=widget_preview&preview_token=${encodeURIComponent(
          previewToken,
        )}&preview_revision=${encodeURIComponent(revision)}&parent_origin=${encodeURIComponent(
          getAppUrl(),
        )}`
      : null;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-6 py-8 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/55">
              {messages.widgets.widgetPreview}
            </p>
            <h1 className="mt-3 text-3xl font-headline font-bold tracking-tight sm:text-4xl">
              {loaded.widget.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
              {messages.widgets.standalonePreviewDescription}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {widgetPreviewUrl ? (
              <a
                href={widgetPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-outline-variant/15 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:border-on-surface/15 hover:text-on-surface"
              >
                {messages.widgets.openRawWidget}
              </a>
            ) : null}
            <Link
              href={`/widgets/${loaded.widget.id}`}
              className="rounded-full border border-outline-variant/15 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:border-on-surface/15 hover:text-on-surface"
            >
              {messages.widgets.backToWidget}
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-1 flex-col">
          {previewReady && widgetPreviewUrl ? (
            <div className="flex flex-1 flex-col rounded-[2rem] border border-outline-variant/10 bg-surface-container-low p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-5">
              <div className="flex items-center gap-3 border-b border-outline-variant/10 px-3 pb-4 sm:px-4">
                <span className="h-2.5 w-2.5 rounded-full bg-on-surface/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-on-surface/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-on-surface/15" />
                <div className="ml-2 flex-1 truncate rounded-full border border-outline-variant/10 bg-background px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">
                  {messages.widgets.standaloneLinkPreview}
                </div>
              </div>

              <div className="flex-1 p-2 sm:p-3">
                <iframe
                  src={widgetPreviewUrl}
                  title={`${loaded.widget.name} standalone widget preview`}
                  loading="lazy"
                  className="h-[calc(100vh-15rem)] min-h-[720px] w-full rounded-[1.6rem] border border-outline-variant/10 bg-background"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-low px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:px-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/55">
                Status
              </p>
              <p className="mt-4 text-lg font-semibold text-on-surface">
                {messages.widgets.previewExpired}
              </p>
              <p className="mt-3 max-w-xl text-sm leading-7 text-on-surface-variant">
                {messages.widgets.previewExpiredDescription}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
