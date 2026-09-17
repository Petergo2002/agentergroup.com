"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import type { Messages } from "@/locales/en";
import type { PlatformLanguage } from "@/lib/i18n";
import styles from "./landing.module.css";
import { demoContactHref, marketingNavItems } from "./marketing-links";
import { MarketingLanguageSwitcher } from "./MarketingLanguageSwitcher";

interface MarketingMobileMenuProps {
  copy: Messages["landing"]["nav"];
  serverLanguage: PlatformLanguage;
}

export function MarketingMobileMenu({ copy, serverLanguage }: MarketingMobileMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target) &&
        !buttonRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const links = marketingNavItems(copy);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="relative lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.menuTrigger} inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--mkt-border)] bg-white text-[var(--mkt-ink)] hover:bg-[var(--mkt-soft)]`}
        aria-label={open ? copy.closeMenu : copy.openMenu}
        aria-expanded={open}
        aria-controls="marketing-mobile-navigation"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>

      {open ? (
        <>
        {/* The panel only ever renders after a click, so document.body exists here. */}
        {createPortal(<div className={styles.mobileMenuScrim} aria-hidden="true" />, document.body)}
        <div
          ref={menuRef}
          id="marketing-mobile-navigation"
          className={`${styles.mobileMenuPanel} absolute right-0 top-14 z-50 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-[var(--mkt-border)] bg-white p-3 shadow-[var(--mkt-shadow-lg)]`}
        >
          <nav aria-label={serverLanguage === "sv" ? "Mobilnavigation" : "Mobile navigation"}>
            <div className="grid gap-1">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  onClick={closeMenu}
                  className={`${styles.mobileMenuLink} rounded-xl px-4 py-3 text-sm font-semibold text-[var(--mkt-ink)] hover:bg-[var(--mkt-soft)]`}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </nav>

          <div className="my-3 h-px bg-[var(--mkt-border)]" />

          <div className="flex items-center justify-between gap-3 px-1">
            <MarketingLanguageSwitcher
              label={copy.language}
              serverLanguage={serverLanguage}
              compact
            />
            <Link
              href="/login"
              onClick={closeMenu}
              className="inline-flex min-h-11 items-center px-3 py-2 text-sm font-semibold text-[var(--mkt-muted)] hover:text-[var(--mkt-ink)]"
            >
              {copy.login}
            </Link>
          </div>

          <a
            href={demoContactHref(serverLanguage)}
            onClick={closeMenu}
            className={`${styles.primaryButton} mt-3 flex min-h-11 w-full px-4 py-3`}
          >
            {copy.getStarted}
          </a>
        </div>
        </>
      ) : null}
    </div>
  );
}
