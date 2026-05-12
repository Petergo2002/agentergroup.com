export const connections = {
  badge: "Integration access",
  title: "Connections",
  description:
    "Connect Gmail, Outlook, Slack, HubSpot, Shopify, Google Calendar, Cal.com, and Google Drive. Chat integrations power live agent actions, while Drive is reserved for knowledge imports.",
  syncStatus: "Sync Status",
  completeAuthFlow: "Complete the auth flow, then press Sync Status.",
  disconnectSuccess: "Account disconnected.",
  loadError: "Failed to load connections.",
  startFlowError: "Failed to start the connection flow.",
  disconnectError: "Failed to disconnect the account.",
  lastSync: "Last sync {value}",
  noSyncYet: "No sync yet",
  disconnecting: "Disconnecting...",
  disconnect: "Disconnect",
  reconnect: "Reconnect",
  connect: "Connect",
  shareAuthLink: "Share auth link",
  authLinksTitle: "Shared auth links",
  authLinksDescription:
    "Send a one-integration link to someone who needs to authorize their own provider account into this workspace.",
  authLinksEmpty: "No shared auth links yet.",
  authLinkCreated: "Connection auth link created.",
  authLinkRevoked: "Connection auth link revoked.",
  authLinkCreateError: "Failed to create connection auth link.",
  authLinkRevokeError: "Failed to revoke connection auth link.",
  authLinkCopyLabel: "Connection auth link",
  authLinkWarning:
    "Anyone with this link can connect that provider account to this workspace. Share it only with the person who should authorize the account.",
  authLinkExpires: "Expires {value}",
  authLinkCopied: "Connection link copied.",
  adminOnly: "Admin only",
  publicAuth: {
    title: "Connect account",
    description:
      "{workspace} is asking you to connect a {integration} account. You do not need an Agentergroup login.",
    request: "Request",
    connectButton: "Connect {integration}",
    starting: "Starting...",
    startError: "Failed to start the connection flow.",
    completedTitle: "Account connected",
    completedDescription:
      "The account is connected to the workspace. You can close this page.",
    expiredTitle: "Link expired",
    expiredDescription:
      "This connection link is no longer active. Ask the workspace admin for a new link.",
    revokedTitle: "Link revoked",
    revokedDescription:
      "This connection link was revoked by the workspace admin.",
    invalidTitle: "Link not found",
    invalidDescription:
      "This connection link is invalid or has already been removed.",
    disabledTitle: "Integration access disabled",
    disabledDescription:
      "This workspace does not currently have integration access enabled.",
    unsupportedTitle: "Unsupported integration",
    unsupportedDescription:
      "This connection link points to an integration that is no longer supported.",
    pendingTitle: "Connection still pending",
    pendingDescription:
      "We could not confirm the connected account yet. Tell the workspace admin to sync connection status.",
    errorTitle: "Could not verify connection",
    errorDescription:
      "The provider flow returned, but Agentergroup could not sync the account status yet.",
  },
};
