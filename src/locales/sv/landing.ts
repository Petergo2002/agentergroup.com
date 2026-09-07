import type { Messages } from "../en";

export const landing = {
  metadata: {
    title: "Milo — Din AI-medarbetare på webben | Avenro",
    description:
      "Förvandla webbplatsbesök till hjälpsamma samtal, kvalificerade leads och tydliga nästa steg med Milo, din AI-medarbetare från Avenro.",
  },
  nav: {
    product: "Produkt",
    howItWorks: "Så fungerar det",
    useCases: "Användningsområden",
    faq: "Vanliga frågor",
    login: "Logga in",
    getStarted: "Kom igång",
    language: "Språk",
    openMenu: "Öppna navigering",
    closeMenu: "Stäng navigering",
  },
  hero: {
    eyebrow: "Möt Milo — din 24/7 AI-medarbetare",
    title: "Gör webbplatsbesökare till kvalificerade leads & bokade möten.",
    description:
      "Milo är AI-medarbetaren för moderna verksamheter som svarar på kundfrågor från din godkända kunskap, kvalificerar leads och leder varje samtal till handling.",
    primaryCta: "Kom igång gratis",
    secondaryCta: "Se hur Milo fungerar",
    trustPoints: [
      "Utgår från godkänd kunskap",
      "Noll gissningar eller hallucinationer",
      "Igång på under 5 minuter",
    ],
  },
  preview: {
    browserLabel: "Live på din webbplats",
    websiteTitle: "Din verksamhet, redo att hjälpa",
    websiteDescription: "Tydliga svar. Personlig service. Ett enkelt nästa steg.",
    chatTitle: "Chatta med Milo",
    online: "Online nu",
    visitor: "Besökare",
    visitorMessage: "Kan du hjälpa mig att välja rätt tjänst?",
    miloMessage:
      "Självklart. Utifrån det du behöver verkar Tillväxtpaketet passa bäst. Vill du att jag söker efter en ledig tid?",
    inputPlaceholder: "Skriv ett meddelande…",
    knowledge: "Godkänd kunskap användes",
    lead: "Lead sparat",
    nextStep: "Mötestider föreslagna",
    scenarios: [
      {
        id: "qualify",
        chip: "Kvalificera lead",
        visitorMessage: "Kan du hjälpa mig att välja rätt plan för ett team på 10 personer?",
        miloMessage:
          "Självklart! Utifrån er teamstorlek passar Tillväxtpaketet bäst. Vill du att jag reserverar en snabb genomgång?",
        status: "Lead sparat",
        action: "Synkad till CRM",
      },
      {
        id: "knowledge",
        chip: "Snabba svar",
        visitorMessage: "Integrerar Milo med vår befintliga kalender och vårt CRM?",
        miloMessage:
          "Ja, Milo synkar direkt med Google Calendar, HubSpot, Slack och Shopify enligt era säkerhetsregler.",
        status: "Verifierad källa",
        action: "Svar på under 1s",
      },
      {
        id: "booking",
        chip: "Boka möte",
        visitorMessage: "Kan vi boka en 15-minuters rådgivning imorgon?",
        miloMessage:
          "Jag har lediga tider imorgon kl 10:00 och 14:30. Vilken tid passar dig bäst?",
        status: "Lead sparat",
        action: "Mötestider föreslagna",
      },
    ],
  },
  outcomes: {
    label: "En medarbetare. Tre affärsresultat.",
    items: [
      {
        title: "Svara direkt",
        description: "Ge besökare användbara svar grundade i verksamhetens godkända kunskap.",
      },
      {
        title: "Fånga möjligheter",
        description: "Gör samtal till kvalificerade leads utan ännu ett fristående formulär.",
      },
      {
        title: "Håll tempot",
        description: "Hjälp kunder vidare även när teamet är upptaget eller inte är på plats.",
      },
    ],
  },
  workflow: {
    eyebrow: "Från start till nytta",
    title: "Ge Milo kunskapen som din bästa medarbetare redan har.",
    description:
      "Börja med din information, anslut verktygen som spelar roll och publicera sedan en webbchatt som känns som en naturlig del av verksamheten.",
    steps: [
      {
        number: "01",
        title: "Lär upp Milo",
        description:
          "Lägg till godkända sidor, dokument och svar så att Milo utgår från information du litar på.",
      },
      {
        number: "02",
        title: "Anslut dina verktyg",
        description:
          "Låt Milo kontrollera tillgänglighet, skicka meddelanden eller uppdatera systemen teamet redan använder.",
      },
      {
        number: "03",
        title: "Publicera Webbchatt",
        description:
          "Anpassa upplevelsen till varumärket, lägg Milo på webbplatsen och hjälp besökare från första meddelandet.",
      },
    ],
  },
  product: {
    eyebrow: "Ett komplett kundflöde",
    title: "Mer än en chattbot. Ett system som blir bättre.",
    description:
      "Alla delar i Avenro samverkar kring en och samma Milo—från första svaret till uppföljningen och nästa förbättring.",
    features: [
      {
        title: "Kunskap",
        description: "Ge Milo en godkänd källa för korrekta svar som är specifika för din verksamhet.",
        meta: "Grundade svar",
      },
      {
        title: "Webbchatt",
        description: "Skapa en varumärkesanpassad kundupplevelse på din webbplats eller via en egen länk.",
        meta: "Ditt varumärke, din röst",
      },
      {
        title: "Leads",
        description: "Spara kontaktuppgifter tillsammans med samtalet som skapade affärsmöjligheten.",
        meta: "Kontext inkluderad",
      },
      {
        title: "Förbättra Milo",
        description: "Granska obesvarade frågor och gör godkända svar till återanvändbar kunskap.",
        meta: "Människogranskad inlärning",
      },
      {
        title: "Analys",
        description: "Se vad kunder frågar, vilka samtal som konverterar och var Milo behöver hjälp.",
        meta: "Tydliga kundsignaler",
      },
      {
        title: "Anslutningar",
        description: "Samla kommunikation, kalender, CRM, handel och kunskapsverktyg i en arbetsyta.",
        meta: "Användbara åtgärder",
      },
    ],
  },
  integrations: {
    eyebrow: "Passar ditt arbetssätt",
    title: "Milo kan göra mer än att svara.",
    description:
      "Anslut verktygen verksamheten redan använder så att ett bra samtal kan leda till ett konkret nästa steg.",
    names: [
      "Gmail",
      "Google Kalender",
      "Slack",
      "HubSpot",
      "Shopify",
      "Google Drive",
    ],
    note: "Anslutningar godkänns uttryckligen och hanteras från din arbetsyta.",
  },
  useCases: {
    eyebrow: "Byggd för vardagens arbete",
    title: "Placera Milo där samtal blir till arbete.",
    description:
      "Milo hjälper små team att svara snabbare utan att tappa den personliga kontext som får kunden att känna sig förstådd.",
    items: [
      {
        title: "Kvalificera nya leads",
        description:
          "Förstå vad besökaren behöver, samla rätt uppgifter och behåll hela samtalet inför uppföljningen.",
        result: "Från anonymt besök till användbar kontext",
      },
      {
        title: "Svara på kundfrågor",
        description:
          "Hantera återkommande frågor från godkänd information och lyft fram det som behöver ett mänskligt svar.",
        result: "Snabbare svar utan gissningar",
      },
      {
        title: "Boka nästa steg",
        description:
          "Kontrollera tillgänglighet och hjälp kvalificerade besökare gå från intresse till möte i samma samtal.",
        result: "Mindre mejlande fram och tillbaka",
      },
    ],
  },
  faq: {
    eyebrow: "Vanliga frågor",
    title: "En tydlig start, med utrymme att växa.",
    items: [
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
          "Ja. Webbchatt kan bäddas in på en befintlig webbplats med ett litet kodavsnitt eller delas som en fristående upplevelse via en egen länk.",
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
      "Samla din kunskap, Webbchatt, leads och anslutna verktyg kring en och samma AI-medarbetare.",
    primaryCta: "Kom igång med Milo",
    secondaryCta: "Logga in",
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
