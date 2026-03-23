import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Agentergroup",
  description:
    "Public privacy policy for Agentergroup and Agentergroup-powered widgets.",
};

type PrivacyLanguage = "en" | "sv";

const COPY: Record<
  PrivacyLanguage,
  {
    badge: string;
    title: string;
    intro: string;
    lastUpdated: string;
    backToSignIn: string;
    languageLabel: string;
    sections: { title: string; body: string[] }[];
  }
> = {
  en: {
    badge: "Public Legal Page",
    title: "Privacy Policy",
    intro:
      "This page is public and does not require sign-in. It is intended to be linked from Agentergroup-powered widgets and related product surfaces so website visitors can understand how data may be processed.",
    lastUpdated: "Last updated: March 23, 2026",
    backToSignIn: "Back to sign in",
    languageLabel: "Language",
    sections: [
      {
        title: "What this policy covers",
        body: [
          "This Privacy Policy explains how Agentergroup handles personal data when someone uses the Agentergroup platform, signs in to the workspace app, or interacts with an Agentergroup-powered widget on a website.",
          "It applies to workspace users, website visitors who chat with widgets, leads submitted through widgets, and related usage data generated while the service is used.",
        ],
      },
      {
        title: "Data we may process",
        body: [
          "We may process account details such as name, email address, workspace membership, and login metadata.",
          "For public widgets, we may process chat messages, lead form submissions, booking details, page URL, referrer, origin, timestamps, and related session data needed to run the conversation and support analytics.",
          "If a connected tool is used, relevant data may also be sent to the selected integration provider in order to complete the requested action.",
        ],
      },
      {
        title: "Why we process data",
        body: [
          "We process data to operate the product, authenticate users, store agent and widget configuration, run conversations, execute tool actions, improve reliability, and provide workspace analytics.",
          "For widgets specifically, data may also be processed so the widget can answer questions, qualify leads, capture contact information, and complete requested actions such as sending email or booking meetings.",
        ],
      },
      {
        title: "Processors and infrastructure",
        body: [
          "Agentergroup uses third-party infrastructure and subprocessors to deliver the service. This currently includes Supabase for database, auth, and storage, OpenRouter for LLM routing and model access, and Composio for connected tool authentication and tool execution.",
          "These providers may process personal data on our behalf to the extent necessary to deliver the service. Additional provider details are available to signed-in customers inside the platform.",
        ],
      },
      {
        title: "Public widget notice",
        body: [
          "If you use a website widget powered by Agentergroup, the website owner is typically the controller of the data collected through that widget, and Agentergroup acts as a processor or subprocessor for the service infrastructure.",
          "If you do not want personal information included in a widget conversation, please avoid entering sensitive personal data unless the website owner has clearly asked for it and provided a lawful basis for processing.",
        ],
      },
      {
        title: "Data sharing and transfers",
        body: [
          "We do not sell personal data. Data may be shared with subprocessors only where needed to run the platform, provide model responses, or execute connected tool actions requested by the workspace configuration.",
          "Depending on the selected providers and deployment setup, data may be processed outside the EU/EEA. Appropriate contractual and operational safeguards should be used where required.",
        ],
      },
      {
        title: "Retention",
        body: [
          "Agentergroup currently applies a default 180 day retention policy for widget sessions, widget session messages, widget leads, and widget session activity metadata used by public widgets.",
          "Imported knowledge sources and stored knowledge files remain in place until the workspace deletes them manually. Where a workspace or widget is deleted, associated data may also be removed subject to operational limits, backups, and legal retention requirements.",
        ],
      },
      {
        title: "Your rights",
        body: [
          "Depending on your location, you may have rights to request access, correction, deletion, restriction, objection, or portability of your personal data.",
          "If your data was collected through a customer widget, the fastest route is usually to contact the website owner first. You can also contact Agentergroup for platform-level privacy questions and public widget data handling support.",
        ],
      },
      {
        title: "Security",
        body: [
          "We use technical and organizational measures intended to protect personal data, including authenticated access controls, database security features, and controlled server-side access to privileged operations.",
          "No internet service can guarantee absolute security, so users should avoid sharing highly sensitive information unless it is strictly necessary and clearly expected.",
        ],
      },
      {
        title: "Contact",
        body: [
          "For privacy-related questions, access requests, or deletion requests, contact Agentergroup support at support@agentergroup.com or through the website where this service was provided.",
          "This policy may be updated from time to time as the product, providers, and legal requirements evolve.",
        ],
      },
    ],
  },
  sv: {
    badge: "Publik juridisk sida",
    title: "Integritetspolicy",
    intro:
      "Den här sidan är publik och kräver ingen inloggning. Den är tänkt att länkas från Agentergroup-drivna widgets och relaterade produktytor så att besökare kan förstå hur data kan behandlas.",
    lastUpdated: "Senast uppdaterad: 23 mars 2026",
    backToSignIn: "Tillbaka till inloggning",
    languageLabel: "Språk",
    sections: [
      {
        title: "Vad den här policyn omfattar",
        body: [
          "Den här integritetspolicyn förklarar hur Agentergroup hanterar personuppgifter när någon använder Agentergroups plattform, loggar in i workspace-appen eller interagerar med en Agentergroup-driven widget på en webbplats.",
          "Den gäller workspace-användare, webbplatsbesökare som chattar med widgets, leads som skickas via widgets och relaterad användningsdata som skapas när tjänsten används.",
        ],
      },
      {
        title: "Vilken data vi kan behandla",
        body: [
          "Vi kan behandla kontouppgifter som namn, e-postadress, workspace-medlemskap och inloggningsmetadata.",
          "För publika widgets kan vi behandla chattmeddelanden, lead-formulär, bokningsuppgifter, sid-URL, referrer, origin, tidsstämplar och relaterad sessionsdata som behövs för att driva konversationen och stödja analytics.",
          "Om ett anslutet verktyg används kan relevant data också skickas till vald integrationsleverantör för att slutföra den begärda åtgärden.",
        ],
      },
      {
        title: "Varför vi behandlar data",
        body: [
          "Vi behandlar data för att driva produkten, autentisera användare, lagra agent- och widgetkonfiguration, köra konversationer, utföra tool actions, förbättra tillförlitlighet och ge workspace-analytics.",
          "För widgets specifikt kan data också behandlas för att widgeten ska kunna svara på frågor, kvalificera leads, samla in kontaktuppgifter och slutföra begärda åtgärder som att skicka e-post eller boka möten.",
        ],
      },
      {
        title: "Underbiträden och infrastruktur",
        body: [
          "Agentergroup använder tredjepartsinfrastruktur och underbiträden för att leverera tjänsten. Detta inkluderar för närvarande Supabase för databas, auth och lagring, OpenRouter för LLM-routing och modellåtkomst, samt Composio för auth av anslutna verktyg och tool execution.",
          "Dessa leverantörer kan behandla personuppgifter för vår räkning i den utsträckning som krävs för att leverera tjänsten. Ytterligare leverantörsdetaljer finns tillgängliga för inloggade kunder inne i plattformen.",
        ],
      },
      {
        title: "Information om publika widgets",
        body: [
          "Om du använder en webbplatswidget som drivs av Agentergroup är webbplatsägaren normalt personuppgiftsansvarig för den data som samlas in via widgeten, medan Agentergroup agerar som personuppgiftsbiträde eller underbiträde för tjänsteinfrastrukturen.",
          "Om du inte vill att personuppgifter ska ingå i en widgetkonversation bör du undvika att skriva in känsliga uppgifter om inte webbplatsägaren tydligt har efterfrågat det och angett en laglig grund för behandlingen.",
        ],
      },
      {
        title: "Delning och överföring av data",
        body: [
          "Vi säljer inte personuppgifter. Data kan delas med underbiträden endast när det behövs för att driva plattformen, ge modellsvar eller utföra anslutna tool actions som workspace-konfigurationen begär.",
          "Beroende på valda leverantörer och driftsättning kan data behandlas utanför EU/EES. Lämpliga avtalsmässiga och operativa skyddsåtgärder bör användas där det krävs.",
        ],
      },
      {
        title: "Lagringstid",
        body: [
          "Agentergroup tillämpar för närvarande en standardiserad lagringstid på 180 dagar för widget-sessioner, widgetmeddelanden, widget-leads och aktivitetsmetadata för publika widgets.",
          "Importerade kunskapskällor och lagrade kunskapsfiler ligger kvar tills workspacet raderar dem manuellt. När ett workspace eller en widget raderas kan tillhörande data också tas bort, med förbehåll för operativa begränsningar, backuper och rättsliga lagringskrav.",
        ],
      },
      {
        title: "Dina rättigheter",
        body: [
          "Beroende på var du befinner dig kan du ha rätt att begära tillgång, rättelse, radering, begränsning, invändning eller dataportabilitet för dina personuppgifter.",
          "Om din data samlades in via en kundwidget är det oftast snabbast att först kontakta webbplatsägaren. Du kan också kontakta Agentergroup för plattformsrelaterade integritetsfrågor och stöd kring publik widgetdata.",
        ],
      },
      {
        title: "Säkerhet",
        body: [
          "Vi använder tekniska och organisatoriska åtgärder som är avsedda att skydda personuppgifter, inklusive autentiserade åtkomstkontroller, databassäkerhetsfunktioner och kontrollerad server-side access till privilegierade operationer.",
          "Ingen internettjänst kan garantera absolut säkerhet, så användare bör undvika att dela mycket känslig information om det inte är strikt nödvändigt och tydligt förväntat.",
        ],
      },
      {
        title: "Kontakt",
        body: [
          "För integritetsfrågor, begäran om tillgång eller radering, kontakta Agentergroup support på support@agentergroup.com eller via webbplatsen där tjänsten tillhandahölls.",
          "Den här policyn kan uppdateras över tid när produkten, leverantörerna och de rättsliga kraven utvecklas.",
        ],
      },
    ],
  },
};

