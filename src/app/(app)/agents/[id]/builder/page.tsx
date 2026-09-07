"use client";

import dynamic from "next/dynamic";
import { AgentBuilderLoadingScreen } from "@/components/agents/AgentBuilderLoadingScreen";

const AgentBuilderClient = dynamic(() => import("./AgentBuilderClient"), {
  ssr: false,
  loading: () => <AgentBuilderLoadingScreen />,
});

export default function AgentBuilderPage() {
  return <AgentBuilderClient />;
}
