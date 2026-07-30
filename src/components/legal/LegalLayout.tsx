"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

interface LegalSection {
  title: string;
  body: readonly string[];
}

interface LegalLanguages {
  en: string;
  sv: string;
}

interface LegalCopy {
  badge: string;
  title: string;
  intro: string;
  lastUpdated: string;
  languageLabel: string;
  languages: LegalLanguages;
  backToSignIn: string;
  sections: readonly LegalSection[];
}

interface LegalLayoutProps {
  copy: LegalCopy;
  language: "en" | "sv";
  pageType: "terms-of-service" | "privacy-policy";
}

/**
 * Premium reusable layout for Legal & Compliance pages.
 * Features:
 * - Desktop: Asymmetric two-column layout with vertical scrolling spy and unified timeline markers.
 * - Mobile: Glassmorphic sticky header with horizontal swiping pill index.
 * - Tactile segment controls, GPU-accelerated glows, and clean responsive design.
 */
export function LegalLayout({ copy, language, pageType }: LegalLayoutProps) {
  const [activeSection, setActiveSection] = useState<number>(0);
  const isManualScrolling = useRef<boolean>(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // Helper to generate unique section IDs
  const getSectionId = (index: number) => `legal-section-${index}`;

  // Interactive smooth scrolling when clicking a sidebar link
  const scrollToSection = (index: number) => {
    isManualScrolling.current = true;
    setActiveSection(index);

    const element = document.getElementById(getSectionId(index));
    if (element) {
      // Calculate scroll offset depending on device (mobile header height vs desktop gap)
      const isMobile = window.innerWidth < 1024;
      const yOffset = isMobile ? -130 : -40; 
      const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
      
      window.scrollTo({
        top: y,
        behavior: "smooth",
      });
    }

    // Debounce resetting manual scroll to let observer resume
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isManualScrolling.current = false;
    }, 850);
  };

  // IntersectionObserver for scrollspy
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-25% 0px -55% 0px", // Detect intersection in the active reading viewport zone
      threshold: 0,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      if (isManualScrolling.current) return;

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute("id");
          if (id) {
            const index = parseInt(id.replace("legal-section-", ""), 10);
            if (!isNaN(index)) {
              setActiveSection(index);
            }
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    copy.sections.forEach((_, index) => {
      const el = document.getElementById(getSectionId(index));
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, [copy.sections]);

  return (
    <main className="min-h-screen bg-background text-on-surface app-shell-gradient flex flex-col font-body antialiased relative selection:bg-primary/20 selection:text-primary">
      
      {/* Decorative Brand Accent Underlay */}
      <div className="absolute top-0 right-0 w-[45%] h-[400px] bg-[radial-gradient(circle_at_top_right,var(--primary-container),transparent_45%)] opacity-20 pointer-events-none dark:opacity-30" />
      <div className="absolute top-[20%] left-0 w-[30%] h-[500px] bg-[radial-gradient(circle_at_bottom_left,var(--primary),transparent_35%)] opacity-5 pointer-events-none dark:opacity-10" />

      {/* 📱 MOBILE ONLY: Glassmorphic Sticky Header & Swipeable Pill Index */}
      <header className="sticky top-0 z-40 lg:hidden w-full bg-background/80 backdrop-blur-md border-b border-outline py-3 px-4 flex flex-col gap-3.5 shadow-sm select-none animate-slide-up-fade">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link href="/login" className="focus:outline-none group">
              <BrandLogo className="h-6 w-auto text-on-surface hover:text-primary transition-colors duration-300" />
            </Link>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary border border-primary/20 bg-primary/5 px-2 py-0.5 rounded shadow-[0_1px_4px_rgba(255,92,0,0.06)]">
              {copy.badge}
            </span>
          </div>

          {/* Compact Mobile Language Switch Segment */}
          <div className="flex items-center p-0.5 rounded-lg border border-outline bg-surface-container-low text-[10px] font-bold shadow-tactile">
            <Link
              href={`/${pageType}?lang=en`}
              className={`px-2 py-1 rounded-md transition-all duration-200 ${
                language === "en" ? "app-selected-control font-extrabold" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              EN
            </Link>
            <Link
              href={`/${pageType}?lang=sv`}
              className={`px-2 py-1 rounded-md transition-all duration-200 ${
                language === "sv" ? "app-selected-control font-extrabold" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              SV
            </Link>
          </div>
        </div>

        {/* Horizontal Swipeable Section Nav */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 hide-scrollbar">
          {copy.sections.map((section, index) => {
            const isActive = activeSection === index;
            const formattedIndex = String(index + 1).padStart(2, "0");
            return (
              <button
                key={section.title}
                onClick={() => scrollToSection(index)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-300 focus:outline-none ${
                  isActive
                    ? "app-selected-control scale-95"
                    : "bg-surface-container-low border-outline text-on-surface-variant/90 hover:text-on-surface active:scale-95"
                }`}
              >
                <span className="font-mono text-[9px] text-primary">
                  {formattedIndex}
                </span>
                <span className="max-w-[120px] truncate">{section.title}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Grid Container (Includes top mobile spacer) */}
      <div className="mx-auto w-full max-w-7xl px-4 py-8 lg:py-24 lg:px-12 md:px-8 flex flex-col lg:flex-row gap-12 lg:gap-16">
        
        {/* Desktop Left Column: Sticky Control Hub */}
        <aside className="hidden lg:flex w-[320px] flex-shrink-0 lg:sticky lg:top-12 lg:h-[calc(100vh-6rem)] flex-col justify-between gap-10">
          
          {/* Top Panel: Logo & Navigation */}
          <div className="flex flex-col">
            
            {/* Header Brand Block */}
            <div className="flex flex-col gap-4 animate-slide-up-fade">
              <div className="flex items-center gap-3">
                <Link href="/login" className="focus:outline-none group">
                  <BrandLogo className="h-7 w-auto text-on-surface hover:text-primary transition-colors duration-300" />
                </Link>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-primary border border-primary/25 bg-primary/5 px-2.5 py-1 rounded-md shadow-[0_2px_8px_rgba(255,92,0,0.08)] select-none">
                  {copy.badge}
                </span>
              </div>
              
              <h1 className="text-3xl font-headline font-black tracking-tight mt-4 text-on-surface leading-none md:text-4xl">
                {copy.title}
              </h1>
              
              <p className="mt-4 text-xs leading-relaxed text-on-surface-variant font-medium max-w-md">
                {copy.intro}
              </p>
            </div>

            {/* ScrollSpy Vertical Timeline Link Swiper */}
            <nav className="flex flex-col gap-2 mt-10 overflow-y-auto max-h-[calc(100vh-28rem)] pr-2 hide-scrollbar pl-5 relative">
              {/* Timeline Track Line */}
              <div className="absolute left-[6px] top-3.5 bottom-3.5 w-[1.5px] bg-outline/50 dark:bg-outline/20" />
              
              {copy.sections.map((section, index) => {
                const isActive = activeSection === index;
                const formattedIndex = String(index + 1).padStart(2, "0");
                return (
                  <button
                    key={section.title}
                    onClick={() => scrollToSection(index)}
                    className={`flex items-center text-left py-1.5 px-3 text-[13px] font-medium tracking-tight rounded-lg transition-all duration-300 group focus:outline-none relative ${
                      isActive
                        ? "text-primary font-semibold translate-x-2"
                        : "text-on-surface-variant/85 hover:text-on-surface hover:translate-x-1"
                    }`}
                  >
                    {/* Active vertical timeline dot overlay */}
                    <span className={`absolute left-[-22px] top-1/2 -translate-y-1/2 w-[7px] h-[7px] rounded-full border transition-all duration-300 ${
                      isActive 
                        ? "bg-primary border-primary shadow-[0_0_8px_rgba(255,92,0,0.5)] scale-125" 
                        : "bg-background border-outline group-hover:border-on-surface-variant"
                    }`} />
                    
                    <span className={`text-[10px] mr-2.5 font-headline font-bold font-mono tracking-wider transition-colors ${
                      isActive ? "text-primary" : "text-on-surface-variant/50 group-hover:text-primary"
                    }`}>
                      {formattedIndex}
                    </span>
                    <span className="truncate">{section.title}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Panel: Interactive Controls */}
          <div className="flex flex-col gap-4 mt-auto animate-slide-up-fade">
            
            {/* Last Updated Label */}
            <div className="text-[11px] font-semibold text-on-surface-variant/70 flex items-center gap-1.5 bg-surface-container-low border border-outline px-3 py-2 rounded-lg w-fit shadow-tactile select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {copy.lastUpdated}
            </div>

            {/* Premium Switch Segment Language Selector */}
            <div className="flex items-center p-1 rounded-xl border border-outline bg-surface-container-low shadow-tactile w-full">
              <span className="text-[9px] uppercase font-black tracking-widest text-on-surface-variant/60 px-3 select-none">
                {copy.languageLabel}
              </span>
              
              <div className="flex items-center gap-1 flex-1">
                <Link
                  href={`/${pageType}?lang=en`}
                  className={`flex-1 text-center text-xs py-2 px-2.5 font-bold tracking-tight rounded-lg transition-all duration-300 ${
                    language === "en"
                      ? "bg-gradient-to-r from-primary to-primary-container text-white shadow-md font-extrabold transform scale-[1.02]"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                  }`}
                >
                  {copy.languages.en}
                </Link>
                
                <Link
                  href={`/${pageType}?lang=sv`}
                  className={`flex-1 text-center text-xs py-2 px-2.5 font-bold tracking-tight rounded-lg transition-all duration-300 ${
                    language === "sv"
                      ? "bg-gradient-to-r from-primary to-primary-container text-white shadow-md font-extrabold transform scale-[1.02]"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                  }`}
                >
                  {copy.languages.sv}
                </Link>
              </div>
            </div>

            {/* Back Button with Tactile Physical Hover */}
            <Link
              href="/login"
              className="group flex items-center justify-center gap-2 rounded-xl border border-outline bg-surface text-on-surface text-xs font-bold py-3.5 px-4 shadow-tactile hover:border-primary/40 hover:bg-surface-bright hover:shadow-[0_0_15px_rgba(255,92,0,0.08)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] focus:outline-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4 text-on-surface-variant group-hover:text-primary group-hover:-translate-x-0.5 transition-all duration-300"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              {copy.backToSignIn}
            </Link>
          </div>
        </aside>

        {/* Right Column: Flowing Legal Core */}
        <section className="flex-1 space-y-6 lg:space-y-8 max-w-3xl lg:mt-3">
          {copy.sections.map((section, index) => {
            const isActive = activeSection === index;
            const formattedIndex = String(index + 1).padStart(2, "0");
            
            return (
              <article
                key={section.title}
                id={getSectionId(index)}
                className={`rounded-2xl border bg-surface/40 p-6 md:p-10 shadow-tactile backdrop-blur-[8px] transition-all duration-500 relative overflow-hidden group/card ${
                  isActive
                    ? "border-primary/30 ring-1 ring-primary/10 bg-surface/75 scale-[1.01] shadow-premium"
                    : "border-outline hover:border-outline-variant/60 hover:bg-surface/50"
                }`}
              >
                {/* 🌟 Active left border accent bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-primary transition-all duration-500 origin-left ${
                  isActive ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                }`} />

                {/* Radial Glow Hover Effect */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--primary-container),transparent_45%)] opacity-0 group-hover/card:opacity-[0.03] transition-opacity duration-700 pointer-events-none" />

                {/* Swiss Grid Technical Massive Background Index */}
                <span className={`absolute right-6 top-6 text-6xl md:text-7xl font-headline font-black tracking-tighter select-none transition-colors duration-500 pointer-events-none opacity-10 font-mono ${
                  isActive ? "text-primary/15" : "text-on-surface-variant/10 group-hover/card:text-primary/10"
                }`}>
                  {formattedIndex}
                </span>

                {/* Content Details */}
                <div className="relative z-10 flex flex-col gap-4">
                  <h2 className={`font-headline text-lg font-extrabold tracking-tight sm:text-xl transition-colors duration-300 ${
                    isActive ? "text-primary" : "text-on-surface group-hover/card:text-primary"
                  }`}>
                    {section.title}
                  </h2>
                  
                  <div className="space-y-4 text-sm leading-relaxed text-on-surface-variant font-medium sm:text-[15px] max-w-none">
                    {section.body.map((paragraph, pIdx) => (
                      <p 
                        key={pIdx}
                        className="transition-colors duration-300 group-hover/card:text-on-surface-variant/95"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}

          {/* Mobile bottom back trigger - visible only on mobile since sidebar is hidden */}
          <div className="lg:hidden flex flex-col gap-4 pt-6">
            <Link
              href="/login"
              className="group flex items-center justify-center gap-2 rounded-xl border border-outline bg-surface text-on-surface text-xs font-bold py-3.5 px-4 shadow-tactile hover:border-primary/40 hover:bg-surface-bright hover:shadow-[0_0_15px_rgba(255,92,0,0.08)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] focus:outline-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4 text-on-surface-variant group-hover:text-primary group-hover:-translate-x-0.5 transition-all duration-300"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              {copy.backToSignIn}
            </Link>

            <div className="text-[11px] font-semibold text-on-surface-variant/70 flex items-center justify-center gap-1.5 bg-surface-container-low border border-outline px-3 py-2 rounded-lg w-full shadow-tactile select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {copy.lastUpdated}
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
