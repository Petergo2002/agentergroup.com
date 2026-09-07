export const dataProcessing = {
  badge: "Kundefterlevnad",
  title: "Databehandling",
  description:
    "Den här sidan förklarar med tydligt språk hur Avenro för närvarande behandlar publik widgetdata och hur datan flödar genom produkten. Den är avsedd för inloggade kunder och compliance-granskningar.",
  lastUpdated: "Last updated: 23 mars 2026",
  backToSettings: "Tillbaka till inställningar",
  subprocessors: "Underbiträden",
  publicPrivacyPolicy: "Publik integritetspolicy",
  sections: [
    {
      title: "Roller som personuppgiftsansvarig och biträde",
      body: [
        "När en webbplatsbesökare interagerar med en Avenro-driven widget är webbplatsägaren vanligtvis personuppgiftsansvarig för det affärssyfte som ligger bakom konversationen.",
        "Avenro driver infrastrukturlagret som lagrar widgetkonfiguration, runtime-data för chatt, leadinsamling och analysrelaterad stöddata. I det sammanhanget agerar Avenro som personuppgiftsbiträde eller underbiträde beroende på kundrelationen.",
      ],
    },
    {
      title: "Vad publika widgets kan samla in",
      body: [
        "Publika widgets kan behandla chattmeddelanden, vald agentkontext, leadformulär, kontaktuppgifter, bokningsdetaljer, sessionsidentifierare, sid-URL, referrer, origin, tidsstämplar och metadata om sessionens aktivitet.",
        "Om ett workspace har anslutna verktyg för Gmail eller Google Calendar kan runtime även skicka de minsta åtgärdspayloads som krävs för att utföra e-post- eller bokningsåtgärder som begärs genom den konfigurerade agenten.",
      ],
    },
    {
      title: "Hur runtime fungerar",
      body: [
        "Widgetbesökare pratar med en Avenro-runtime och skickar modellförfrågningar via OpenRouter. Om agenten är konfigurerad med externa verktyg utförs dessa åtgärder via Composio.",
        "Analys- och inkorgsvyer byggs från widgetsessioner, meddelanden och leads som genereras av dessa publika konversationer.",
      ],
    },
    {
      title: "Lagringstid",
      body: [
        "Avenro tillämpar för närvarande en standardiserad lagringstid på 180 dagar för widget-sessioner, widgetmeddelanden, widget-leads och aktivitetsmetadata för widget-sessioner.",
        "Importerade kunskapskällor och lagrade kunskapsfiler sparas tills workspacet raderar dem manuellt.",
      ],
    },
    {
      title: "Integritetsförfrågningar",
      body: [
        "Om din data samlades in via en kundwidget är det normalt snabbast att först kontakta webbplatsägaren direkt.",
        "Avenro stödjer också plattformsnivåns hantering av integritetsärenden för publik widgetdata genom interna export- och raderingsflöden som bara är tillgängliga för ägare.",
      ],
    },
  ],
};
