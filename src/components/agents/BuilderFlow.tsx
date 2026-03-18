'use client';

import { type ReactFlowInstance, BackgroundVariant } from '@xyflow/react';
import dynamic from 'next/dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

interface FlowProps {
  nodes: Any;
  edges: Any;
  nodeTypes: Any;
  onNodesChange: Any;
  onNodeClick: Any;
  onPaneClick: Any;
  onInit: (instance: ReactFlowInstance) => void;
  fitView: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proOptions: any;
  className?: string;
  children?: React.ReactNode;
}

const ReactFlow = dynamic(
  () =>
    import('@xyflow/react').then((mod) => {
      return mod.ReactFlow;
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-on-surface-variant">Loading builder...</p>
        </div>
      </div>
    ),
  },
);

const Background = dynamic(
  () =>
    import('@xyflow/react').then((mod) => {
      return mod.Background;
    }),
  { ssr: false },
);

const Controls = dynamic(
  () =>
    import('@xyflow/react').then((mod) => {
      return mod.Controls;
    }),
  { ssr: false },
);

export function BuilderFlow({
  nodes,
  edges,
  nodeTypes,
  onNodesChange,
  onNodeClick,
  onPaneClick,
  onInit,
  fitView,
  proOptions,
  className,
  children,
}: FlowProps) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onInit={onInit}
      fitView={fitView}
      proOptions={proOptions}
      className={className}
    >
      {children}
    </ReactFlow>
  );
}

export function BuilderBackground() {
  return <Background variant={BackgroundVariant.Dots} gap={18} size={1} />;
}

export function BuilderControls() {
  return <Controls className="!bottom-4 !left-4 !top-auto !right-auto" />;
}

export { ReactFlow, Background, Controls };
