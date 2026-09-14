import {
  collection, query, where, getDocs, limit,
  addDoc, deleteDoc, doc, updateDoc, serverTimestamp
} from "@/lib/tron/firestore";
import { db } from "./local-db";
import type { AICaptureResult } from "./tron-ai";

// ── Helpers ──────────────────────────────────────────────────────────────────

const col = (uid: string, path: string) => collection(db, "users", uid, path);

// Map ClassifiedType → local collection name
function typeToCollection(type: string): string {
  const map: Record<string, string> = {
    todo: "todos", routine: "routines", reminder: "reminders",
    idea: "notes", question: "notes", people_note: "people_notes",
    meeting: "people_notes", followup: "people_notes",
    travel: "travel", wishlist: "wishlist", shopping: "shopping",
    stock: "stock", iou: "ledger", borrowed: "ledger",
    link: "links", personal_link: "links", journal: "journal",
    gratitude: "gratitude", vault: "vault", mood: "moods",
    health: "health", goal: "goals", period: "periods",
    errand: "errands",
  };
  return map[type] || "notes";
}

// Calls the server-side /api/classify route, which talks to the local model
async function classifyViaAPI(text: string): Promise<AICaptureResult> {
  const res = await fetch("/api/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Classify API error: ${res.status}`);
  return res.json();
}

// ── queryCollection tool ──────────────────────────────────────────────────────

async function handleQuery(uid: string, args: any): Promise<string> {
  const colName = args.collection;
  const blocked = ["journal", "gratitude", "vault", "moods", "health", "periods"];
  if (blocked.includes(colName)) {
    return JSON.stringify({ error: "Access denied to private collection." });
  }

  try {
    const colRef = collection(db, `users/${uid}/${colName}`);
    let q = query(colRef, limit(20));

    if (args.filters && Array.isArray(args.filters)) {
      args.filters.forEach((f: any) => {
        if (f.field && f.operator && f.value) {
          let val: any = f.value;
          if (val === "true") val = true;
          if (val === "false") val = false;
          if (!isNaN(Number(val)) && typeof val === "string" && val.trim() !== "") {
            val = Number(val);
          }
          q = query(q, where(f.field, f.operator, val));
        }
      });
    }

    const snap = await getDocs(q);
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return JSON.stringify(results.length > 0 ? results : { message: "No records found." });
  } catch (e: any) {
    console.error("Tool query failed:", e);
    return JSON.stringify({ error: e.message });
  }
}

// ── Background AI upgrade ─────────────────────────────────────────────────────
// Runs AFTER the offline save. Tries Gemma (both models via cascade), then:
//   - On success: creates additional captures and updates key_info on the original doc
//   - On failure: writes a retry job to pending_classifications

async function runBackgroundAI(
  uid: string,
  textToCapture: string,
  offlineType: string,
  offlineDocId: string
): Promise<void> {
  const { processCapture } = await import("./db");
  const { processGraphEntities } = await import("./graphUtils");

  try {
    const aiResult: AICaptureResult = await classifyViaAPI(textToCapture);
    if (!aiResult.captures || aiResult.captures.length === 0) return;

    const primaryCapture = aiResult.captures[0];
    const offlineColName = typeToCollection(offlineType);
    const primaryColName = typeToCollection(primaryCapture.type);

    if (primaryCapture.type === offlineType) {
      // Same type — just update the existing doc with AI-extracted key_info
      try {
        const docRef = doc(db, "users", uid, offlineColName, offlineDocId);
        // Only update defined fields from key_info
        const updates: Record<string, any> = {};
        for (const [k, v] of Object.entries(primaryCapture.key_info || {})) {
          if (v !== null && v !== undefined) updates[k] = v;
        }
        if (Object.keys(updates).length > 0) {
          await updateDoc(docRef, updates);
        }
      } catch (e) {
        console.warn("Background AI: failed to update doc key_info:", e);
      }
    } else {
      // Different type — delete offline doc, create AI-classified one
      try {
        const oldRef = doc(db, "users", uid, offlineColName, offlineDocId);
        await deleteDoc(oldRef);
      } catch (e) {
        console.warn("Background AI: failed to delete old doc:", e);
      }
      await processCapture(uid, primaryCapture.type as any, textToCapture, primaryCapture.key_info);
    }

    // Create any additional captures (multi-capture bonus)
    for (const capture of aiResult.captures.slice(1)) {
      await processCapture(uid, capture.type as any, textToCapture, capture.key_info);
    }

    // Update knowledge graph
    if (aiResult.entities?.length > 0) {
      await processGraphEntities(uid, aiResult.entities);
    }

    console.log(`[Background AI] ✅ Upgraded "${textToCapture}" → [${aiResult.captures.map(c => c.type).join(", ")}]`);
  } catch (err: any) {
    // Both Gemma models exhausted — write to retry queue
    console.warn(`[Background AI] ❌ Both Gemma models failed. Queuing for retry. Error: ${err?.message}`);
    try {
      await addDoc(col(uid, "pending_classifications"), {
        text: textToCapture,
        offlineType,
        offlineDocId,
        offlineCollection: typeToCollection(offlineType),
        createdAt: serverTimestamp(),
        retryCount: 0,
      });
    } catch (queueErr) {
      console.error("[Background AI] Failed to queue retry:", queueErr);
    }
  }
}

// ── Process pending queue ─────────────────────────────────────────────────────
// Called at start of next storeCapture to drain any pending items

async function processPendingQueue(uid: string): Promise<void> {
  try {
    const { processCapture } = await import("./db");

    const pendingRef = col(uid, "pending_classifications");
    const q = query(pendingRef, limit(3)); // process max 3 per capture
    const snap = await getDocs(q);
    if (snap.empty) return;

    for (const pendingDoc of snap.docs) {
      const data = pendingDoc.data();
      try {
        const aiResult: AICaptureResult = await classifyViaAPI(data.text);
        if (aiResult.captures?.length > 0) {
          // Delete old offline doc
          try {
            const oldRef = doc(db, "users", uid, data.offlineCollection, data.offlineDocId);
            await deleteDoc(oldRef);
          } catch {}
          // Create AI-classified docs
          for (const capture of aiResult.captures) {
            await processCapture(uid, capture.type as any, data.text, capture.key_info);
          }
        }
        // Remove from pending queue
        await deleteDoc(pendingDoc.ref);
        console.log(`[Pending Queue] ✅ Processed: "${data.text}"`);
      } catch {
        // Still failing — leave in queue
        console.warn(`[Pending Queue] ⏳ Still failing: "${data.text}"`);
      }
    }
  } catch (e) {
    // Queue processing failure — non-fatal, skip silently
  }
}

// ── storeCapture tool (Option D: offline-first + background AI) ──────────────

async function handleStore(uid: string, textToCapture: string): Promise<string> {
  const { classifyCapture, tronReply, BYPASS_AI_TYPES } = await import("./classifier");
  const { processCapture } = await import("./db");
  const { processGraphEntities } = await import("./graphUtils");

  // Drain any previously queued items (opportunistic, non-blocking)
  processPendingQueue(uid).catch(() => {});

  const offlineResult = classifyCapture(textToCapture);
  const isPrivate = BYPASS_AI_TYPES.has(offlineResult.type);

  // ── For PRIVATE types: save immediately, no AI ever ─────────────────────
  if (isPrivate) {
    await processCapture(uid, offlineResult.type as any, textToCapture, { content: textToCapture });
    return JSON.stringify({
      success: true,
      message: tronReply(offlineResult.type as any),
      stored_as: [offlineResult.type],
    });
  }

  // ── For everything else: classify via the server route (local model) ──
  try {
    const aiResult = await classifyViaAPI(textToCapture);

    if (!aiResult.captures?.length) throw new Error("Empty AI result");

    // AI worked — save all captures with rich key_info
    const storedTypes: string[] = [];
    for (const capture of aiResult.captures) {
      await processCapture(uid, capture.type as any, textToCapture, capture.key_info);
      storedTypes.push(capture.type);
    }

    if (aiResult.entities?.length) {
      await processGraphEntities(uid, aiResult.entities).catch(() => {});
    }

    // Build proper multi-capture confirmation
    let message: string;
    if (storedTypes.length === 1) {
      message = tronReply(storedTypes[0] as any);
    } else {
      const typesStr = storedTypes.map(t => t.replace(/_/g, " ")).join(" and ");
      message = `Got it! Saved as ${typesStr}.`;
    }

    return JSON.stringify({ success: true, message, stored_as: storedTypes });

  } catch (aiError: any) {
    // ALL Gemma models and keys exhausted — save offline and queue for retry
    console.warn(`[storeCapture] All AI options failed: ${aiError?.message}. Saving offline and queuing retry.`);

    const docRef = await processCapture(uid, offlineResult.type as any, textToCapture, {
      content: textToCapture,
    });

    // Queue for retry (durable across page reloads)
    if (docRef?.id) {
      addDoc(col(uid, "pending_classifications"), {
        text: textToCapture,
        offlineType: offlineResult.type,
        offlineDocId: docRef.id,
        offlineCollection: typeToCollection(offlineResult.type),
        createdAt: serverTimestamp(),
        retryCount: 0,
      }).catch(() => {});
    }

    const offlineMessage = tronReply(offlineResult.type as any);
    return JSON.stringify({
      success: true,
      message: `${offlineMessage} (AI is busy right now — I'll refine the classification automatically when it's available again.)`,
      stored_as: [offlineResult.type],
      ai_pending: true,
    });
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function executeClientTool(uid: string, toolCall: any): Promise<string> {
  const name = toolCall.function.name;

  if (name === "queryCollection") {
    const args = JSON.parse(toolCall.function.arguments);
    return handleQuery(uid, args);
  }

  if (name === "storeCapture") {
    const args = JSON.parse(toolCall.function.arguments);
    const text = args.text?.trim();
    if (!text) return JSON.stringify({ error: "No text provided to capture." });
    try {
      return await handleStore(uid, text);
    } catch (e: any) {
      console.error("Store capture failed:", e);
      return JSON.stringify({ error: e.message });
    }
  }

  return JSON.stringify({ error: "Unknown tool" });
}
