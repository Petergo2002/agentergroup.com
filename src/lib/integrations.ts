export type SupportedIntegrationSlug = "gmail" | "googlecalendar" | "cal" | "googledrive" | "outlook";
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
  allowedChatTools: string[];
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
    allowedChatTools: ["GMAIL_SEND_EMAIL"],
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
    allowedChatTools: ["OUTLOOK_SEND_EMAIL"],
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
    allowedChatTools: [
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
    allowedChatTools: [
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
    allowedChatTools: [],
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

export function getAllowedChatToolsForToolkits(toolkitSlugs: string[]) {
  return Array.from(
    new Set(
      toolkitSlugs.flatMap(
        (toolkitSlug) => getSupportedIntegration(toolkitSlug)?.allowedChatTools ?? [],
      ),
    ),
  );
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
