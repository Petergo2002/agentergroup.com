import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";
import { getMessages } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";
import { getSiteOrigin } from "@/lib/site-url";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getServerLanguage();
  const messages = await getMessages(language);
  const origin = getSiteOrigin();
  const { title, description } = messages.landing.metadata;

  return {
    metadataBase: new URL(origin),
    title: { absolute: title },
    description,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      url: "/",
      title,
      description,
      siteName: "Avenro",
      locale: language === "sv" ? "sv_SE" : "en_US",
      alternateLocale: language === "sv" ? ["en_US"] : ["sv_SE"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function Home() {
  const language = await getServerLanguage();
  const messages = await getMessages(language);

  return <LandingPage copy={messages.landing} language={language} />;
}
