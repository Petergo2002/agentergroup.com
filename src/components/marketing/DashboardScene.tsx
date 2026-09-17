import { BookingConfirmation, ChatHeader, ConversationRow, GroundedAnswer, LiveLeadAlertBanner, LeadSummary, Message, Metrics, ProductFrame, ProductSidebar, type StoryCopy } from "./ProductUI";
import s from "./product-story.module.css";

export function DashboardScene({ copy, slot = 0, tab = "conversation", onTab }: { copy: StoryCopy; slot?: number; tab?: "conversation" | "lead"; onTab?: (tab: "conversation" | "lead") => void }) {
  return <ProductFrame copy={copy} title={copy.analyticsLabel}>
    <div className={s.dashboardShell}><ProductSidebar copy={copy} active={copy.analyticsLabel} /><div className={s.dashboardMain}>
      <div className={s.dashboardTitle}><div><h3>{copy.analyticsLabel}</h3><p>{copy.dashboard.period}</p></div></div>
      <Metrics copy={copy} />
      <div className={s.reviewGrid}>
        <LiveLeadAlertBanner copy={copy} slot={slot} />
        <div className={s.reviewList}><p className={s.microLabel}>{copy.dashboard.recent}</p><ConversationRow copy={copy} prompt={copy.dashboard.recentInquiry} topic={copy.dashboard.recentTopic} /><GroundedAnswer copy={copy} source={copy.knowledge.sources[2].title} /></div>
        <div className={s.reviewDetail} data-tab={tab}>
          {<div className={s.mobileTabs} role="group" aria-label={copy.dashboard.view}>{(["conversation", "lead"] as const).map(key => onTab ? <button type="button" key={key} aria-pressed={tab === key} onClick={() => onTab(key)}>{copy[key]}</button> : <span key={key} data-selected={tab === key}>{copy[key]}</span>)}</div>}
          <div className={s.reviewConversation}><ChatHeader copy={copy} /><div className={s.reviewMessages}><Message visitor>{copy.action.qualification}</Message><BookingConfirmation copy={copy} slot={slot} /></div></div>
          <div className={s.reviewLead}><p className={s.microLabel}>{copy.dashboard.summary}</p><LeadSummary copy={copy} slot={slot} /></div>
        <noscript><div className={s.noScriptLead}><LeadSummary copy={copy} slot={slot} /></div></noscript></div>
      </div>
    </div></div>
  </ProductFrame>;
}
