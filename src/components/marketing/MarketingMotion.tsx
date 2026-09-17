"use client";

import { useEffect } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function MarketingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-marketing-root]");
    if (!root) return;

    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const revealItems = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const updateMotionPreference = () => {
      root.dataset.motion = reducedMotion.matches ? "reduced" : "ready";
      if (reducedMotion.matches) revealItems.forEach(item => { item.dataset.revealed = "true"; });
    };
    reducedMotion.addEventListener("change", updateMotionPreference);

    // Scroll progress handler
    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const progress = maxScroll > 0 ? Math.min(Math.max(window.scrollY / maxScroll, 0), 1) : 0;
        root.style.setProperty("--scroll-progress", progress.toFixed(4));
        if (reducedMotion.matches) {
          root.style.setProperty("--dashboard-progress", "1");
          return;
        }

        // Smoothstep curve for natural organic acceleration and soft landing
        const targetScroll = Math.min(Math.max(window.innerHeight * 0.38, 200), 340);
        const linearProgress = targetScroll > 0 ? Math.min(Math.max(window.scrollY / targetScroll, 0), 1) : 1;
        const easedProgress = linearProgress * linearProgress * (3 - 2 * linearProgress);
        root.style.setProperty("--dashboard-progress", easedProgress.toFixed(4));
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      root.dataset.motion = "reduced";
      return () => {
        reducedMotion.removeEventListener("change", updateMotionPreference);
        window.removeEventListener("scroll", handleScroll);
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    }

    root.dataset.motion = "ready";

    // Reveal on scroll observer
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const element = entry.target as HTMLElement;
          element.dataset.revealed = "true";
          revealObserver.unobserve(element);
        });
      },
      {
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.08,
      },
    );

    revealItems.forEach((element) => {
      const bounds = element.getBoundingClientRect();
      if (bounds.top <= window.innerHeight * 0.92) return;
      element.dataset.revealState = "pending";
      revealObserver.observe(element);
    });

    // Section scroll-spy: mark the header link for the section in view. Sections
    // without a navigation entry leave the previous link marked, so the header
    // never flickers back to "nothing selected" mid-story.
    const navLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-nav]"));
    const sections = Array.from(root.querySelectorAll<HTMLElement>("section[id]"))
      .filter((section) => navLinks.some((link) => link.dataset.nav === section.id));
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) => {
            if (link.dataset.nav === entry.target.id) link.setAttribute("aria-current", "true");
            else link.removeAttribute("aria-current");
          });
        });
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      },
    );

    sections.forEach((sec) => sectionObserver.observe(sec));

    return () => {
      reducedMotion.removeEventListener("change", updateMotionPreference);
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
      revealObserver.disconnect();
      sectionObserver.disconnect();
    };
  }, []);

  return null;
}
