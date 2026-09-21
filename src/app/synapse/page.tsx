"use client";

import { useState, useEffect } from "react";
import ForceGraph from "@/components/ForceGraph";
import { IconLayoutList, IconAffiliate, IconBulb } from "@tabler/icons-react";
import { useAuthContext } from "@/context/AuthContext";
import { collection, query, limit, onSnapshot } from "@/lib/tron/firestore";
import { db } from "@/lib/local-db";

interface GraphNode {
  id: string;
  name: string;
  color: string;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
}

export default function SynapseScreen() {
  const { user } = useAuthContext();
  const [view, setView] = useState<'graph' | 'list'>('graph');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [resurfaced, setResurfaced] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setNodes([]);
      setLinks([]);
      setResurfaced(null);
      return;
    }

    // Load real graph nodes
    const qNodes = query(collection(db, "users", user.uid, "graph_nodes"), limit(100));
    const unsubNodes = onSnapshot(qNodes, (snap) => {
      const colors: Record<string, string> = {
        person: "#0ea5e9",
        project: "#6366f1",
        topic: "#06b6d4",
        location: "#10b981",
        other: "#8b5cf6"
      };
      
      const realNodes: GraphNode[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: data.id,
          name: data.label || data.id,
          color: colors[data.type] || colors.other,
          val: 1 + Math.min(data.weight || 1, 5) * 0.5,
        };
      });
      setNodes(realNodes);
      
      if (realNodes.length > 0) {
        // Randomly resurface a node
        const randomNode = realNodes[Math.floor(Math.random() * realNodes.length)];
        setResurfaced(`Insight: You've been thinking a lot about "${randomNode.name}" lately.`);
      } else {
        setResurfaced(null);
      }
    });

    // Load real graph edges
    const qEdges = query(collection(db, "users", user.uid, "graph_edges"), limit(200));
    const unsubEdges = onSnapshot(qEdges, (snap) => {
      const realLinks: GraphLink[] = snap.docs.map(d => {
        const data = d.data();
        return {
          source: data.source,
          target: data.target
        };
      });
      setLinks(realLinks);
    });

    return () => {
      unsubNodes();
      unsubEdges();
    };
  }, [user]);

  const graphData = { nodes, links };

  return (
    <div className="bg-[var(--surface-1)] rounded-[20px] p-4 md:border-[0.5px] border-[var(--border-strong)] min-h-[500px]">
      {/* Header & Toggle */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-[20px] font-medium m-0">Synapse</h2>
        <div className="flex bg-[var(--surface-2)] rounded-[8px] p-1 border-[0.5px] border-[var(--border)]">
          <button 
            className={`p-1.5 rounded-[6px] transition-colors ${view === 'graph' ? 'bg-[var(--fill-accent)] text-[var(--on-accent)]' : 'text-[var(--text-muted)]'}`}
            onClick={() => setView('graph')}
          >
            <IconAffiliate size={16} />
          </button>
          <button 
            className={`p-1.5 rounded-[6px] transition-colors ${view === 'list' ? 'bg-[var(--fill-accent)] text-[var(--on-accent)]' : 'text-[var(--text-muted)]'}`}
            onClick={() => setView('list')}
          >
            <IconLayoutList size={16} />
          </button>
        </div>
      </div>

      {/* Resurfaced Card */}
      {resurfaced && (
        <div className="mb-4 bg-[var(--surface-2)] border-[0.5px] border-[var(--border-strong)] rounded-[12px] p-3">
          <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Recent connection</p>
          <p className="text-[13px] text-[var(--text-primary)] m-0 leading-snug">{resurfaced}</p>
        </div>
      )}

      {/* View Content */}
      {nodes.length === 0 ? (
        <div className="min-h-[350px] flex flex-col items-center justify-center text-center p-6 opacity-60">
          <IconBulb size={32} className="text-[var(--text-muted)] mb-2" stroke={1.5} />
          <p className="text-[14px] text-[var(--text-secondary)] font-medium m-0">No nodes in your network yet</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5 max-w-[240px] leading-relaxed m-0">
            Capture thoughts, ideas, or links to watch Synapse map your connections.
          </p>
        </div>
      ) : view === 'graph' ? (
        <ForceGraph graphData={graphData} />
      ) : (
        <div className="space-y-3">
          {nodes.map(node => (
            <div key={node.id} className="p-3 bg-[var(--surface-2)] border-[0.5px] border-[var(--border)] rounded-[12px]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: node.color }} />
                <span className="text-[14px]">{node.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
