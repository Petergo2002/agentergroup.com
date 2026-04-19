export const subprocessors = {
  badge: "Kundefterlevnad",
  title: "Underbiträden",
  description:
    "Den här sidan är avsedd för inloggade kunder som behöver en överblick över de aktuella underbiträden som används för att leverera Agentergroup och Agentergroup-drivna widgets.",
  lastUpdated: "Senast uppdaterad: 23 mars 2026",
  backToSettings: "Tillbaka till inställningar",
  dataProcessing: "Databehandling",
  publicPrivacyPolicy: "Publik integritetspolicy",
  columns: {
    provider: "Leverantör",
    purpose: "Syfte",
    dataCategories: "Huvudsakliga datakategorier",
    regionNote: "Regionsnotering",
    officialLink: "Officiell länk",
  },
  providers: [
    {
      name: "Supabase",
      purpose: "Databas, autentisering, lagring och applikationsinfrastruktur.",
      data: "Workspace-poster, widgetsessioner, leads, kunskapsfiler och metadata för auth/konto.",
      region:
        "Leverantörens infrastruktur kan behandla data i flera regioner beroende på projektets upplägg.",
      link: "https://supabase.com/legal/privacy-policy",
      linkLabel: "Öppna referens",
    },
    {
      name: "OpenRouter",
      purpose: "Modellrouting och LLM-åtkomst för runtime-svar.",
      data: "Promptinnehåll, chattkontext, verktygsscheman och svarspayloads som behövs för att generera completions.",
      region:
        "Leverantörens routing beror på konfigurerade integritetsinställningar och modell-/leverantörstillgänglighet.",
      link: "https://openrouter.ai/privacy",
      linkLabel: "Öppna referens",
    },
    {
      name: "Composio",
      purpose: "Autentisering av anslutna konton och exekvering av tredjepartsverktyg.",
      data: "Auth-status för anslutna appar och de minsta action-payloads/resultat som krävs för att utföra åtgärder i Gmail, Google Calendar och Drive.",
      region:
        "Composios dokumentation anger att behandling huvudsakligen sker i USA.",
      link: "https://composio.dev/privacy-policy",
      linkLabel: "Öppna referens",
    },
  ],
};
