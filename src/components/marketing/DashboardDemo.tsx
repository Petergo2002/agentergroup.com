"use client";
import { useState } from "react";
import { DashboardScene } from "./DashboardScene";
import type { StoryCopy } from "./ProductUI";
import { useStory } from "./StoryContext";
export default function DashboardDemo({ copy }: { copy: StoryCopy }) {
  const [tab, setTab] = useState<"conversation" | "lead">("conversation");
  const { slot } = useStory();
  return <DashboardScene copy={copy} slot={slot} tab={tab} onTab={setTab} />;
}
