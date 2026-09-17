import type { PlatformLanguage } from "@/lib/i18n";
import type { Messages } from "@/locales/en";

export function demoContactHref(language: PlatformLanguage) {
  const subject = language === "sv" ? "Boka en demo av MILO" : "Book a MILO demo";
  const body = language === "sv"
    ? "Hej Avenro!\n\nVi vill gärna boka en personlig demo av MILO.\n\nFöretag:\nWebbplats:\nDet här vill vi ha hjälp med:\n"
    : "Hello Avenro!\n\nWe would like to book a personal MILO demo.\n\nCompany:\nWebsite:\nWhat we would like help with:\n";
  return `mailto:info@avenro.se?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * One navigation list for the header, the mobile menu and the footer, in page
 * order, so the scroll-spy indicator moves left to right as the story unfolds.
 * Each id must match a section id in LandingPage.
 */
export function marketingNavItems(copy: Messages["landing"]["nav"]) {
  return [
    { id: "how-it-works", label: copy.howItWorks },
    { id: "integrations", label: copy.tools },
    { id: "workspace", label: copy.workspace },
    { id: "security", label: copy.security },
    { id: "faq", label: copy.faq },
  ];
}
