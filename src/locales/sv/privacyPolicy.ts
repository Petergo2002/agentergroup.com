export const privacyPolicy = {
  metadataTitle: "Integritetspolicy | Avenro",
  metadataDescription:
    "Publik integritetspolicy för Avenro och Avenro-drivna widgets.",
  badge: "Publik juridisk sida",
  title: "Integritetspolicy",
  intro:
    "Den här sidan är publik och kräver ingen inloggning. Den är tänkt att länkas från Avenro-drivna widgets och relaterade produktytor så att besökare kan förstå hur data kan behandlas.",
  lastUpdated: "Senast uppdaterad: 23 mars 2026",
  backToSignIn: "Tillbaka till inloggning",
  languageLabel: "Språk",
  languages: {
    en: "English",
    sv: "Svenska",
  },
  sections: [
    {
      title: "Vad den här policyn omfattar",
      body: [
        "Den här integritetspolicyn förklarar hur Avenro hanterar personuppgifter när någon använder Avenros plattform, loggar in i workspace-appen eller interagerar med en Avenro-driven widget på en webbplats.",
        "Den gäller workspace-användare, webbplatsbesökare som chattar med widgets, leads som skickas via widgets och relaterad användningsdata som skapas när tjänsten används.",
      ],
    },
    {
      title: "Data we kan behandla",
      body: [
        "Vi kan behandla kontouppgifter som namn, e-postadress, workspace-medlemskap och inloggningsmetadata.",
        "För publika widgets kan vi behandla chattmeddelanden, leadformulär, bokningsdetaljer, sid-URL, referrer, origin, tidsstämplar och relaterad sessionsdata som behövs för att driva konversationen och stödja analys.",
        "Om ett anslutet verktyg används kan relevant data också skickas till vald integrationsleverantör för att slutföra den begärda åtgärden.",
      ],
    },
    {
      title: "Varför vi behandlar data",
      body: [
        "Vi behandlar data för att driva produkten, autentisera användare, lagra agent- och widgetkonfiguration, köra konversationer, utföra verktygsåtgärder, förbättra tillförlitlighet och ge workspace-analys.",
        "För widgets specifikt kan data också behandlas så att widgeten kan svara på frågor, kvalificera leads, samla kontaktuppgifter och utföra begärda åtgärder som att skicka e-post eller boka möten.",
      ],
    },
    {
      title: "Underbiträden och infrastruktur",
      body: [
        "Avenro använder tredjepartsinfrastruktur och underbiträden för att leverera tjänsten. Detta inkluderar för närvarande Supabase för databas, auth och lagring, OpenRouter för LLM-routing och modellåtkomst, samt Composio för auth av anslutna verktyg och tool execution.",
        "Dessa leverantörer kan behandla personuppgifter för vår räkning i den utsträckning som krävs för att leverera tjänsten. Ytterligare leverantörsdetaljer finns tillgängliga för inloggade kunder inne i plattformen.",
      ],
    },
    {
      title: "Information om publika widgets",
      body: [
        "Om du använder en webbplatswidget som drivs av Avenro är webbplatsägaren normalt personuppgiftsansvarig för den data som samlas in via widgeten, medan Avenro agerar som personuppgiftsbiträde eller underbiträde för tjänsteinfrastrukturen.",
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
        "Avenro tillämpar för närvarande en standardiserad lagringstid på 180 dagar för widget-sessioner, widgetmeddelanden, widget-leads och aktivitetsmetadata för publika widgets.",
        "Importerade kunskapskällor och lagrade kunskapsfiler ligger kvar tills workspacet raderar dem manuellt. När ett workspace eller en widget raderas kan tillhörande data också tas bort, med förbehåll för operativa begränsningar, backuper och rättsliga lagringskrav.",
      ],
    },
    {
      title: "Dina rättigheter",
      body: [
        "Beroende på var du befinner dig kan du ha rätt att begära tillgång, rättelse, radering, begränsning, invändning eller dataportabilitet för dina personuppgifter.",
        "Om din data samlades in via en kundwidget är det oftast snabbast att först kontakta webbplatsägaren. Du kan också kontakta Avenro för plattformsrelaterade integritetsfrågor och stöd kring publik widgetdata.",
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
        "För integritetsfrågor, begäran om tillgång eller radering, kontakta Avenro support på info@avenro.se eller via webbplatsen där tjänsten tillhandahölls.",
        "Den här policyn kan uppdateras över tid när produkten, leverantörerna och de rättsliga kraven utvecklas.",
      ],
    },
  ],
};
