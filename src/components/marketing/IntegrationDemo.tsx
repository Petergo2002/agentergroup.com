"use client";
import { useState } from "react";
import type { StoryCopy } from "./ProductUI";
import { IntegrationScene } from "./IntegrationScene";
import { useStory } from "./StoryContext";
export default function IntegrationDemo({ copy }: { copy: StoryCopy }) {
  const [selected, setSelected] = useState(0);
  const { slot } = useStory();
  return <IntegrationScene copy={copy} selected={selected} slot={slot} onSelect={setSelected} />;
}
