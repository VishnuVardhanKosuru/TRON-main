import { doc, getDoc, setDoc, updateDoc, increment } from "@/lib/tron/firestore";
import { db } from "./local-db";

export interface GraphNode {
  id: string; // Typically the lowercase entity name or ID
  label: string;
  type: "person" | "project" | "topic" | "location" | "other";
  weight: number;
}

export interface GraphEdge {
  id: string; // source_target
  source: string; // source node ID
  target: string; // target node ID
  type: "related" | "contains" | "depends_on" | "knows";
  weight: number;
}

const getNodesRef = (uid: string, nodeId: string) => doc(db, `users/${uid}/graph_nodes/${nodeId}`);
const getEdgesRef = (uid: string, edgeId: string) => doc(db, `users/${uid}/graph_edges/${edgeId}`);

function sanitizeId(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

export async function upsertNode(uid: string, label: string, type: GraphNode["type"] = "topic"): Promise<string> {
  const nodeId = sanitizeId(label);
  if (!nodeId) return "";

  const ref = getNodesRef(uid, nodeId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await updateDoc(ref, {
      weight: increment(1)
    });
  } else {
    await setDoc(ref, {
      id: nodeId,
      label,
      type,
      weight: 1
    });
  }
  return nodeId;
}

export async function upsertEdge(uid: string, sourceLabel: string, targetLabel: string, type: GraphEdge["type"] = "related"): Promise<void> {
  const sourceId = sanitizeId(sourceLabel);
  const targetId = sanitizeId(targetLabel);
  
  if (!sourceId || !targetId || sourceId === targetId) return;

  // Ensure deterministic ID for undirected edges (for now just alphabetical)
  const sortedIds = [sourceId, targetId].sort();
  const edgeId = `${sortedIds[0]}__${sortedIds[1]}`;

  const ref = getEdgesRef(uid, edgeId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await updateDoc(ref, {
      weight: increment(1)
    });
  } else {
    await setDoc(ref, {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type,
      weight: 1
    });
  }
}

export async function processGraphEntities(uid: string, entities: string[]) {
  if (!entities || entities.length === 0) return;

  const nodeIds: string[] = [];
  
  // Upsert all nodes
  for (const entity of entities) {
    const id = await upsertNode(uid, entity);
    if (id) nodeIds.push(id);
  }

  // Create edges between all pairs (fully connected clique for this note)
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      await upsertEdge(uid, nodeIds[i], nodeIds[j]);
    }
  }
}
