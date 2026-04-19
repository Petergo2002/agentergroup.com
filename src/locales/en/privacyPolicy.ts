export const privacyPolicy = {
  metadataTitle: "Privacy Policy | Agentergroup",
  metadataDescription:
    "Public privacy policy for Agentergroup and Agentergroup-powered widgets.",
  badge: "Public Legal Page",
  title: "Privacy Policy",
  intro:
    "This page is public and does not require sign-in. It is intended to be linked from Agentergroup-powered widgets and related product surfaces so website visitors can understand how data may be processed.",
  lastUpdated: "Last updated: March 23, 2026",
  backToSignIn: "Back to sign in",
  languageLabel: "Language",
  languages: {
    en: "English",
    sv: "Svenska",
  },
  sections: [
    {
      title: "What this policy covers",
      body: [
        "This Privacy Policy explains how Agentergroup handles personal data when someone uses the Agentergroup platform, signs in to the workspace app, or interacts with an Agentergroup-powered widget on a website.",
        "It applies to workspace users, website visitors who chat with widgets, leads submitted through widgets, and related usage data generated while the service is used.",
      ],
    },
    {
      title: "Data we may process",
      body: [
        "We may process account details such as name, email address, workspace membership, and login metadata.",
        "For public widgets, we may process chat messages, lead form submissions, booking details, page URL, referrer, origin, timestamps, and related session data needed to run the conversation and support analytics.",
        "If a connected tool is used, relevant data may also be sent to the selected integration provider in order to complete the requested action.",
      ],
    },
    {
      title: "Why we process data",
      body: [
        "We process data to operate the product, authenticate users, store agent and widget configuration, run conversations, execute tool actions, improve reliability, and provide workspace analytics.",
        "For widgets specifically, data may also be processed so the widget can answer questions, qualify leads, capture contact information, and complete requested actions such as sending email or booking meetings.",
      ],
    },
    {
      title: "Processors and infrastructure",
      body: [
        "Agentergroup uses third-party infrastructure and subprocessors to deliver the service. This currently includes Supabase for database, auth, and storage, OpenRouter for LLM routing and model access, and Composio for connected tool authentication and tool execution.",
        "These providers may process personal data on our behalf to the extent necessary to deliver the service. Additional provider details are available to signed-in customers inside the platform.",
      ],
    },
    {
      title: "Public widget notice",
      body: [
        "If you use a website widget powered by Agentergroup, the website owner is typically the controller of the data collected through that widget, and Agentergroup acts as a processor or subprocessor for the service infrastructure.",
        "If you do not want personal information included in a widget conversation, please avoid entering sensitive personal data unless the website owner has clearly asked for it and provided a lawful basis for processing.",
      ],
    },
    {
      title: "Data sharing and transfers",
      body: [
        "We do not sell personal data. Data may be shared with subprocessors only where needed to run the platform, provide model responses, or execute connected tool actions requested by the workspace configuration.",
        "Depending on the selected providers and deployment setup, data may be processed outside the EU/EEA. Appropriate contractual and operational safeguards should be used where required.",
      ],
    },
    {
      title: "Retention",
      body: [
        "Agentergroup currently applies a default 180 day retention policy for widget sessions, widget session messages, widget leads, and widget session activity metadata used by public widgets.",
        "Imported knowledge sources and stored knowledge files remain in place until the workspace deletes them manually. Where a workspace or widget is deleted, associated data may also be removed subject to operational limits, backups, and legal retention requirements.",
      ],
    },
    {
      title: "Your rights",
      body: [
        "Depending on your location, you may have rights to request access, correction, deletion, restriction, objection, or portability of your personal data.",
        "If your data was collected through a customer widget, the fastest route is usually to contact the website owner first. You can also contact Agentergroup for platform-level privacy questions and public widget data handling support.",
      ],
    },
    {
      title: "Security",
      body: [
        "We use technical and organizational measures intended to protect personal data, including authenticated access controls, database security features, and controlled server-side access to privileged operations.",
        "No internet service can guarantee absolute security, so users should avoid sharing highly sensitive information unless it is strictly necessary and clearly expected.",
      ],
    },
    {
      title: "Contact",
      body: [
        "For privacy-related questions, access requests, or deletion requests, contact Agentergroup support at support@agentergroup.com or through the website where this service was provided.",
        "This policy may be updated from time to time as the product, providers, and legal requirements evolve.",
      ],
    },
  ],
};
