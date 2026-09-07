export const connections = {
  badge: "Integrationsåtkomst",
  title: "Anslutningar",
  description:
    "Anslut verktyg som Gmail, Slack och Drive så att Milo kan hjälpa kunder och använda företagets information.",
  syncStatus: "Synka status",
  completeAuthFlow: "Slutför anslutningen av kontot och tryck sedan på Synka status.",
  replaceFlowWarning:
    "Det här workspacet har redan ett anslutet {integration}-konto. Om du slutför auth ersätts det.",
  disconnectSuccess: "Kontot kopplades från.",
  loadError: "Det gick inte att ladda anslutningar.",
  startFlowError: "Det gick inte att starta anslutningsflödet.",
  disconnectError: "Det gick inte att koppla från kontot.",
  lastSync: "Senaste synk {value}",
  statusReason: "Anslutning: {value}",
  connectionExpired: "Anslutningen har gått ut. Anslut den igen.",
  connectionSetupIncomplete: "Konfigurationen slutfördes inte. Försök ansluta igen.",
  connectionNeedsAttention: "Anslutningen behöver åtgärdas. Anslut den igen.",
  worksWithWebsiteChat: "Fungerar med webbchatten",
  usedForKnowledge: "Används för kunskap",
  noSyncYet: "Ingen synk ännu",
  connectedAccount: "Anslutet konto",
  replacementHint: "Endast ett konto kan vara anslutet för denna integration i ett workspace.",
  defaultAccountLabel: "Standardkonto",
  disconnecting: "Kopplar från...",
  disconnect: "Koppla från",
  reconnect: "Anslut igen",
  replaceAccount: "Byt konto",
  connect: "Anslut",
  shareAuthLink: "Skapa anslutningslänk",
  authLinksTitle: "Anslutningslänkar",
  authLinksDescription:
    "Skicka en säker länk till någon som behöver ansluta sitt konto till detta workspace.",
  authLinksEmpty: "Inga anslutningslänkar ännu.",
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
