"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Building2, Check, ChevronDown, Plus, X } from "lucide-react";
import { useAppContext } from "@/components/app/AppContext";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useToast } from "@/components/ui/ToastProvider";

interface WorkspaceSwitcherProps {
  variant?: "topbar" | "sidebar" | "sidebar-header";
}

export function WorkspaceSwitcher({
  variant = "topbar",
}: WorkspaceSwitcherProps) {
  const { workspace, membership, workspaces } = useAppContext();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sectionLabel = (() => {
    if (!pathname) return t("nav.workspace");
    if (pathname.startsWith("/dashboard")) return t("nav.dashboard");
    if (pathname.startsWith("/analytics")) return t("nav.analytics");
    if (pathname.startsWith("/agents")) return t("nav.agents");
    if (pathname.startsWith("/knowledge")) return t("nav.knowledge");
    if (pathname.startsWith("/connections")) return t("nav.connections");
    if (pathname.startsWith("/settings")) return t("nav.settings");
    return t("nav.workspace");
  })();
  const isSidebarVariant = variant === "sidebar";
  const isSidebarHeaderVariant = variant === "sidebar-header";
  const roleLabel = t(`roles.${membership.role}Lower`);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleWorkspaceSwitch(workspaceId: string) {
    if (workspaceId === workspace.id || isSubmitting) {
      setIsOpen(false);
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/workspaces/active", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workspaceId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t("settings.saveError"));
      }

      setIsOpen(false);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("settings.saveError"),
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? t("settings.saveError"));
      }

      setName("");
      setDescription("");
      setIsOpen(false);
      router.push("/dashboard");
      router.refresh();
      showToast(t("settings.workspaceCreated"), "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("settings.saveError"),
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className={isSidebarVariant || isSidebarHeaderVariant ? "relative w-full" : "relative flex min-w-0 items-center gap-3"}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`group flex items-center ${isSidebarHeaderVariant ? "gap-2.5" : "gap-3"} text-left ${
          isSidebarHeaderVariant
            ? "w-full py-2 pl-1 pr-2 transition-opacity hover:opacity-80"
            : isSidebarVariant
            ? "w-full rounded-[1.35rem] border border-primary/15 bg-surface-container px-3.5 py-3 transition-colors hover:border-primary/25 hover:bg-surface-container-high"
            : "min-w-0 rounded-2xl border border-outline-variant/35 bg-surface-container-lowest px-3 py-2 shadow-sm transition-colors hover:border-primary/25 hover:bg-surface-container-low"
        }`}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {isSidebarHeaderVariant ? (
          <Image
            src="/logo.png"
            alt="Agentergroup Logo"
            width={34}
            height={34}
            className="shrink-0 object-contain"
          />
        ) : (
          <div
            className={`flex shrink-0 items-center justify-center rounded-xl ${
              isSidebarVariant
                ? "h-11 w-11 border border-outline-variant/20 bg-surface-container-high text-primary"
                : "h-10 w-10 border border-outline-variant/30 bg-surface-container-low text-on-surface"
            }`}
          >
            <Building2
              className={isSidebarVariant ? "h-[1.05rem] w-[1.05rem]" : "h-[1rem] w-[1rem]"}
              strokeWidth={1.9}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {isSidebarVariant ? (
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              {t("nav.activeWorkspace")}
            </div>
          ) : null}
          <div className={`truncate font-semibold tracking-tight text-on-surface ${isSidebarHeaderVariant ? 'text-[15px]' : 'text-sm'}`}>
            {workspace.name}
          </div>
          {isSidebarHeaderVariant ? (
            <div className="flex items-center gap-1.5 truncate text-[12px] font-medium text-on-surface-variant/80">
              <span className="truncate">{workspace.slug}</span>
              <span className="h-1 w-1 shrink-0 rounded-full bg-outline-variant/40"></span>
              <span className="capitalize">{roleLabel}</span>
            </div>
          ) : (
            <div className="truncate text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
              {roleLabel} · {isSidebarVariant ? workspace.slug : sectionLabel}
            </div>
          )}
        </div>
        <ChevronDown
          className={`h-[1rem] w-[1rem] shrink-0 text-on-surface-variant transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          strokeWidth={2}
        />
      </button>

      {isOpen ? (
        <div
          className={`absolute z-30 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-2.5 shadow-md animate-in fade-in zoom-in-95 duration-200 ease-out ${
            isSidebarVariant || isSidebarHeaderVariant
              ? "left-0 right-0 top-[calc(100%+8px)]"
              : "left-0 top-[calc(100%+8px)] w-[min(24rem,calc(100vw-2rem))]"
          }`}
        >
          <div className="mb-2 flex items-start justify-between gap-4 border-b border-outline-variant/15 pb-2 px-1.5 pt-1">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant">
                {t("nav.workspace")}
              </p>
              <p className="mt-1.5 text-[15px] font-bold text-on-surface">{t("nav.switchClientContext")}</p>
            </div>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <X className="h-[1rem] w-[1rem]" strokeWidth={2} />
            </button>
          </div>

          <div className="space-y-1">
            {workspaces.map((entry) => {
              const isActive = entry.workspace.id === workspace.id;

              return (
                <button
                  key={entry.workspace.id}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors duration-200 ${
                    isActive
                      ? "bg-surface-container-high text-on-surface"
                      : "bg-transparent text-on-surface-variant hover:bg-surface-container"
                  }`}
                  disabled={isSubmitting}
                  onClick={() => void handleWorkspaceSwitch(entry.workspace.id)}
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-bold">{entry.workspace.name}</div>
                    <div className="truncate text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                      {t(`roles.${entry.membership.role}Lower`)} · {entry.workspace.slug}
                    </div>
                  </div>
                  {isActive ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                      {t("common.active")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-outline-variant/15 pt-4 px-1.5 pb-1">
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant">
              {t("nav.createWorkspace")}
            </p>
            <form className="mt-2 space-y-3" onSubmit={(event) => void handleCreateWorkspace(event)}>
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant">
                  {t("common.name")}
                </label>
                <input
                  className="w-full rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-2.5 text-[14px] text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/45 focus:border-primary/25 focus:bg-surface-container"
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("settings.workspaceNamePlaceholder")}
                  value={name}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant">
                  {t("common.description")}
                </label>
                <input
                  className="w-full rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-2.5 text-[14px] text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/45 focus:border-primary/25 focus:bg-surface-container"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t("common.optional")}
                  value={description}
                />
              </div>
              <button
                className="signature-gradient mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-bold tracking-wide transition-all hover:border-primary/25 hover:bg-primary/8 disabled:opacity-50"
                disabled={isSubmitting || !name.trim()}
                type="submit"
              >
                <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
                {isSubmitting ? t("common.saving") : t("nav.createWorkspace")}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
