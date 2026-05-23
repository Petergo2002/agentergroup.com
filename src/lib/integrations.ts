export type SupportedIntegrationSlug = "gmail" | "googlecalendar" | "cal" | "googledrive" | "outlook" | "slack" | "hubspot" | "shopify" | "googleads";
export type InternalAssistantToolkitSlug = "text_to_pdf";
export type IntegrationSurface = "chat" | "knowledge";

export interface SupportedIntegration {
  slug: SupportedIntegrationSlug;
  displayName: string;
  description: string;
  icon: string;
  simpleIcon?: string;
  simpleIconColor?: string;
  category: string;
  connectionPurpose: string;
  surface: IntegrationSurface;
  recommendedChatTools: string[];
  allowedKnowledgeTools: string[];
}

export interface InternalAssistantToolkit {
  slug: InternalAssistantToolkitSlug;
  displayName: string;
  description: string;
}

export const SUPPORTED_INTEGRATIONS: SupportedIntegration[] = [
  {
    slug: "gmail",
    displayName: "Gmail",
    description: "Send emails during the current conversation.",
    icon: "mail",
    simpleIcon: "siGmail",
    simpleIconColor: "#EA4335",
    category: "Communication",
    connectionPurpose: "Used by agents to send emails during the current conversation.",
    surface: "chat",
    recommendedChatTools: ["GMAIL_SEND_EMAIL"],
    allowedKnowledgeTools: [],
  },
  {
    slug: "outlook",
    displayName: "Microsoft Outlook",
    description: "Send emails during the current conversation via Outlook.",
    icon: "mail",
    simpleIcon: "siMicrosoftoutlook",
    simpleIconColor: "#0078D4",
    category: "Communication",
    connectionPurpose: "Used by agents to send emails during the current conversation.",
    surface: "chat",
    recommendedChatTools: ["OUTLOOK_SEND_EMAIL"],
    allowedKnowledgeTools: [],
  },
  {
    slug: "slack",
    displayName: "Slack",
    description: "Send messages and search workspace context in Slack.",
    icon: "tag",
    simpleIcon: "siSlack",
    simpleIconColor: "#4A154B",
    category: "Communication",
    connectionPurpose: "Used by agents to send messages and search Slack workspace context.",
    surface: "chat",
    recommendedChatTools: [
      "SLACK_SEND_MESSAGE",
      "SLACK_SEARCH_MESSAGES",
      "SLACK_FETCH_CONVERSATION_HISTORY",
      "SLACK_FIND_CHANNELS",
      "SLACK_FIND_USERS",
    ],
    allowedKnowledgeTools: [],
  },
  {
    slug: "hubspot",
    displayName: "HubSpot",
    description: "Create, search, and update CRM records in HubSpot.",
    icon: "hub",
    simpleIcon: "siHubspot",
    simpleIconColor: "#FF7A59",
    category: "CRM",
    connectionPurpose: "Used by agents to create, search, and update CRM records in HubSpot.",
    surface: "chat",
    recommendedChatTools: [
      "HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA",
      "HUBSPOT_LIST_CONTACTS",
      "HUBSPOT_CREATE_CONTACT",
      "HUBSPOT_UPDATE_CONTACT",
      "HUBSPOT_SEARCH_COMPANIES",
      "HUBSPOT_CREATE_COMPANY",
      "HUBSPOT_UPDATE_COMPANY",
      "HUBSPOT_SEARCH_DEALS",
      "HUBSPOT_CREATE_DEAL",
      "HUBSPOT_UPDATE_DEAL",
      "HUBSPOT_CREATE_TICKET",
      "HUBSPOT_CREATE_NOTE",
      "HUBSPOT_CREATE_TASK",
    ],
    allowedKnowledgeTools: [],
  },
  {
    slug: "shopify",
    displayName: "Shopify",
    description: "Read and manage store products, customers, orders, and draft orders in Shopify.",
    icon: "shopping_bag",
    simpleIcon: "siShopify",
    simpleIconColor: "#7AB55C",
    category: "Commerce",
    connectionPurpose: "Used by agents to read and manage Shopify store products, customers, orders, and draft orders.",
    surface: "chat",
    recommendedChatTools: [
      "SHOPIFY_GET_SHOP_DETAILS",
      "SHOPIFY_GET_PRODUCTS_PAGINATED",
      "SHOPIFY_COUNT_PRODUCTS",
      "SHOPIFY_LIST_CUSTOMERS",
      "SHOPIFY_CREATE_CUSTOMER",
      "SHOPIFY_UPDATE_CUSTOMER",
      "SHOPIFY_LIST_ORDERS",
      "SHOPIFY_LIST_DRAFT_ORDERS",
      "SHOPIFY_CREATE_DRAFT_ORDER",
      "SHOPIFY_UPDATE_DRAFT_ORDER",
      "SHOPIFY_LIST_INVENTORY_LEVELS",
      "SHOPIFY_CREATES_A_NEW_PRODUCT",
      "SHOPIFY_UPDATES_A_PRODUCT",
    ],
    allowedKnowledgeTools: [],
  },
  {
    slug: "googleads",
    displayName: "Google Ads",
    description: "Inspect Google Ads accounts, campaigns, customer lists, and GAQL reports.",
    icon: "ads_click",
    simpleIcon: "siGoogleads",
    simpleIconColor: "#4285F4",
    category: "Marketing",
    connectionPurpose: "Used by agents to inspect Google Ads accounts, campaigns, customer lists, and GAQL reports.",
    surface: "chat",
    recommendedChatTools: [
      "GOOGLEADS_LIST_ACCESSIBLE_CUSTOMERS",
      "GOOGLEADS_GET_CAMPAIGN_BY_ID",
      "GOOGLEADS_GET_CAMPAIGN_BY_NAME",
      "GOOGLEADS_GET_CUSTOMER_LISTS",
      "GOOGLEADS_SEARCH_STREAM_GAQL",
    ],
    allowedKnowledgeTools: [],
  },
  {
    slug: "googlecalendar",
    displayName: "Google Calendar",
    description: "Check availability and book meetings.",
    icon: "event",
    simpleIcon: "siGooglecalendar",
    simpleIconColor: "#4285F4",
    category: "Scheduling",
    connectionPurpose: "Used by agents to check availability and book meetings.",
    surface: "chat",
    recommendedChatTools: [
      "GOOGLECALENDAR_CREATE_EVENT",
      "GOOGLECALENDAR_QUICK_ADD",
      "GOOGLECALENDAR_GET_CURRENT_DATE_TIME",
      "GOOGLECALENDAR_FIND_FREE_SLOTS",
      "GOOGLECALENDAR_LIST_CALENDARS",
    ],
    allowedKnowledgeTools: [],
  },
  {
    slug: "cal",
    displayName: "Cal.com",
    description: "Check availability and book meetings with Cal.com.",
    icon: "event_available",
    simpleIcon: "siCalcom",
    simpleIconColor: "#22C55E",
    category: "Scheduling",
    connectionPurpose: "Used by agents to check availability and book meetings using Cal.com.",
    surface: "chat",
    recommendedChatTools: [
      "CAL_GET_AVAILABLE_SLOTS_INFO",
      "CAL_CREATE_BOOKING_VERSION_2",
    ],
    allowedKnowledgeTools: [],
  },
  {
    slug: "googledrive",
    displayName: "Google Drive",
    description: "Import selected files into the knowledge base.",
    icon: "cloud",
    simpleIcon: "siGoogledrive",
    simpleIconColor: "#4285F4",
    category: "Knowledge",
    connectionPurpose: "Used to import files into the knowledge base.",
    surface: "knowledge",
    recommendedChatTools: [],
    allowedKnowledgeTools: [
      "GOOGLEDRIVE_FIND_FILE",
      "GOOGLEDRIVE_GET_FILE_METADATA",
      "GOOGLEDRIVE_DOWNLOAD_FILE",
    ],
  },
];

