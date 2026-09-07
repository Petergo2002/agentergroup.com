import type { Metadata } from "next";
import {
  getMessages,
  resolvePlatformLanguage,
  type PlatformLanguage,
} from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Public privacy policy for Avenro and Avenro-powered widgets.",
};

export default async function PrivacyPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const defaultLanguage = await getServerLanguage();
  const language: PlatformLanguage = lang
    ? resolvePlatformLanguage(lang)
    : defaultLanguage;
  const copy = (await getMessages(language)).privacyPolicy;

  return (
    <LegalLayout
      copy={copy}
      language={language}
      pageType="privacy-policy"
    />
  );
}