export default async function PrivacyPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const language: PrivacyLanguage = lang === "sv" ? "sv" : "en";
  const copy = COPY[language];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f8fb_0%,#eef2f6_100%)] text-on-surface">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-16 sm:px-8 sm:py-20">
        <div className="rounded-[28px] border border-outline-variant/20 bg-white/90 p-8 shadow-sm shadow-slate-200/60 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
            {copy.badge}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-on-surface sm:text-5xl">
            {copy.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-on-surface-variant sm:text-base">
            {copy.intro}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant sm:text-sm">
            <span className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5">
              {copy.lastUpdated}
            </span>
            <div className="inline-flex items-center gap-1 rounded-full border border-outline-variant/25 bg-surface p-1">
              <span className="px-2 text-[11px] font-medium text-on-surface-variant">
                {copy.languageLabel}
              </span>
              <Link
                href="/privacy-policy?lang=en"
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  language === "en"
                    ? "bg-on-surface text-background"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                English
              </Link>
              <Link
                href="/privacy-policy?lang=sv"
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  language === "sv"
                    ? "bg-on-surface text-background"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                Svenska
              </Link>
            </div>
            <Link
              href="/login"
              className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5 transition-colors hover:bg-surface-container"
            >
              {copy.backToSignIn}
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          {copy.sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[24px] border border-outline-variant/15 bg-white/85 p-6 shadow-sm shadow-slate-200/40 sm:p-7"
            >
              <h2 className="text-xl font-semibold tracking-tight text-on-surface">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-on-surface-variant sm:text-[15px]">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
