"use client";

import { useId, useState, type ReactNode } from "react";

interface TooltipProps {
  /**
   * The text shown on hover or focus. Nullish renders the children bare, so a
   * call site can pass a reason that only exists in some states without
   * branching the markup around it.
   */
  label?: string | null;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
  /**
   * Let the trigger fill the wrapper. Both spans need the width: an
   * inline-flex wrapper shrink-to-fits, which silently narrows a w-full
   * button to its text.
   */
  block?: boolean;
}

/**
 * A small styled tooltip, for the places a native `title` was doing the job.
 *
 * `title` costs about a second before it appears, cannot be styled, never
 * shows on touch, and is invisible to keyboard users — so an icon-only button
 * whose only label is a `title` is effectively unlabelled for anyone not using
 * a mouse.
 *
 * The label is also wired to the trigger with aria-describedby, so the tooltip
 * is announced rather than merely drawn.
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className = "",
  block = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  if (!label) return <>{children}</>;

  const show = () => setIsVisible(true);
  const hide = () => setIsVisible(false);

  return (
    <span
      className={`relative inline-flex ${block ? "w-full" : ""} ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      // Escape should dismiss it without moving focus, same as a native popup.
      onKeyDown={(event) => {
        if (event.key === "Escape") hide();
      }}
    >
      <span
        aria-describedby={isVisible ? tooltipId : undefined}
        className={`inline-flex ${block ? "w-full" : ""}`}
      >
        {children}
      </span>

      <span
        id={tooltipId}
        role="tooltip"
        aria-hidden={!isVisible}
        className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-on-surface px-2 py-1 text-[11px] font-medium text-surface shadow-lg transition-all duration-150 ${
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
        } ${
          isVisible
            ? "translate-y-0 opacity-100"
            : `${side === "top" ? "translate-y-1" : "-translate-y-1"} opacity-0`
        }`}
      >
        {label}
      </span>
    </span>
  );
}
