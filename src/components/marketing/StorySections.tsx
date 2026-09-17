import { ArrowRight, BookOpenCheck, Check, Code2, FileText, Globe, HelpCircle, History, MessageSquare, Moon, SlidersHorizontal } from "lucide-react";
import { AvenroLogo } from "@/components/brand/AvenroLogo";
import { MiloLogo } from "@/components/brand/MiloLogo";
import { SimpleIcon } from "@/components/icons/SimpleIcon";
import { SUPPORTED_INTEGRATIONS } from "@/lib/integrations";
import { ChatHeader, GroundedAnswer, Message, ProductFrame, type StoryCopy } from "./ProductUI";
import s from "./product-story.module.css";

export function VisitorScene({ copy }: { copy: StoryCopy }) {
  return <ProductFrame copy={copy} title="avenro.se" className={s.visitorFrame}>
    <div className={s.visitorWebsite}>
      <div className={s.websiteExcerpt}><AvenroLogo className="h-8 w-auto" /><div><span className={s.microLabel}>AVENRO / MILO</span><h3>{copy.visitor.siteHeadline}</h3><p>{copy.visitor.siteDescription}</p><div className={s.websitePills}><span><MessageSquare size={15} />{copy.conversation}</span><span><BookOpenCheck size={15} />{copy.knowledgeLabel}</span><span><History size={15} />{copy.visitor.historyBadge}</span></div></div><p className={s.websiteCaption}>{copy.visitor.caption}<ArrowRight size={18} /></p></div>
      <div className={s.visitorChat}>
        <ChatHeader copy={copy} />
        <div className={s.visitorChatBody}>
          <div className={s.visitorHistoryNotice}><History size={13} /><span>{copy.visitor.historyChip}</span></div>
          <Message visitor>{copy.visitor.prompt}</Message>
          <div className={s.visitorReply}><GroundedAnswer copy={copy} source={copy.knowledge.sources[2].title}><Message>{copy.visitor.answer}</Message></GroundedAnswer><p>{copy.visitor.followup}</p></div>
        </div>
        <div className={s.chatComposer}><span>{copy.visitor.input}</span><span aria-hidden="true"><ArrowRight size={17} /></span></div>
      </div>
    </div>
  </ProductFrame>;
}

export function KnowledgeScene({ copy }: { copy: StoryCopy }) {
  const icons = [Globe, FileText, HelpCircle];
  return <div className={s.knowledgeScene}>
    <div className={s.knowledgeSources}>
      <div className={s.panelTitle}><h3><BookOpenCheck size={17} />{copy.knowledgeLabel}</h3><span className={s.sitemapBadge}><Globe size={13} />{copy.knowledge.autoCrawlLabel}</span><span className={s.example}>{copy.example}</span></div>
      {copy.knowledge.sources.map((source, i) => { const Icon = icons[i]; return <div key={source.title} className={i === 2 ? s.sourceSelected : s.sourceRow}><span className={s.sourceIcon}><Icon size={19} /></span><div><strong>{source.title}</strong><p>{source.meta}</p></div><span className={s.sourceType}>{source.kind}</span><Check size={16} /></div>; })}
    </div>
    <div className={s.knowledgeBridge} aria-hidden="true"><span /><MiloLogo size={42} /><span /></div>
    <div className={s.knowledgeAnswer}><p className={s.microLabel}>{copy.knowledge.question}</p><GroundedAnswer copy={copy} source={copy.knowledge.sources[2].title}><p>{copy.knowledge.answer}</p></GroundedAnswer></div>
    <div className={s.settingsStrip}><div><SlidersHorizontal size={17} /><strong>{copy.knowledge.settings}</strong></div><dl><div><dt>{copy.knowledge.toneLabel}</dt><dd>{copy.knowledge.tone}</dd></div><div><dt>{copy.knowledge.rulesLabel}</dt><dd>{copy.knowledge.rules}</dd></div></dl><p><Check size={14} />{copy.knowledge.toolsLabel}: {copy.integrations.items.map(item => item.label).join(", ")}</p></div>
  </div>;
}

export function PlatformCompatibilityStrip({ copy }: { copy: StoryCopy }) {
  const setup = copy.setup;
  return (
    <div className={s.platformCompatibility} data-reveal>
      <div className={s.platformHeader}>
        <div className={s.platformTitleGroup}>
          <Code2 size={15} strokeWidth={1.5} className={s.platformHeaderIcon} aria-hidden="true" />
          <strong>{setup.platformLabel}</strong>
          <span className={s.scriptTagBadge}>&lt;script /&gt;</span>
        </div>
        <p className={s.platformNote}>{setup.snippetNote}</p>
      </div>
      <div className={s.platformPills}>
        {setup.platforms.map((platform) => (
          <span key={platform} className={s.platformPill}>
            <Check size={11} strokeWidth={1.7} className={s.platformCheck} aria-hidden="true" />
            {platform}
          </span>
        ))}
      </div>
    </div>
  );
}

export function NightScene({ copy }: { copy: StoryCopy }) {
  return <div className={s.nightScene}>
    <div className={s.nightClock}><span><Moon size={17} />{copy.night.label}</span><p aria-label="23:48">23<span>:</span>48</p><div><MiloLogo size={29} /><span>{copy.online}</span></div></div>
    <ol className={s.nightTimeline}>{copy.night.events.map((event, i) => <li key={event.time}><span className={s.timelinePoint}>{i === 2 ? <Check size={15} /> : <MessageSquare size={15} />}</span><div><time>{event.time}</time><h3>{event.title}</h3><p>{event.text}</p></div></li>)}</ol>
  </div>;
}

/**
 * Every app a workspace can connect, drawn straight from SUPPORTED_INTEGRATIONS
 * so the strip can never drift from what the product actually supports. The
 * label above it says "connect the tools you already use" on purpose: a bare row
 * of logos reads as a customer wall, and Avenro has no customers to show.
 * The second pass is aria-hidden — it exists only so the loop has no seam.
 */
export function IntegrationMarquee({ copy }: { copy: StoryCopy }) {
  const apps = SUPPORTED_INTEGRATIONS.filter(app => app.simpleIcon);
  const categories: Record<string, string> = copy.integrations.categories;
  return <div className={s.marquee} role="group" aria-label={copy.integrations.catalog}>
    <p className={s.marqueeLabel}>{copy.integrations.catalog}</p>
    <div className={s.marqueeViewport}>
      <div className={s.marqueeTrack}>
        {[0, 1].map(pass => apps.map(app => (
          <div key={`${pass}-${app.slug}`} className={s.marqueeItem} aria-hidden={pass === 1 || undefined}>
            <SimpleIcon iconKey={app.simpleIcon} color={app.simpleIconColor} size={21} />
            <div>
              <strong>{app.displayName}</strong>
              <span>{categories[app.category] ?? app.category}</span>
            </div>
          </div>
        )))}
      </div>
    </div>
  </div>;
}
