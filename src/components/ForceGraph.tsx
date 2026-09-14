"use client";
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export default function ForceGraph({ graphData }: { graphData: any }) {
  return (
    <div className="w-full h-[350px] bg-[var(--surface-1)] rounded-[12px] overflow-hidden border-[0.5px] border-[var(--border)] relative">
      <ForceGraph2D
        graphData={graphData}
        width={350} // approximate for mobile layout
        height={350}
        backgroundColor="#0f0f11" // var(--surface-1)
        nodeRelSize={6}
        nodeColor={(node: any) => node.color}
        linkColor={() => "rgba(56, 56, 63, 0.6)"} // var(--border-strong)
        linkWidth={1.5}
        cooldownTicks={100}
        onNodeClick={(node) => console.log(node)}
      />
    </div>
  );
}
