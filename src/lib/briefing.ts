import { collection, query, where, getDocs, doc, getDoc, setDoc } from "@/lib/tron/firestore";
import { db } from "./local-db";


// Collection ref helper
const col = (uid: string, path: string) => collection(db, `users/${uid}/${path}`);

export async function buildUserSnapshot(uid: string): Promise<string> {
  let snapshot = "";

  // 1. TODOS (pending)
  const qTodos = query(col(uid, "todos"), where("status", "==", "pending"));
  const todosSnap = await getDocs(qTodos);
  const todos = todosSnap.docs.map(d => d.data());
  if (todos.length > 0) {
    snapshot += `[TODOS]\n`;
    todos.forEach(t => {
      let suffix = "";
      if (t.dueDate) {
        const dd = t.dueDate.toDate();
        const diffDays = Math.floor((Date.now() - dd.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0) suffix = ` | ${diffDays} days overdue`;
        else suffix = ` | due ${dd.toLocaleDateString()}`;
      }
      snapshot += `- ${t.title}${suffix}\n`;
    });
    snapshot += `\n`;
  }

  // 2. REMINDERS (pending)
  const qReminders = query(col(uid, "reminders"), where("status", "==", "pending"));
  const remSnap = await getDocs(qReminders);
  if (!remSnap.empty) {
    snapshot += `[REMINDERS]\n`;
    remSnap.docs.map(d => d.data()).slice(0, 5).forEach(r => {
      const dateStr = r.scheduledAt ? ` | ${r.scheduledAt.toDate().toLocaleString()}` : "";
      snapshot += `- ${r.title}${dateStr}\n`;
    });
    snapshot += `\n`;
  }

  // 3. GOALS (active)
  const qGoals = query(col(uid, "goals"), where("status", "==", "active"));
  const goalsSnap = await getDocs(qGoals);
  if (!goalsSnap.empty) {
    snapshot += `[GOALS]\n`;
    goalsSnap.docs.map(d => d.data()).forEach(g => {
      const targetStr = g.targetDate ? ` | target: ${g.targetDate}` : "";
      snapshot += `- ${g.title}${targetStr}\n`;
    });
    snapshot += `\n`;
  }

  // 4. FOLLOWUPS (pending)
  const qFollow = query(col(uid, "people_notes"), where("kind", "==", "followup"), where("followupDone", "==", false));
  const followSnap = await getDocs(qFollow);
  if (!followSnap.empty) {
    snapshot += `[FOLLOWUPS]\n`;
    followSnap.docs.map(d => d.data()).forEach(f => {
      snapshot += `- ${f.topic || "Follow up"} with ${f.personName}\n`;
    });
    snapshot += `\n`;
  }

  // 5. STOCK (low/out)
  const qStock = query(col(uid, "stock"), where("threshold", "in", ["low", "out"]));
  const stockSnap = await getDocs(qStock);
  if (!stockSnap.empty) {
    snapshot += `[STOCK]\n`;
    stockSnap.docs.map(d => d.data()).forEach(s => {
      snapshot += `- ${s.name} is ${s.threshold}\n`;
    });
    snapshot += `\n`;
  }

  if (!snapshot) {
    snapshot = "User has no pending tasks, goals, reminders, or low stock. Everything is clear.";
  }

  return snapshot.trim();
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export async function getOrFetchBriefing(uid: string, forceRefresh = false): Promise<string> {
  const cacheRef = doc(db, `users/${uid}/briefing_cache/latest`);
  
  if (!forceRefresh) {
    const cacheSnap = await getDoc(cacheRef);
    if (cacheSnap.exists()) {
      const data = cacheSnap.data();
      const ageMs = Date.now() - (data.updatedAt?.toMillis() || 0);
      if (ageMs < TWO_HOURS_MS && data.text) {
        return data.text; // Return cached briefing
      }
    }
  }

  // Cache missed or expired, generate new one
  try {
    const snapshotText = await buildUserSnapshot(uid);
    const res = await fetch("/api/briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshotText }),
    });
    const briefingText = res.ok
      ? ((await res.json()).briefing_text || "All clear on the horizon!")
      : "All clear on the horizon!";

    // Save to cache
    await setDoc(cacheRef, {
      text: briefingText,
      updatedAt: new Date()
    });

    return briefingText;
  } catch (error) {
    console.error("Failed to fetch new briefing:", error);
    // If it fails but we have a stale cache, return it
    const staleSnap = await getDoc(cacheRef);
    if (staleSnap.exists() && staleSnap.data().text) {
      return staleSnap.data().text;
    }
    return "All clear on the horizon! Your mind is free to explore.";
  }
}
