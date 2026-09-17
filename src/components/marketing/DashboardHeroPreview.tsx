import { ArrowRight, BookOpenCheck, Check, SlidersHorizontal } from "lucide-react";
import { MiloLogo } from "@/components/brand/MiloLogo";
import { ConversationRow, Metrics, ProductFrame, ProductSidebar, type StoryCopy } from "./ProductUI";
import styles from "./landing.module.css";
import s from "./product-story.module.css";

export function DashboardHeroPreview({ copy }: { copy: StoryCopy }) {
  return <div className={`${styles.dashboardScrollStage} ${s.heroDashboard}`}>
    <div className={styles.dashboardScrollCard}>
      <ProductFrame copy={copy} title={copy.overview}>
        <div className={s.dashboardShell}>
          <ProductSidebar copy={copy} />
          <div className={s.dashboardMain}>
            <div className={s.dashboardTitle}><div><h2>{copy.dashboard.greeting}</h2><p>{copy.dashboard.subheading}</p></div><span className={s.activeBadge}><Check size={13} />{copy.status}</span></div>
            <Metrics copy={copy} />
            <div className={s.heroDashboardGrid}>
              <div className={s.surfacePanel}>
                <p className={s.microLabel}><span className={s.statusDot} />{copy.dashboard.activity}</p>
                <div className={s.panelTitle}><h3>{copy.dashboard.recent}</h3><ArrowRight size={16} /></div>
                <ConversationRow copy={copy} />
                <div className={s.heroLeadNotice}><span className={s.avatar}>A</span><div><strong>{copy.dashboard.newLead}</strong><p>Alex · {copy.dashboard.contactMeta}</p></div><Check size={16} /></div>
              </div>
              <div className={s.heroControl}>
                <MiloLogo size={40} /><h3>{copy.dashboard.controlTitle}</h3><p>{copy.dashboard.controlText}</p>
                <div><BookOpenCheck size={15} />{copy.dashboard.knowledgeCount}</div><div><SlidersHorizontal size={15} />{copy.dashboard.connected}</div>
              </div>
            </div>
          </div>
        </div>
      </ProductFrame>
    </div>
  </div>;
}
