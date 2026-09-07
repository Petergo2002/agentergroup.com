import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Cable,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  LifeBuoy,
  MessageCircleReply,
  MessageSquareText,
  Sparkles,
  Target,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { MiloLogo } from "@/components/brand/MiloLogo";
import { SimpleIcon, type SimpleIconKey } from "@/components/icons/SimpleIcon";
import type { PlatformLanguage } from "@/lib/i18n";
import type { Messages } from "@/locales/en";
import { DashboardHeroPreview } from "./DashboardHeroPreview";
import { InteractiveProductPreview } from "./InteractiveProductPreview";
import { MarketingLanguageSwitcher } from "./MarketingLanguageSwitcher";
import { MarketingMobileMenu } from "./MarketingMobileMenu";
import { MarketingMotion } from "./MarketingMotion";
import styles from "./landing.module.css";

interface LandingPageProps {
  copy: Messages["landing"];
  language: PlatformLanguage;
}

const featureIcons = [
  BookOpenCheck,
  MessageSquareText,
  UserRoundPlus,
  Sparkles,
  BarChart3,
  Cable,
] as const;

const outcomeIcons = [MessageCircleReply, Target, Clock3] as const;
const useCaseIcons = [UsersRound, LifeBuoy, CalendarCheck2] as const;

interface IntegrationItemConfig {
  iconKey: SimpleIconKey;
  brandColor: string;
  bgLight: string;
}

const integrationConfigs: readonly IntegrationItemConfig[] = [
  { iconKey: "siGmail", brandColor: "#EA4335", bgLight: "#fef2f2" },
  { iconKey: "siGooglecalendar", brandColor: "#4285F4", bgLight: "#eff6ff" },
  { iconKey: "siSlack", brandColor: "#4A154B", bgLight: "#fdf4ff" },
  { iconKey: "siHubspot", brandColor: "#FF7A59", bgLight: "#fff7ed" },
  { iconKey: "siShopify", brandColor: "#7AB55C", bgLight: "#f0fdf4" },
  { iconKey: "siGoogledrive", brandColor: "#0F9D58", bgLight: "#f0fdf4" },
];

type MotionStyle = CSSProperties & { "--motion-order"?: number };

function motionOrder(order: number): MotionStyle {
  return { "--motion-order": order };
}

