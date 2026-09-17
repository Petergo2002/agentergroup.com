import { story } from "./landing-story";
import type { Messages } from "../en";

export const landing = {
  story,
  metadata: {
    title: "Milo — Din AI-medarbetare på webben | Avenro",
    description:
      "Förvandla webbplatsbesök till hjälpsamma samtal, kvalificerade leads och tydliga nästa steg med Milo, din AI-medarbetare från Avenro.",
  },
  nav: {
    howItWorks: "Så fungerar det",
    tools: "Verktyg",
    workspace: "Arbetsytan",
    security: "Säkerhet",
    faq: "Vanliga frågor",
    login: "Logga in",
    getStarted: "Boka demo",
    language: "Språk",
    openMenu: "Öppna navigering",
    closeMenu: "Stäng navigering",
  },
  hero: {
    eyebrow: "Möt Milo — din 24/7 AI-medarbetare",
    title: "MILO tar hand om besökarna på din hemsida.",
    description:
      "Den svarar med er kunskap, fångar nya möjligheter och bokar möten med era verktyg. En AI-medarbetare som hjälper besökaren hela vägen vidare.",
    primaryCta: "Boka demo",
    secondaryCta: "Se MILO i action",
    trustPoints: [
      "Utgår från godkänd kunskap",
      "Använder era anslutna verktyg",
      "Personlig uppsättning av Avenro",
    ],
  },
  security: {
    eyebrow: "Säkerhet och integritet",
    title: "Dina kundsamtal förtjänar omtanke.",
    description:
      "Konkreta skydd för din arbetsyta och verktyg som hjälper teamet att hantera kunddata ansvarsfullt.",
    items: [
      {
        title: "Integritetsverktyg för GDPR",
        description:
          "Arbetsytans ägare kan söka fram, exportera och radera besöksdata från publik webbchatt för att hantera integritetsförfrågningar.",
      },
      {
        title: "Åtkomstkontroll per arbetsyta",
        description:
          "Medlemsbehörigheter och databasregler styr åtkomsten till din arbetsyta. Känsliga inställningar är reserverade för ägare och administratörer.",
      },
      {
        title: "Skyddade chattbilagor",
        description:
          "Besökares filer lagras privat och delas via tidsbegränsade länkar, med kontroller av filtyp och storlek.",
      },
      {
        title: "Inbyggt skydd mot missbruk",
        description:
          "Publik webbchatt har anropsgränser och kortlivade åtkomsttoken. Du kan även begränsa var chatten får bäddas in.",
      },
      {
        title: "Spårbara integritetsåtgärder",
        description:
          "Sökningar, exporter, raderingar och lagringsrensningar registreras i arbetsytans granskningslogg för spårbarhet.",
      },
      {
        title: "Tydliga lagringsregler",
        description:
          "Publik webbchatt har en lagringspolicy på 180 dagar och verktyg för rensning. Importerad kunskap finns kvar tills din arbetsyta raderar den.",
      },
    ],
    policyLink: "Läs vår integritetspolicy",
    contactLabel: "Har ni särskilda säkerhetskrav?",
    contactLink: "Prata med oss",
  },
  faq: {
    eyebrow: "Vanliga frågor",
    title: "En tydlig start, med utrymme att växa.",
    items: [
      { question: "Hur kommer vi igång?", answer: "Kontakta Avenro för en personlig demo. Vi går igenom era behov och hjälper er att konfigurera kunskap, webbchatt och anslutna verktyg innan lansering." },
      {
        question: "Vad är Milo?",
        answer:
          "Milo är din kundnära AI-medarbetare i Avenro. Milo använder kunskapen och verktygen du godkänner för att hjälpa besökare via Webbchatt.",
      },
      {
        question: "Hur lär sig Milo om min verksamhet?",
        answer:
          "Du lägger till godkänt webbplatsinnehåll, dokument och svar i Kunskap. När Milo inte kan svara säkert kan frågan granskas innan ett nytt svar blir en del av kunskapen.",
      },
      {
        question: "Kan Milo använda våra befintliga verktyg?",
        answer:
          "Ja. Avenro har anslutningar för kommunikation, bokning, CRM, handel, marknadsföring och kunskapsflöden. Du bestämmer vilka anslutna verktyg Milo får använda.",
      },
      {
        question: "Kan jag lägga Webbchatt på en befintlig webbplats?",
        answer:
          "Ja. Webbchatt kan bäddas in på en befintlig webbplats med ett litet kodavsnitt eller delas som en fristående upplevelse via en egen länk. Ni väljer logotyp, varumärkesnamn, färger, ljus eller mörk yta, välkomsttext och om besökaren möts på svenska eller engelska.",
      },
      {
        question: "Vad gäller för GDPR, SOC 2 och HIPAA?",
        answer:
          "Avenro har integritetsverktyg som stödjer GDPR-relaterade förfrågningar om data från publik webbchatt. Efterlevnad beror också på hur din verksamhet samlar in och använder data, era avtal och era rutiner. Vi gör för närvarande inga anspråk på SOC 2-attestering eller HIPAA-efterlevnad. Kontakta oss om era krav innan ni använder Avenro för reglerade hälsouppgifter.",
      },
      {
        question: "Vad händer när Milo inte kan svaret?",
        answer:
          "Obesvarade kundfrågor kan visas under Förbättra Milo. Teamet granskar frågan, skriver rätt svar och bestämmer om det ska läggas till i Kunskap.",
      },
    ],
  },
  closing: {
    eyebrow: "Din nästa besökare söker redan efter hjälp",
    title: "Ge dem ett användbart nästa steg.",
    description:
      "Boka en personlig demo. Vi visar hur MILO kan hjälpa era besökare och hur vi sätter upp den för just er verksamhet.",
    primaryCta: "Boka demo",
    secondaryCta: "Kontakta oss",
  },
  footer: {
    description:
      "Avenro hjälper småföretag att göra webbplatssamtal till svar, leads och handling med Milo.",
    product: "Produkt",
    company: "Företag",
    legal: "Juridik",
    contact: "Kontakt",
    privacy: "Integritetspolicy",
    terms: "Användarvillkor",
    dataProcessing: "Databehandling",
    subprocessors: "Underleverantörer",
    rights: "Alla rättigheter förbehållna.",
  },
} as const satisfies Messages["landing"];