export const INTERNAL_ASSISTANT_TOOLKITS: InternalAssistantToolkit[] = [
  {
    slug: "text_to_pdf",
    displayName: "Text to PDF",
    description: "Create downloadable PDF files directly from generated or pasted text.",
  },
];

const SUPPORTED_INTEGRATION_SLUGS = new Set(
  SUPPORTED_INTEGRATIONS.map((integration) => integration.slug),
);
const CHAT_INTEGRATION_SLUGS = new Set(
  SUPPORTED_INTEGRATIONS.filter((integration) => integration.surface === "chat").map(
    (integration) => integration.slug,
  ),
);
const INTERNAL_ASSISTANT_TOOLKIT_SLUGS = new Set(
  INTERNAL_ASSISTANT_TOOLKITS.map((toolkit) => toolkit.slug),
);

export const DRIVE_IMPORT_SUPPORTED_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.google-apps.document", // Google Docs
] as const;

export function getSupportedIntegration(slug: string) {
  return SUPPORTED_INTEGRATIONS.find((integration) => integration.slug === slug) ?? null;
}

export function isSupportedIntegrationSlug(slug: string): slug is SupportedIntegrationSlug {
  return SUPPORTED_INTEGRATION_SLUGS.has(slug as SupportedIntegrationSlug);
}

