"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Building2, Check, ChevronDown, Plus, X } from "lucide-react";
import { useAppContext } from "@/components/app/AppContext";
import { useToast } from "@/components/ui/ToastProvider";

function getSectionLabel(pathname: string | null) {
  if (!pathname) {
    return "Workspace";
  }

  if (pathname.startsWith("/dashboard")) {
    return "Dashboard";
  }

  if (pathname.startsWith("/analytics")) {
    return "Analytics";
  }

  if (pathname.startsWith("/agents")) {
    return "Agents";
  }

  if (pathname.startsWith("/knowledge")) {
    return "Knowledge";
  }

  if (pathname.startsWith("/connections")) {
    return "Connections";
  }

  if (pathname.startsWith("/settings")) {
    return "Settings";
  }

  return "Workspace";
}

interface WorkspaceSwitcherProps {
  variant?: "topbar" | "sidebar" | "sidebar-header";
}

export function WorkspaceSwitcher({
  variant = "topbar",
}: WorkspaceSwitcherProps) {
  const { workspace, membership, workspaces } = useAppContext();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sectionLabel = getSectionLabel(pathname);
  const isSidebarVariant = variant === "sidebar";
  const isSidebarHeaderVariant = variant === "sidebar-header";

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
        throw new Error(payload.error ?? "Failed to switch workspace.");
      }

      setIsOpen(false);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to switch workspace.",
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
        throw new Error(payload.error ?? "Failed to create workspace.");
      }

      setName("");
      setDescription("");
      setIsOpen(false);
      router.push("/dashboard");
      router.refresh();
      showToast("Workspace created.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to create workspace.",
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
            ? "w-full rounded-[1.35rem] border border-[#FF6B52]/18 bg-[#FF6B52]/6 px-3.5 py-3 transition-colors hover:border-[#FF6B52]/28 hover:bg-[#FF6B52]/9"
            : "min-w-0 rounded-2xl border border-outline-variant/35 bg-surface-container-lowest px-3 py-2 shadow-sm transition-colors hover:border-outline-variant/55 hover:bg-surface-container-low"
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
                ? "h-11 w-11 border border-[#FF6B52]/18 bg-white text-[#FF6B52]"
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
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-[#FF6B52]">
              Active workspace
            </div>
          ) : null}
          <div className={`truncate font-semibold tracking-tight text-on-surface ${isSidebarHeaderVariant ? 'text-[15px]' : 'text-sm'}`}>
            {workspace.name}
          </div>
          {isSidebarHeaderVariant ? (
            <div className="flex items-center gap-1.5 truncate text-[12px] font-medium text-on-surface-variant/80">
              <span className="truncate">{workspace.slug}</span>
              <span className="h-1 w-1 shrink-0 rounded-full bg-outline-variant/40"></span>
              <span className="capitalize">{membership.role}</span>
            </div>
          ) : (
            <div className="truncate text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
              {membership.role} · {isSidebarVariant ? workspace.slug : sectionLabel}
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
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#64748B]">
                Workspaces
              </p>
              <p className="mt-1.5 text-[15px] font-bold text-[#0F172A]">Switch client context</p>
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
                      ? "bg-[#F1F5F9] text-[#0F172A]"
                      : "bg-transparent text-[#475569] hover:bg-[#F8FAFC]"
                  }`}
                  disabled={isSubmitting}
                  onClick={() => void handleWorkspaceSwitch(entry.workspace.id)}
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-bold">{entry.workspace.name}</div>
                    <div className="truncate text-[11px] font-bold uppercase tracking-widest text-[#64748B]">
                      {entry.membership.role} · {entry.workspace.slug}
                    </div>
                  </div>
                  {isActive ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#64748B] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                      Active
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-[#F1F5F9] pt-4 px-1.5 pb-1">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#64748B] mb-3">
              Create workspace
            </p>
            <form className="mt-2 space-y-3" onSubmit={(event) => void handleCreateWorkspace(event)}>
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-[#64748B]">
                  Name
                </label>
                <input
                  className="w-full rounded-xl bg-[#F8FAFC] border border-transparent px-4 py-2.5 text-[14px] text-[#0F172A] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#E2E8F0] focus:bg-white"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Acme Dental"
                  value={name}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-[#64748B]">
                  Description
                </label>
                <input
                  className="w-full rounded-xl bg-[#F8FAFC] border border-transparent px-4 py-2.5 text-[14px] text-[#0F172A] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#E2E8F0] focus:bg-white"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional"
                  value={description}
                />
              </div>
              <button
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#64748B] px-4 py-3 text-[14px] font-bold tracking-wide text-white transition-all hover:bg-[#475569] disabled:opacity-50"
                disabled={isSubmitting || !name.trim()}
                type="submit"
              >
                <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
                {isSubmitting ? "Saving..." : "Create workspace"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
