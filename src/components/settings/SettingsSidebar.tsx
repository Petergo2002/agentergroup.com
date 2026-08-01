"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Users, CreditCard } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { SELF_SERVE_BILLING_ENABLED } from "@/lib/billing-mode";

export function SettingsSidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const navItems = [
    { 
      name: t("settings.navigation.general") || "General", 
      href: "/settings", 
      icon: Settings,
      exact: true 
    },
    { 
      name: t("settings.navigation.team") || "Team", 
      href: "/settings/team", 
      icon: Users 
    },
    ...(SELF_SERVE_BILLING_ENABLED
      ? [{
          name: t("settings.navigation.billing") || "Billing",
          href: "/settings/billing",
          icon: CreditCard,
        }]
      : []),
  ];

  const isTeam = pathname?.startsWith("/settings/team");
  const isBilling = pathname?.startsWith("/settings/billing");
  const isGeneral = pathname?.startsWith("/settings") && !isTeam && !isBilling;

  return (
    <nav className="flex flex-col gap-1 p-4 lg:w-64 lg:p-6 lg:border-r lg:border-outline-variant/10 min-h-[calc(100vh-64px)]">
      <div className="mb-4 px-4 py-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">
          {t("settings.title") || "Settings"}
        </h2>
      </div>
      {navItems.map((item) => {
        const isActive = item.href === "/settings" 
          ? isGeneral 
          : pathname?.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
              isActive
                ? "bg-primary/10 text-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            }`}
          >
            {isActive && (
              <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-primary" />
            )}
            <Icon 
              className={`h-[1.125rem] w-[1.125rem] shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                isActive ? "text-primary" : "text-on-surface-variant/70 group-hover:text-primary"
              }`} 
              strokeWidth={isActive ? 2.5 : 2}
            />
            <span className={isActive ? "font-bold" : "font-medium"}>
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
