"use client";
import { Component as ReactComponent, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type { StoryCopy } from "./ProductUI";
const ActionDemo = lazy(() => import("./ActionDemo"));
const IntegrationDemo = lazy(() => import("./IntegrationDemo"));
const DashboardDemo = lazy(() => import("./DashboardDemo"));

export function LazyProductDemo({ kind, copy, children }: { kind: "action" | "integrations" | "dashboard"; copy: StoryCopy; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setReady(true); observer.disconnect(); } }, { rootMargin: "400px" });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const Component = kind === "action" ? ActionDemo : kind === "integrations" ? IntegrationDemo : DashboardDemo;
  return <div ref={root}><DemoBoundary fallback={children}><Suspense fallback={children}>{ready ? <Component copy={copy} /> : children}</Suspense></DemoBoundary></div>;
}

class DemoBoundary extends ReactComponent<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
