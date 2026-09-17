import Link from "next/link";
import { ArrowDown, ArrowRight, Check, ChevronDown, Clock, FileCheck, FileKey, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { AvenroLogo } from "@/components/brand/AvenroLogo";
import { MiloLogo } from "@/components/brand/MiloLogo";

const SECURITY_ICONS = [ShieldCheck, Lock, FileKey, ShieldAlert, FileCheck, Clock];
import type { PlatformLanguage } from "@/lib/i18n";
import type { Messages } from "@/locales/en";
import { DashboardHeroPreview } from "./DashboardHeroPreview";
import { MarketingLanguageSwitcher } from "./MarketingLanguageSwitcher";
import { MarketingMobileMenu } from "./MarketingMobileMenu";
import { MarketingMotion } from "./MarketingMotion";
import { StoryProvider } from "./StoryContext";
import { VisitorScene, KnowledgeScene, NightScene, IntegrationMarquee, PlatformCompatibilityStrip } from "./StorySections";
import { LazyProductDemo } from "./LazyProductDemo";
import { ActionStage } from "./ActionStage";
import { IntegrationScene } from "./IntegrationScene";
import { DashboardScene } from "./DashboardScene";
import { ImproveScene } from "./ImproveScene";
import { demoContactHref, marketingNavItems } from "./marketing-links";
import styles from "./landing.module.css";
import s from "./product-story.module.css";

function Heading({ copy, centered = false }: { copy: { eyebrow: string; title: string; description?: string }; centered?: boolean }) {
  return <div className={centered ? s.centerHeading : s.sectionHeading} data-reveal><p className={styles.eyebrow}>{copy.eyebrow}</p><h2>{copy.title}</h2>{copy.description && <p>{copy.description}</p>}</div>;
}

export function LandingPage({ copy, language }: { copy: Messages["landing"]; language: PlatformLanguage }) {
  const story = copy.story;
  const contact = demoContactHref(language);
  const nav = marketingNavItems(copy.nav);
  return <div data-marketing-root className={`${styles.site} ${s.storySite} font-body`}>
    <MarketingMotion />
    <a href="#main-content" className={s.skipLink}>{language === "sv" ? "Hoppa till innehållet" : "Skip to content"}</a>
    <header className={`${styles.siteHeader} ${s.header}`}>
      <div className={styles.scrollProgressTrack} aria-hidden="true"><div className={styles.scrollProgressBar} /></div>
      <div className={s.headerInner}>
        <Link href="/" aria-label="Avenro" className={styles.brandLink}><AvenroLogo className="h-9 w-auto" /></Link>
        <nav className={s.desktopNav} aria-label={language === "sv" ? "Huvudnavigation" : "Primary navigation"}>{nav.map(item => <a key={item.id} href={`#${item.id}`} data-nav={item.id} className={styles.navLink}>{item.label}</a>)}</nav>
        <div className={s.headerActions}><MarketingLanguageSwitcher label={copy.nav.language} serverLanguage={language} /><Link href="/login" className={s.loginLink}>{copy.nav.login}</Link><a href={contact} className={styles.primaryButton}>{copy.nav.getStarted}<ArrowRight size={15} /></a></div>
        <MarketingMobileMenu copy={copy.nav} serverLanguage={language} />
      </div>
    </header>
    <StoryProvider><main id="main-content">
      <section className={s.hero}>
        <div className={`${styles.heroCopy} ${s.heroText}`}>
          <div className={styles.heroBadge}><MiloLogo size={19} />{copy.hero.eyebrow}</div>
          <h1 className={styles.displayTitle}><span className={styles.heroHeadlineGradient}>MILO</span> {copy.hero.title.replace(/^MILO\s/, "")}</h1>
          <p className={s.heroDescription}>{copy.hero.description}</p>
          <div className={s.heroCtas}><a href={contact} className={styles.primaryButton}>{copy.hero.primaryCta}<ArrowRight size={17} /></a><a href="#how-it-works" className={styles.secondaryButton}>{copy.hero.secondaryCta}<ArrowDown size={16} /></a></div>
          <ul className={styles.trustList}>{copy.hero.trustPoints.map(point => <li key={point}><Check size={14} />{point}</li>)}</ul>
        </div>
        <DashboardHeroPreview copy={story} />
        <div className={s.heroFootnote}><span>AVENRO / MILO</span><span>{story.visitor.scrollPrompt}</span><ArrowDown size={17} /></div>
      </section>
      <section id="website-chat" className={s.section}>
        <div className={s.editorialHeading}><Heading copy={story.visitor} /></div>
        <div data-reveal className={s.sceneSpace}><VisitorScene copy={story} /></div>
        <p className={s.sceneFootnote}><MiloLogo size={17} />{story.visitor.footnote}</p>
      </section>
      <section id="knowledge" className={`${s.section} ${s.knowledgeSection}`}>
        <div><Heading copy={story.knowledge} /></div>
        <div data-reveal><KnowledgeScene copy={story} /></div>
      </section>
      <section id="how-it-works" className={s.actionSection}>
        <div className={s.sectionInner}>
          <Heading copy={story.action} centered />
          <div className={s.actionDemoFrame}>
            <div className={s.actionTopline}><span><MiloLogo size={20} />MILO / AVENRO.SE</span><span className={s.example}>{story.example}</span></div>
            <LazyProductDemo kind="action" copy={story}><ActionStage copy={story} /><div className={s.staticSteps}>{story.action.steps.map((step,i) => <span key={step}>{String(i+1).padStart(2,"0")} {step}</span>)}</div></LazyProductDemo>
            <noscript><ol className={s.noScriptSteps}>{story.action.details.map(detail => <li key={detail}>{detail}</li>)}</ol><p className={s.demoDisclaimer}>{story.action.available}: {story.action.slots.join(" / ")}</p></noscript>
          </div>
          <p className={s.demoDisclaimer}>{story.exampleNote}</p>
        </div>
      </section>
      <section id="integrations" className={s.section}>
        <Heading copy={story.integrations} centered />
        <div data-reveal className={s.sceneSpace}><LazyProductDemo kind="integrations" copy={story}><IntegrationScene copy={story} /></LazyProductDemo></div>
        <IntegrationMarquee copy={story} />
        <p className={s.integrationFootnote}>{story.integrations.note}</p>
      </section>
      <section id="workspace" className={`${s.section} ${s.dashboardSection}`}>
        <Heading copy={story.dashboard} />
        <div data-reveal className={s.sceneSpace}><LazyProductDemo kind="dashboard" copy={story}><DashboardScene copy={story} /></LazyProductDemo></div>
      </section>
      <section id="improve" className={`${s.section} ${s.improveSection}`}>
        <Heading copy={story.improve} />
        <div data-reveal className={s.sceneSpace}><ImproveScene copy={story} /></div>
      </section>
      <section id="after-hours" className={`${s.section} ${s.nightSection}`}><Heading copy={story.night} /><div data-reveal><NightScene copy={story} /></div></section>
      <section id="setup" className={`${s.section} ${s.setupSection}`}>
        <Heading copy={story.setup} />
        <ol className={s.setupSteps}>{story.setup.steps.map((step,i) => <li key={step.title} data-reveal><span>{String(i+1).padStart(2,"0")}</span><div><h3>{step.title}</h3><p>{step.description}</p></div>{i < 2 && <ArrowRight size={19} aria-hidden="true" />}</li>)}</ol>
        <PlatformCompatibilityStrip copy={story} />
      </section>
      <section id="security" className={`${s.section} ${s.securitySection}`}>
        <div className={s.securityTopline}>
          <Heading copy={copy.security} />
        </div>
        <div className={s.securityGrid} data-reveal>
          {copy.security.items.map((item, i) => {
            const Icon = SECURITY_ICONS[i] ?? ShieldCheck;
            return (
              <div key={item.title} className={s.securityCard}>
                <div className={s.securityCardHeader}>
                  <Icon size={18} strokeWidth={1.5} className={s.securityCardIcon} aria-hidden="true" />
                  <span className={s.securityCardIndex}>{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            );
          })}
        </div>
        <div className={s.securityFooter} data-reveal>
          <Link href="/privacy-policy" className={s.textLink}>
            {copy.security.policyLink}
            <ArrowRight size={15} strokeWidth={1.6} />
          </Link>
          <p className={s.securityContactText}>
            {copy.security.contactLabel} <a href="mailto:info@avenro.se">{copy.security.contactLink}</a>
          </p>
        </div>
      </section>
      <section id="faq" className={`${s.section} ${s.faqSection}`}><Heading copy={copy.faq} /><div className={s.faqList}>{copy.faq.items.map(item => <details key={item.question}><summary>{item.question}<ChevronDown size={18} /></summary><p>{item.answer}</p></details>)}</div></section>
      <section className={s.closingSection}>
        <div className={s.closingInner}><MiloLogo size={65} /><p className={styles.eyebrow}>{copy.closing.eyebrow}</p><h2>{copy.closing.title}</h2><p>{copy.closing.description}</p><div className={s.heroCtas}><a href={contact} className={styles.primaryButton}>{copy.closing.primaryCta}<ArrowRight size={17} /></a><a className={s.textLink} href="mailto:info@avenro.se">{copy.closing.secondaryCta}<ArrowRight size={16} /></a></div></div>
      </section>
    </main></StoryProvider>
    <footer className={s.footer}><div className={s.footerGrid}><div><Link href="/" aria-label="Avenro"><AvenroLogo className="h-10 w-auto" /></Link><p>{copy.footer.description}</p><MarketingLanguageSwitcher label={copy.nav.language} serverLanguage={language} /></div><div><h2>{copy.footer.product}</h2>{nav.map(item => <a href={`#${item.id}`} key={item.id}>{item.label}</a>)}<Link href="/login">{copy.nav.login}</Link></div><div><h2>{copy.footer.legal}</h2><Link href="/privacy-policy">{copy.footer.privacy}</Link><Link href="/terms-of-service">{copy.footer.terms}</Link><Link href="/data-processing">{copy.footer.dataProcessing}</Link><Link href="/subprocessors">{copy.footer.subprocessors}</Link><a href="mailto:info@avenro.se">{copy.footer.contact}</a></div></div><div className={s.footerBottom}><span>© {new Date().getFullYear()} Avenro. {copy.footer.rights}</span><a href="mailto:info@avenro.se">info@avenro.se</a></div></footer>
  </div>;
}
