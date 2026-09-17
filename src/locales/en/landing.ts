import { story } from "./landing-story";
export const landing = {
  story,
  metadata: {
    title: "Milo — Your AI employee for the web | Avenro",
    description:
      "Turn website visits into helpful conversations, qualified leads, and clear next steps with Milo, your AI employee from Avenro.",
  },
  nav: {
    howItWorks: "How it works",
    tools: "Tools",
    workspace: "Workspace",
    security: "Security",
    faq: "FAQ",
    login: "Log in",
    getStarted: "Book a demo",
    language: "Language",
    openMenu: "Open navigation",
    closeMenu: "Close navigation",
  },
  hero: {
    eyebrow: "Meet Milo — your 24/7 AI employee",
    title: "MILO takes care of the visitors on your website.",
    description:
      "It answers using your knowledge, captures new opportunities and books meetings with your tools. An AI employee that helps visitors take the next step.",
    primaryCta: "Book a demo",
    secondaryCta: "See MILO in action",
    trustPoints: [
      "Grounded in verified knowledge",
      "Uses your connected tools",
      "Personal setup by Avenro",
    ],
  },
  security: {
    eyebrow: "Security & privacy",
    title: "Your customer conversations deserve care.",
    description:
      "Practical protections for your workspace, with tools to help your team handle customer data responsibly.",
    items: [
      {
        title: "GDPR privacy tools",
        description:
          "Workspace owners can find, export, and delete public chat visitor data to help respond to privacy requests.",
      },
      {
        title: "Workspace access controls",
        description:
          "Member permissions and database access rules scope access to your workspace. Sensitive settings are reserved for owners and admins.",
      },
      {
        title: "Protected chat attachments",
        description:
          "Visitor uploads use private storage and expiring file links, with checks on file type and size.",
      },
      {
        title: "Built-in abuse protections",
        description:
          "Public chat uses request limits and short-lived access tokens. You can also restrict where your chat is embedded.",
      },
      {
        title: "Privacy audit records",
        description:
          "Privacy lookups, exports, deletions, and retention runs create workspace audit records for traceability.",
      },
      {
        title: "Defined retention controls",
        description:
          "Public chat has a 180-day retention policy and cleanup tooling. Imported knowledge stays until your workspace deletes it.",
      },
    ],
    policyLink: "Read our privacy policy",
    contactLabel: "Have specific security requirements?",
    contactLink: "Talk to us",
  },
  faq: {
    eyebrow: "Common questions",
    title: "A clear start, with room to grow.",
    items: [
      { question: "How do we get started?", answer: "Contact Avenro for a personal demo. We discuss your needs and help configure knowledge, website chat and connected tools before launch." },
      {
        question: "What is Milo?",
        answer:
          "Milo is your customer-facing AI employee inside Avenro. It uses the knowledge and tools you approve to help visitors through Website Chat.",
      },
      {
        question: "How does Milo learn about my business?",
        answer:
          "You add approved website content, documents, and answers to Knowledge. When Milo cannot answer confidently, the question can be reviewed before a new answer becomes part of that knowledge.",
      },
      {
        question: "Can Milo use our existing tools?",
        answer:
          "Yes. Avenro supports connections for communication, scheduling, CRM, commerce, marketing, and knowledge workflows. You decide which connected tools Milo may use.",
      },
      {
        question: "Can I add Website Chat to an existing site?",
        answer:
          "Yes. Website Chat can be embedded into an existing website with a small loader snippet, or shared as a hosted standalone experience. You choose its logo, brand name, colours, light or dark surface, welcome copy, and whether it greets visitors in Swedish or English.",
      },
      {
        question: "What about GDPR, SOC 2, and HIPAA?",
        answer:
          "Avenro provides privacy tools that support GDPR-related requests for public chat data. Compliance also depends on how your business collects and uses data, its agreements, and its operating procedures. We do not currently claim SOC 2 attestation or HIPAA compliance. Contact us to discuss your requirements before using Avenro for regulated health data.",
      },
      {
        question: "What happens when Milo does not know the answer?",
        answer:
          "Unanswered customer questions can appear in Improve Milo. Your team reviews the question, writes the correct answer, and decides whether to add it to Knowledge.",
      },
    ],
  },
  closing: {
    eyebrow: "Your next visitor is already looking for help",
    title: "Give them a useful next step.",
    description:
      "Book a personal demo. We’ll show you how MILO can help your visitors and how we set it up for your business.",
    primaryCta: "Book a demo",
    secondaryCta: "Contact us",
  },
  footer: {
    description:
      "Avenro helps small businesses turn website conversations into answers, leads, and action with Milo.",
    product: "Product",
    company: "Company",
    legal: "Legal",
    contact: "Contact",
    privacy: "Privacy policy",
    terms: "Terms of service",
    dataProcessing: "Data processing",
    subprocessors: "Subprocessors",
    rights: "All rights reserved.",
  },
} as const;