function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  centered?: boolean;
}) {
  return (
    <div
      data-reveal
      className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}
    >
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 className={`${styles.sectionTitle} mt-4`}>{title}</h2>
      {description ? (
        <p className={`${styles.sectionLead} mt-5 ${centered ? "mx-auto" : ""}`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function LandingPage({ copy, language }: LandingPageProps) {
  const currentYear = new Date().getFullYear();

  // Split title to apply gradient styling to the primary outcome phrase
  const splitWord = language === "sv" ? " till " : " into ";
  const titleParts = copy.hero.title.split(splitWord);

  return (
    <div data-marketing-root className={`${styles.site} font-body`}>
      <MarketingMotion />
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-xl bg-[var(--mkt-ink)] px-4 py-3 text-sm font-bold text-white transition-transform focus:translate-y-0"
      >
        {language === "sv" ? "Hoppa till innehållet" : "Skip to content"}
      </a>

      <header className={`${styles.siteHeader} sticky top-0 z-40 border-b backdrop-blur-xl`}>
        <div className={styles.scrollProgressTrack} aria-hidden="true">
          <div className={styles.scrollProgressBar} />
        </div>
        <div className="mx-auto flex h-[4.75rem] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Agentergroup" className={`${styles.brandLink} shrink-0 rounded-lg`}>
            <BrandLogo className="h-9 w-auto text-[var(--mkt-ink)] sm:h-10" />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {[
              ["#product", "product", copy.nav.product],
              ["#how-it-works", "how-it-works", copy.nav.howItWorks],
              ["#use-cases", "use-cases", copy.nav.useCases],
              ["#faq", "faq", copy.nav.faq],
            ].map(([href, sectionId, label]) => (
              <a
                key={href}
                href={href}
                data-nav={sectionId}
                className={`${styles.navLink} rounded-lg px-3.5 py-2.5 text-sm font-semibold text-[var(--mkt-muted)]`}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <MarketingLanguageSwitcher label={copy.nav.language} serverLanguage={language} />
            <Link
              href="/login"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--mkt-muted)] transition-colors hover:bg-white hover:text-[var(--mkt-ink)]"
            >
              {copy.nav.login}
            </Link>
            <Link
              href="/login?view=signup"
              className={`${styles.primaryButton} min-h-11 px-5 py-2.5`}
            >
              {copy.nav.getStarted}
            </Link>
          </div>

          <MarketingMobileMenu copy={copy.nav} serverLanguage={language} />
        </div>
      </header>

      <main id="main-content">
        <section className="relative px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-16 lg:px-8 lg:pb-28 lg:pt-20">
          <div className={`${styles.heroCopy} relative z-10 mx-auto max-w-4xl text-center`}>
            <div className={styles.heroBadge}>
              <MiloLogo size={18} className="h-[18px] w-[18px]" />
              {copy.hero.eyebrow}
            </div>
            <h1 className={`${styles.displayTitle} mx-auto mt-7 text-center`}>
              {titleParts.length === 2 ? (
                <>
                  {titleParts[0]}
                  {splitWord}
                  <span className={styles.heroHeadlineGradient}>{titleParts[1]}</span>
                </>
              ) : (
                copy.hero.title
              )}
            </h1>
            <p className={`${styles.heroLead} mx-auto mt-6 max-w-2xl text-center`}>
              {copy.hero.description}
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/login?view=signup"
                className={`${styles.primaryButton} min-h-12 gap-2 px-7 py-3`}
              >
                {copy.hero.primaryCta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#how-it-works"
                className={`${styles.secondaryButton} min-h-12 px-7 py-3`}
              >
                {copy.hero.secondaryCta}
              </a>
            </div>

            <ul className={styles.trustList} aria-label={language === "sv" ? "Tryggt att komma igång" : "Built for a confident start"}>
              {copy.hero.trustPoints.map((point) => (
                <li key={point}>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12 sm:mt-16">
            <DashboardHeroPreview />
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6 sm:pb-28 lg:px-8">
          <div data-reveal className="mx-auto max-w-7xl rounded-[1.6rem] border border-[var(--mkt-border)] bg-white p-5 shadow-[var(--mkt-shadow-sm)] sm:p-7 lg:p-8">
            <p className="mb-5 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--mkt-tertiary)] lg:text-left">
              {copy.outcomes.label}
            </p>
            <div className="grid divide-y divide-[var(--mkt-border)] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
              {copy.outcomes.items.map((item, index) => {
                const Icon = outcomeIcons[index];
                return (
                  <article key={item.title} className="flex gap-4 py-6 first:pt-2 last:pb-2 lg:px-8 lg:py-3 lg:first:pl-0 lg:last:pr-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--mkt-warm)] text-[var(--mkt-orange-text)]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--mkt-ink)]">{item.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-[var(--mkt-muted)]">{item.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-[var(--mkt-border)] bg-white px-4 py-24 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow={copy.workflow.eyebrow}
              title={copy.workflow.title}
              description={copy.workflow.description}
            />

            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {copy.workflow.steps.map((step, index) => (
                <article
                  key={step.number}
                  data-reveal
                  style={motionOrder(index)}
                  className={`${styles.workflowCard} relative overflow-hidden p-7 sm:p-8`}
                >
                  <div className="absolute right-5 top-2 font-headline text-[5.5rem] font-extrabold leading-none tracking-[-0.08em] text-black/[0.035]" aria-hidden="true">
                    {step.number}
                  </div>
                  <div className="relative">
                    <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-[var(--mkt-ink)] px-3 text-xs font-bold text-white">
                      {step.number}
                    </span>
                    <h3 className={`${styles.cardTitle} mt-8`}>
                      {step.title}
                    </h3>
                    <p className={`${styles.cardBody} mt-3`}>{step.description}</p>
                    {index < copy.workflow.steps.length - 1 ? (
                      <ArrowRight className="mt-7 hidden h-5 w-5 text-[var(--mkt-orange)] lg:block" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="mt-7 hidden h-5 w-5 text-[var(--mkt-success)] lg:block" aria-hidden="true" />
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="product" className="px-4 py-24 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow={copy.product.eyebrow}
              title={copy.product.title}
              description={copy.product.description}
              centered
            />

            <div className={`${styles.productGrid} mt-14`}>
              {copy.product.features.map((feature, index) => {
                const Icon = featureIcons[index];
                return (
                  <article
                    key={feature.title}
                    data-reveal
                    style={motionOrder(index % 4)}
                    className={`${styles.featureCard} p-7 sm:p-8`}
                  >
                    <div className={styles.featureVisual}>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--mkt-orange-text)] shadow-[0_1px_2px_rgba(24,24,24,0.06)]">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className={styles.featureMeta}>{feature.meta}</span>
                        <span className={styles.signalLine} aria-hidden="true" />
                        <span className={`${styles.signalLine} ${styles.signalLineShort}`} aria-hidden="true" />
                      </div>
                    </div>
                    <h3 className={`${styles.cardTitle} mt-7`}>
                      {feature.title}
                    </h3>
                    <p className={`${styles.cardBody} mt-3`}>{feature.description}</p>
                  </article>
                );
              })}
            </div>

            <div data-reveal className="mt-16 flex justify-center">
              <InteractiveProductPreview copy={copy.preview} />
            </div>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6 sm:pb-28 lg:px-8 lg:pb-32">
          <div data-reveal className={`${styles.integrationRail} mx-auto max-w-7xl overflow-hidden p-7 sm:p-10 lg:p-12`}>
            <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
              <SectionHeading
                eyebrow={copy.integrations.eyebrow}
                title={copy.integrations.title}
                description={copy.integrations.description}
              />

              <div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {copy.integrations.names.map((name, index) => {
                    const config = integrationConfigs[index] || integrationConfigs[0];
                    return (
                      <div key={name} className={styles.integrationTile}>
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-2xs"
                          style={{ backgroundColor: config.bgLight }}
                        >
                          <SimpleIcon
                            iconKey={config.iconKey}
                            color={config.brandColor}
                            size={18}
                            className="h-[18px] w-[18px]"
                          />
                        </span>
                        <span className="text-xs font-bold leading-4 text-[var(--mkt-ink)] sm:text-sm">{name}</span>
                        <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[var(--mkt-success)]" aria-hidden="true" />
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[var(--mkt-muted)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mkt-success)]" aria-hidden="true" />
                  {copy.integrations.note}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="use-cases" className="border-y border-[var(--mkt-border)] bg-white px-4 py-24 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow={copy.useCases.eyebrow}
              title={copy.useCases.title}
              description={copy.useCases.description}
              centered
            />

            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {copy.useCases.items.map((item, index) => {
                const Icon = useCaseIcons[index];
                return (
                  <article
                    key={item.title}
                    data-reveal
                    style={motionOrder(index)}
                    className={`${styles.useCaseCard} flex min-h-full flex-col p-7 sm:p-8`}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--mkt-ink)] text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className={`${styles.cardTitle} mt-8`}>{item.title}</h3>
                    <p className={`${styles.cardBody} mt-3 flex-1`}>{item.description}</p>
                    <p className="mt-7 flex items-center gap-2 border-t border-[var(--mkt-border)] pt-5 text-xs font-bold text-[var(--mkt-ink)]">
                      <CheckCircle2 className="h-4 w-4 text-[var(--mkt-orange-text)]" aria-hidden="true" />
                      {item.result}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="faq" className="px-4 py-24 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
            <SectionHeading eyebrow={copy.faq.eyebrow} title={copy.faq.title} />

            <div data-reveal className="divide-y divide-[var(--mkt-border)] border-y border-[var(--mkt-border)]">
              {copy.faq.items.map((item) => (
                <details key={item.question} className={`${styles.faqItem} group py-1`}>
                  <summary className={`${styles.faqSummary} flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-2 py-5 text-left text-base font-semibold text-[var(--mkt-ink)] marker:hidden sm:px-3 sm:py-6 sm:text-lg`}>
                    {item.question}
                    <span className={`${styles.faqChevron} flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[var(--mkt-muted)] group-open:rotate-180`}>
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </summary>
                  <p className={`${styles.faqAnswer} max-w-2xl px-2 pb-6 pr-12 text-sm leading-7 text-[var(--mkt-muted)] sm:px-3 sm:text-base sm:leading-8`}>
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6 sm:pb-28 lg:px-8 lg:pb-32">
          <div data-reveal className={`${styles.ctaPanel} relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] px-6 py-16 text-center shadow-[var(--mkt-shadow-lg)] sm:px-10 sm:py-20 lg:px-16 lg:py-24`}>
            <div className="relative z-10 mx-auto max-w-3xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--mkt-orange)] text-[var(--mkt-ink)]">
                <MiloLogo size={36} color="var(--mkt-ink)" className="h-9 w-9" />
              </div>
              <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.22em] text-[#ff9a5f]">
                {copy.closing.eyebrow}
              </p>
              <h2 className="mt-4 font-headline text-3xl font-extrabold leading-tight tracking-[-0.04em] text-white sm:text-5xl">
                {copy.closing.title}
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
                {copy.closing.description}
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/login?view=signup"
                  className={`${styles.primaryButton} min-h-12 gap-2 px-6 py-3`}
                >
                  {copy.closing.primaryCta}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/18 bg-white/8 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/14"
                >
                  {copy.closing.secondaryCta}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--mkt-border)] bg-white px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.5fr_0.7fr_0.8fr] lg:gap-16">
            <div>
              <BrandLogo className="h-10 w-auto text-[var(--mkt-ink)]" />
              <p className="mt-5 max-w-md text-sm leading-7 text-[var(--mkt-muted)]">{copy.footer.description}</p>
              <div className="mt-6">
                <MarketingLanguageSwitcher label={copy.nav.language} serverLanguage={language} />
              </div>
            </div>

            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mkt-ink)]">{copy.footer.product}</h2>
              <div className="mt-5 grid gap-3 text-sm text-[var(--mkt-muted)]">
                <a href="#product" className="w-fit hover:text-[var(--mkt-ink)]">{copy.nav.product}</a>
                <a href="#how-it-works" className="w-fit hover:text-[var(--mkt-ink)]">{copy.nav.howItWorks}</a>
                <a href="#use-cases" className="w-fit hover:text-[var(--mkt-ink)]">{copy.nav.useCases}</a>
                <Link href="/login" className="w-fit hover:text-[var(--mkt-ink)]">{copy.nav.login}</Link>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mkt-ink)]">{copy.footer.legal}</h2>
              <div className="mt-5 grid gap-3 text-sm text-[var(--mkt-muted)]">
                <Link href="/privacy-policy" className="w-fit hover:text-[var(--mkt-ink)]">{copy.footer.privacy}</Link>
                <Link href="/terms-of-service" className="w-fit hover:text-[var(--mkt-ink)]">{copy.footer.terms}</Link>
                <Link href="/data-processing" className="w-fit hover:text-[var(--mkt-ink)]">{copy.footer.dataProcessing}</Link>
                <Link href="/subprocessors" className="w-fit hover:text-[var(--mkt-ink)]">{copy.footer.subprocessors}</Link>
                <a href="mailto:info@avenro.se" className="w-fit hover:text-[var(--mkt-ink)]">{copy.footer.contact}</a>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-[var(--mkt-border)] pt-6 text-xs text-[var(--mkt-muted)] sm:flex-row sm:items-center sm:justify-between">
            <p>© {currentYear} Agentergroup. {copy.footer.rights}</p>
            <p className="flex items-center gap-2">
              <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
              info@avenro.se
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
