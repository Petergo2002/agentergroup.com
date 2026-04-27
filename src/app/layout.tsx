import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
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
  title: {
    default: "Agentergroup",
    template: "%s | Agentergroup",
  },
  description: "Build, manage, and deploy Agentergroup AI agents and widgets.",
  openGraph: {
    title: "Agentergroup",
    description: "Build, manage, and deploy Agentergroup AI agents and widgets.",
    siteName: "Agentergroup",
  },
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
    <html lang={language} suppressHydrationWarning>
      <head />
      <body
        suppressHydrationWarning
        className={`${manrope.variable} ${inter.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider initialLanguage={language} initialMessages={messages}>
            {children}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
