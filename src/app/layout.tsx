import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import { headers } from "next/headers";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { getMessages } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";
import { getSiteOrigin } from "@/lib/site-url";
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
  metadataBase: new URL(getSiteOrigin()),
  title: {
    default: "Avenro",
    template: "%s | Avenro",
  },
  description: "Build, manage, and deploy Avenro AI agents and widgets.",
  openGraph: {
    title: "Avenro",
    description: "Build, manage, and deploy Avenro AI agents and widgets.",
    siteName: "Avenro",
  },
  icons: {
    icon: [
      { url: "/2.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/2.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const language = await getServerLanguage();
  const messages = await getMessages(language);

  return (
    <html lang={language} suppressHydrationWarning data-scroll-behavior="smooth">
      <head />
      <body
        suppressHydrationWarning
        className={`${manrope.variable} ${inter.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
          nonce={nonce}
        >
          <LanguageProvider initialLanguage={language} initialMessages={messages}>
            {children}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
