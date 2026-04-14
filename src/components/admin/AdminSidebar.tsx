"use client";

import packageJson from "../../../package.json";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { ArrowLeft, LayoutGrid, Shield, Users } from "lucide-react";

export function AdminSidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const navItems = [
    { href: "/admin", label: t("admin.overviewTitle"), icon: LayoutGrid },
    { href: "/admin/customers", label: t("admin.customersBadge"), icon: Users },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-outline-variant/10 bg-surface-container-low px-4 py-6">
      <div className="px-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-on-surface-variant/50">
          {t("admin.sidebarTitle")}
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-outline-variant/10 bg-surface-container-high px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">
          <Shield className="h-3.5 w-3.5 text-primary" />
          {t("admin.internal")}
        </div>
      </div>

      <nav className="mt-8 space-y-1.5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname?.startsWith(item.href) ||
                pathname?.startsWith("/admin/workspaces/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-surface-container-highest text-on-surface"
                  : "text-on-surface-variant/70 hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              {isActive ? (
                <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
              ) : null}
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 px-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-on-surface-variant/50 transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          <span className="font-medium">{t("nav.backToApp")}</span>
        </Link>
        <div className="border-t border-outline-variant/5 pt-3 text-[11px] text-on-surface-variant/40">
          <p>{t("admin.internalDashboard")}</p>
          <p className="mt-1">{t("admin.webVersion", { version: packageJson.version })}</p>
        </div>
      </div>
    </aside>
  );
}