export function isChatIntegrationSlug(slug: string): slug is SupportedIntegrationSlug {
  return CHAT_INTEGRATION_SLUGS.has(slug as SupportedIntegrationSlug);
}

export function getRecommendedChatToolsForToolkit(toolkitSlug: string) {
  return getSupportedIntegration(toolkitSlug)?.recommendedChatTools ?? [];
}

export function getRecommendedChatToolsForToolkits(toolkitSlugs: string[]) {
  return Array.from(
    new Set(
      toolkitSlugs.flatMap(
        (toolkitSlug) => getRecommendedChatToolsForToolkit(toolkitSlug),
      ),
    ),
  );
}

export function getToolNamePrefixForToolkit(toolkitSlug: string) {
  switch (toolkitSlug) {
    case "gmail":
      return "GMAIL_";
    case "outlook":
      return "OUTLOOK_";
    case "slack":
      return "SLACK_";
    case "hubspot":
      return "HUBSPOT_";
    case "shopify":
      return "SHOPIFY_";
    case "googleads":
      return "GOOGLEADS_";
    case "googlecalendar":
      return "GOOGLECALENDAR_";
    case "cal":
      return "CAL_";
    default:
      return null;
  }
}

export function isToolNameForToolkit(toolName: string, toolkitSlug: string) {
  const prefix = getToolNamePrefixForToolkit(toolkitSlug);
  return Boolean(prefix && toolName.startsWith(prefix));
}

export function isInternalAssistantToolkitSlug(
  slug: string,
): slug is InternalAssistantToolkitSlug {
  return INTERNAL_ASSISTANT_TOOLKIT_SLUGS.has(slug as InternalAssistantToolkitSlug);
}

export function getInternalAssistantToolkitSlugs() {
  return INTERNAL_ASSISTANT_TOOLKITS.map((toolkit) => toolkit.slug);
}

export function getChatIntegrationSlugs() {
  return SUPPORTED_INTEGRATIONS.filter((integration) => integration.surface === "chat").map(
    (integration) => integration.slug,
  );
}

export function getKnowledgeIntegrationSlugs() {
  return SUPPORTED_INTEGRATIONS.filter((integration) => integration.surface === "knowledge").map(
    (integration) => integration.slug,
  );
}

export function getDriveImportMimeTypes() {
  return [...DRIVE_IMPORT_SUPPORTED_MIME_TYPES];
}
