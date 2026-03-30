"use client";

import Link from "next/link";
import { MessageSquare, ArrowRight, User } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";

interface Conversation {
  widgetSessionId: string;
  widgetName: string;
  agentName?: string | null;
  agentLabel?: string | null;
  lastActivityAt: string;
  latestSnippet?: string | null;
}

interface RecentActivityProps {
  conversations: Conversation[];
  isLoading: boolean;
}

export function RecentActivity({ conversations, isLoading }: RecentActivityProps) {
  return (
    <div className="rounded-[2rem] bg-surface-container-low/30 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.06)] ring-1 ring-outline-variant/10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-primary/5 text-primary mb-3">
            <span className="text-[9px] font-bold uppercase tracking-widest">Live Activity</span>
          </div>
          <h2 className="font-headline text-2xl font-bold text-on-surface">Recent Conversations</h2>
        </div>
        <Link
          href="/analytics"
          className="group flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-all"
        >
          View All Analytics
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <div className="space-y-3.5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-2xl bg-surface-container-low/60"
            />
          ))
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container-low/20">
            <div className="h-12 w-12 rounded-full bg-surface-container flex items-center justify-center mb-4">
              <MessageSquare className="h-5 w-5 text-on-surface-variant/40" />
            </div>
            <p className="text-sm font-bold text-on-surface-variant/60 uppercase tracking-widest">
              No conversations detected
            </p>
          </div>
        ) : (
          conversations.slice(0, 5).map((convo) => (
            <Link
              key={convo.widgetSessionId}
              href="/analytics"
              className="group relative block rounded-2xl bg-surface-container-lowest/50 p-5 transition-all hover:bg-white hover:shadow-lg hover:shadow-primary/5 hover:ring-1 hover:ring-primary/10"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex gap-4 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="truncate text-sm font-bold text-on-surface uppercase tracking-tight">
                        {convo.widgetName}
                      </p>
                      <span className="h-1 w-1 rounded-full bg-outline-variant/40" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/60">
                        {convo.agentLabel || convo.agentName || "Unknown agent"}
                      </p>
                    </div>
                    <p className="line-clamp-1 text-[13px] leading-relaxed text-on-surface-variant/80 italic">
                      &ldquo;{convo.latestSnippet || "Waiting for customer input..."}&rdquo;
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end">
                  <span className="text-[10px] font-bold tracking-tight text-on-surface-variant/50">
                    {formatRelativeDate(convo.lastActivityAt)}
                  </span>
                  <div className="mt-2 h-1.5 w-1.5 rounded-full bg-success ring-4 ring-success/10 animate-pulse" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
