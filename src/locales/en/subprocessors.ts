export const subprocessors = {
  badge: "Customer Compliance",
  title: "Subprocessors",
  description:
    "This page is intended for signed-in customers who need an overview of the current subprocessors used to deliver Avenro and Avenro-powered widgets.",
  lastUpdated: "Last updated: March 23, 2026",
  backToSettings: "Back to settings",
  dataProcessing: "Data processing",
  publicPrivacyPolicy: "Public privacy policy",
  columns: {
    provider: "Provider",
    purpose: "Purpose",
    dataCategories: "Main data categories",
    regionNote: "Region note",
    officialLink: "Official link",
  },
  providers: [
    {
      name: "Supabase",
      purpose: "Database, authentication, storage, and application infrastructure.",
      data: "Workspace records, widget sessions, leads, knowledge files, and auth/account metadata.",
      region:
        "Provider infrastructure may process data across multiple regions depending on project setup.",
      link: "https://supabase.com/legal/privacy-policy",
      linkLabel: "Open reference",
    },
    {
      name: "OpenRouter",
      purpose: "Model routing and LLM access for runtime responses.",
      data: "Prompt content, chat context, tool schemas, and response payloads needed to generate completions.",
      region:
        "Provider routing depends on configured privacy and model/provider availability.",
      link: "https://openrouter.ai/privacy",
      linkLabel: "Open reference",
    },
    {
      name: "Composio",
      purpose: "Connected account authentication and third-party tool execution.",
      data: "Connected app auth state and the minimum action payloads/results needed to execute Gmail, Google Calendar, and Drive actions.",
      region:
        "Composio documentation states processing primarily occurs in the United States.",
      link: "https://composio.dev/privacy-policy",
      linkLabel: "Open reference",
    },
  ],
};
