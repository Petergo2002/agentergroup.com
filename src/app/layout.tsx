import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import { getMessages } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent Platform",
  description: "Manage your platform preferences and workspace configuration.",
  icons: {
    icon: "/2.svg",
    shortcut: "/2.svg",
    apple: "/2.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getServerLanguage();
  const messages = await getMessages(language);

  return (
    <html lang={language}>
      <head />
      <body
        suppressHydrationWarning
        className={`${manrope.variable} ${inter.variable} antialiased`}
      >
        <LanguageProvider initialLanguage={language} initialMessages={messages}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
