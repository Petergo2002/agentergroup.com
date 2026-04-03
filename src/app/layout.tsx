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
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getServerLanguage();
  const messages = {
    en: getMessages("en"),
    sv: getMessages("sv"),
  } as const;

  return (
    <html lang={language}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${manrope.variable} ${inter.variable} antialiased`}
      >
        <LanguageProvider initialLanguage={language} messages={messages}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
