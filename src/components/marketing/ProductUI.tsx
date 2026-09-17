import type { ReactNode } from "react";
import { BarChart3, BookOpenCheck, CalendarCheck2, Check, ChevronRight, Database, LayoutGrid, MessageSquare, Network, Sparkles, Users } from "lucide-react";
import { MiloLogo } from "@/components/brand/MiloLogo";
import type { Messages } from "@/locales/en";
import { DEMO_CONTACT, DEMO_METRICS } from "./demo-state";
import s from "./product-story.module.css";
export type StoryCopy = Messages["landing"]["story"];

export function ProductFrame({ copy, title, children, className = "" }: { copy: StoryCopy; title: string; children: ReactNode; className?: string }) {
  return <div className={`${s.productFrame} ${className}`}>
    <div className={s.windowBar}><span className={s.windowDots} aria-hidden="true"><i /><i /><i /></span><span className={s.windowTitle}>Avenro <span>/</span> {title}</span><span className={s.example}>{copy.example}</span></div>{children}
  </div>;
}
/** Mirrors the real Milo sidebar: Home, Milo, Website Chat, Knowledge, Leads, Improve Milo, Analytics, Connections. */
export function ProductSidebar({ copy, active = copy.overview }: { copy: StoryCopy; active?: string }) {
  const items = [[LayoutGrid, copy.overview], [MiloLogo, "MILO"], [MessageSquare, copy.websiteChat], [Database, copy.knowledgeLabel], [Users, copy.leadsLabel], [Sparkles, copy.improveLabel], [BarChart3, copy.analyticsLabel], [Network, copy.connectionsLabel]] as const;
  return <div className={s.productSidebar} aria-hidden="true">
    <div className={s.workspace}><MiloLogo size={30} /><div>Avenro<small>{copy.workspaceLabel}</small></div></div>
    {items.map(([Icon, label]) => <div key={label} className={label === active ? s.sidebarActive : s.sidebarItem}><Icon className="h-4 w-4" /><span>{label}</span></div>)}
    <div className={s.sidebarFooter}><span className={s.statusDot} />{copy.online}</div>
  </div>;
}
export function ChatHeader({ copy }: { copy: StoryCopy }) {
  return <div className={s.chatHeader}><MiloLogo size={36} /><div><strong>MILO</strong><span>{copy.online}</span></div><span className={s.statusDot} /></div>;
}
export function Message({ children, visitor = false, caption }: { children: ReactNode; visitor?: boolean; caption?: string }) {
  return <div className={visitor ? s.visitorMessage : s.agentMessage}><p>{children}</p>{caption && <small><MiloLogo size={15} />{caption}</small>}</div>;
}
/**
 * The citation mark: a ruled passage with its source named underneath.
 * "Grounded in your own knowledge" is the claim that separates MILO from a
 * generic chatbot, so every answer on this page carries the same mark rather
 * than a different chip, note or badge per scene. Pass children for a full
 * answer; omit them for a bare citation line.
 */
export function GroundedAnswer({ copy, source, children }: { copy: StoryCopy; source: string; children?: ReactNode }) {
  return <div className={s.groundedAnswer}>
    {children ? <div className={s.groundedBody}>{children}</div> : null}
    <p className={s.groundedSource}><BookOpenCheck size={13} aria-hidden="true" />{copy.source}<b>{source}</b></p>
  </div>;
}
export function BookingConfirmation({ copy, slot = 0 }: { copy: StoryCopy; slot?: number }) {
  return <div className={s.bookingConfirmation}><span className={s.successIcon}><CalendarCheck2 size={20} /></span><div><strong>{copy.booked}</strong><p>{copy.meeting}</p><b>{copy.action.slots[slot]}</b><small>{copy.action.timezone}</small></div><Check className={s.confirmedCheck} size={18} /></div>;
}
export function LeadSummary({ copy, slot = 0, compact = false }: { copy: StoryCopy; slot?: number; compact?: boolean }) {
  return <div className={s.leadSummary}>
    <div className={s.leadIdentity}><span className={s.avatar}>A</span><div><strong>{DEMO_CONTACT.name}</strong><p>{DEMO_CONTACT.email}</p></div><span className={s.intentBadge}>{copy.hot}</span></div>
    <dl><div><dt>{copy.need}</dt><dd>{copy.action.summaryNeed}</dd></div>{!compact && <div><dt>{copy.intent}</dt><dd>{copy.dashboard.contactMeta}</dd></div>}<div><dt>{copy.next}</dt><dd>{copy.action.summaryAction}<span className={s.timeDetail}>{copy.action.slots[slot]}</span></dd></div></dl>
  </div>;
}
export function Metrics({ copy }: { copy: StoryCopy }) {
  return <div className={s.metrics}>{copy.dashboard.metrics.map((label, i) => <div key={label}><span>{label}</span><strong>{DEMO_METRICS[i]}</strong></div>)}</div>;
}
export function ConversationRow({ copy, prompt, topic }: { copy: StoryCopy; prompt?: string; topic?: string }) {
  return <div className={s.conversationRow}><span className={s.avatar}>A</span><div><strong>{copy.dashboard.customer}</strong><p>{prompt ?? copy.visitor.prompt}</p><small>{topic ?? copy.websiteChat}</small></div><ChevronRight size={16} /></div>;
}

export function LiveLeadAlertBanner({ copy, slot = 0 }: { copy: StoryCopy; slot?: number }) {
  const alert = copy.dashboard.alert;
  return (
    <div className={s.liveAlertBanner}>
      <div className={s.liveAlertLeft}>
        <span className={s.liveDot} />
        <strong>{alert.channel}</strong>
        <span className={s.liveAlertTitle}>{alert.title}</span>
      </div>
      <div className={s.liveAlertRight}>
        <span><Check size={12} /><b>{copy.action.slots[slot]}</b></span>
        <small className={s.liveAlertTime}>10:02</small>
      </div>
    </div>
  );
}
