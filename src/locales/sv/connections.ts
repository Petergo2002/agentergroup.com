export const connections = {
  badge: "Integrationsåtkomst",
  title: "Anslutningar",
  description:
    "Anslut Gmail, Outlook, Slack, HubSpot, Shopify, Google Calendar, Cal.com och Google Drive. Varje workspace stöder ett anslutet konto per integration, så om du ansluter ett nytt konto för samma integration ersätts det nuvarande. Chattintegrationer driver liveåtgärder för agenter, medan Drive används för kunskapsimporter.",
  syncStatus: "Synka status",
  completeAuthFlow: "Slutför auth-flödet och tryck sedan på Synka status.",
  replaceFlowWarning:
    "Det här workspacet har redan ett anslutet {integration}-konto. Om du slutför auth ersätts det.",
  disconnectSuccess: "Kontot kopplades från.",
  loadError: "Det gick inte att ladda anslutningar.",
  startFlowError: "Det gick inte att starta anslutningsflödet.",
  disconnectError: "Det gick inte att koppla från kontot.",
  lastSync: "Senaste synk {value}",
  statusReason: "Anslutning: {value}",
  noSyncYet: "Ingen synk ännu",
  connectedAccount: "Anslutet konto",
  replacementHint: "Endast ett konto kan vara anslutet för denna integration i ett workspace.",
  defaultAccountLabel: "Standardkonto",
  disconnecting: "Kopplar från...",
  disconnect: "Koppla från",
  reconnect: "Anslut igen",
  replaceAccount: "Byt konto",
  connect: "Anslut",
  shareAuthLink: "Dela auth-länk",
  authLinksTitle: "Delade auth-länkar",
  authLinksDescription:
    "Skicka en integrationsspecifik länk till någon som behöver auktorisera sitt eget leverantörskonto till detta workspace.",
  authLinksEmpty: "Inga delade auth-länkar ännu.",
  authLinkCreated: "Auth-länk för anslutning skapad.",
  authLinkRevoked: "Auth-länken för anslutning återkallades.",
  authLinkCreateError: "Det gick inte att skapa auth-länk för anslutning.",
  authLinkRevokeError: "Det gick inte att återkalla auth-länken.",
  authLinkCopyLabel: "Auth-länk för anslutning",
  authLinkWarning:
    "Alla med den här länken kan ansluta leverantörskontot till detta workspace. Dela den bara med personen som ska auktorisera kontot.",
  authLinkExpires: "Går ut {value}",
  authLinkCopied: "Anslutningslänk kopierad.",
  adminOnly: "Endast admin",
  publicAuth: {
    title: "Anslut konto",
    description:
      "{workspace} ber dig att ansluta ett {integration}-konto. Du behöver ingen Agentergroup-inloggning.",
    request: "Förfrågan",
    connectButton: "Anslut {integration}",
    starting: "Startar...",
    startError: "Det gick inte att starta anslutningsflödet.",
    completedTitle: "Kontot är anslutet",
    completedDescription:
      "Kontot är anslutet till workspacet. Du kan stänga den här sidan.",
    expiredTitle: "Länken har gått ut",
    expiredDescription:
      "Den här anslutningslänken är inte längre aktiv. Be workspace-admin om en ny länk.",
    revokedTitle: "Länken är återkallad",
    revokedDescription:
      "Den här anslutningslänken har återkallats av workspace-admin.",
    invalidTitle: "Länken hittades inte",
    invalidDescription:
      "Den här anslutningslänken är ogiltig eller har redan tagits bort.",
    disabledTitle: "Integrationsåtkomst är avstängd",
    disabledDescription:
      "Det här workspacet har för närvarande inte integrationsåtkomst aktiverad.",
    unsupportedTitle: "Integration stöds inte",
    unsupportedDescription:
      "Den här anslutningslänken pekar på en integration som inte längre stöds.",
    pendingTitle: "Anslutningen väntar fortfarande",
    pendingDescription:
      "Vi kunde inte bekräfta det anslutna kontot ännu. Be workspace-admin synka anslutningsstatus.",
    errorTitle: "Kunde inte verifiera anslutningen",
    errorDescription:
      "Leverantörsflödet kom tillbaka, men Agentergroup kunde inte synka kontostatus ännu.",
  },
};
