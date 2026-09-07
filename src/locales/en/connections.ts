export const connections = {
  badge: "Integration access",
  title: "Connections",
  description:
    "Connect tools like Gmail, Slack, and Drive so Milo can help customers and use your business information.",
  syncStatus: "Sync Status",
  completeAuthFlow: "Finish connecting the account, then press Sync Status.",
  replaceFlowWarning:
    "This workspace already has a connected {integration} account. Completing auth will replace it.",
  disconnectSuccess: "Account disconnected.",
  loadError: "Failed to load connections.",
  startFlowError: "Failed to start the connection flow.",
  disconnectError: "Failed to disconnect the account.",
  lastSync: "Last sync {value}",
  statusReason: "Connection: {value}",
  connectionExpired: "This connection expired. Connect it again.",
  connectionSetupIncomplete: "Setup was not completed. Try connecting again.",
  connectionNeedsAttention: "This connection needs attention. Connect it again.",
  worksWithWebsiteChat: "Works with Website Chat",
  usedForKnowledge: "Used for Knowledge",
  noSyncYet: "No sync yet",
  connectedAccount: "Connected account",
  replacementHint: "Only one account can be connected for this integration in a workspace.",
  defaultAccountLabel: "Default account",
  disconnecting: "Disconnecting...",
  disconnect: "Disconnect",
  reconnect: "Reconnect",
  replaceAccount: "Replace account",
  connect: "Connect",
  shareAuthLink: "Create connection link",
  authLinksTitle: "Connection links",
  authLinksDescription:
    "Send a secure link to someone who needs to connect their account to this workspace.",
  authLinksEmpty: "No connection links yet.",
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
      "{workspace} is asking you to connect a {integration} account. You do not need an Avenro login.",
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
      "The provider flow returned, but Avenro could not sync the account status yet.",
  },
};
