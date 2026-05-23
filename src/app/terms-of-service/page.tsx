import type { Metadata } from "next";
import {
  getMessages,
  resolvePlatformLanguage,
  type PlatformLanguage,
} from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Terms of Service | Agentergroup",
  description:
    "Public terms of service for Agentergroup and Agentergroup-powered widgets.",
};

export default async function TermsOfServicePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const defaultLanguage = await getServerLanguage();
  const language: PlatformLanguage = lang
    ? resolvePlatformLanguage(lang)
    : defaultLanguage;
  const copy = (await getMessages(language)).termsOfService;

  return (
    <LegalLayout
      copy={copy}
      language={language}
      pageType="terms-of-service"
    />
  );
}

