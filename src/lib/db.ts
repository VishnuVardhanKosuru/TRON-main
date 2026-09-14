import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  increment,
  purgeCollections,
} from "@/lib/tron/firestore";
import { db } from "./local-db";
import { ClassifiedType } from "./classifier";

// ── 1. Todos ──────────────────────────────────────────────────────────────────
export interface Todo {
  id?: string;
  title: string;
  priority: "low" | "normal" | "high";
  dueDate: Timestamp | null;
  completedAt: Timestamp | null;
  status: "pending" | "done" | "archived";
  createdAt: Timestamp | null;
}

// ── 2. Reminders ──────────────────────────────────────────────────────────────
export interface Reminder {
  id?: string;
  title: string;
  scheduledAt: Timestamp | null;
  notified: boolean;
  status: "pending" | "done" | "archived";
  createdAt: Timestamp | null;
}

// ── 3. Routines ───────────────────────────────────────────────────────────────
export interface Routine {
  id?: string;
  title: string;
  schedule: {
    type: "daily" | "weekdays" | "interval";
    time: string;
    days?: number[];
    intervalDays?: number;
  };
  streak: number;
  longestStreak: number;
  lastCompletedAt: Timestamp | null;
  completionLog: Record<string, boolean>;
  status: "active" | "paused" | "archived";
  createdAt: Timestamp | null;
}

// ── 4. Errands ────────────────────────────────────────────────────────────────
export interface Errand {
  id?: string;
  title: string;
  location: string;
  completedAt: Timestamp | null;
  status: "pending" | "done" | "archived";
  createdAt: Timestamp | null;
}

// ── 5. Shopping ───────────────────────────────────────────────────────────────
export interface ShoppingItem {
  id?: string;
  name: string;
  quantity: string | null;
  category: string | null;
  checked: boolean;
  createdAt: Timestamp | null;
}

// ── 6. Stock ──────────────────────────────────────────────────────────────────
export interface StockItem {
  id?: string;
  name: string;
  threshold: "ok" | "low" | "out";
  lastRestockedAt: Timestamp | null;
  createdAt: Timestamp | null;
}

// ── 7. Ledger (IOUs & Borrowed) ───────────────────────────────────────────────
export interface LedgerItem {
  id?: string;
  kind: "iou" | "borrowed";
  person: string;
  item?: string;
  amount?: number;
  direction: "owed_to_me" | "i_owe" | "lent" | "borrowed";
  settled: boolean;
  settledAt: Timestamp | null;
  notes: string | null;
  createdAt: Timestamp | null;
}

// ── 8. Notes (Ideas, Questions, Thoughts) ─────────────────────────────────────
export interface Note {
  id?: string;
  kind: "idea" | "question" | "thought";
  content: string;
  tags: string[];
  status: "active" | "archived";
  createdAt: Timestamp | null;
}

// ── 9. Links ──────────────────────────────────────────────────────────────────
export interface LinkItem {
  id?: string;
  url: string;
  title: string | null;
  domain: string | null;
  kind: "article" | "personal_ref";
  read: boolean;
  tags: string[];
  createdAt: Timestamp | null;
}

// ── 10. Journal ───────────────────────────────────────────────────────────────
export interface JournalEntry {
  id?: string;
  content: string;
  mood: string | null;
  date: string; // YYYY-MM-DD
  createdAt: Timestamp | null;
}

// ── 11. Gratitude ─────────────────────────────────────────────────────────────
export interface GratitudeEntry {
  id?: string;
  content: string;
  date: string; // YYYY-MM-DD
  createdAt: Timestamp | null;
}

// ── 12. People ────────────────────────────────────────────────────────────────
export interface Person {
  id?: string;
  name: string;
  birthday: string | null;
  tags: string[];
  createdAt: Timestamp | null;
}

// ── 13. People Notes (Notes, Meetings, Follow-ups) ────────────────────────────
export interface PeopleNote {
  id?: string;
  personId: string | null;
  personName: string;
  kind: "note" | "meeting" | "followup";
  content: string;
  followupDate: Timestamp | null;
  followupDone: boolean | null;
  date: string; // YYYY-MM-DD
  createdAt: Timestamp | null;
}

// ── 14. Travel ────────────────────────────────────────────────────────────────
export interface TravelTrip {
  id?: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  status: "idea" | "planning" | "booked" | "done";
  notes: string[];
  tags: string[];
  createdAt: Timestamp | null;
}

// ── 15. Wishlist ──────────────────────────────────────────────────────────────
export interface WishlistItem {
  id?: string;
  title: string;
  kind: "book" | "movie" | "show" | "podcast" | "other";
  recommendedBy: string | null;
  status: "want" | "done";
  createdAt: Timestamp | null;
}

// ── 16. Profile ───────────────────────────────────────────────────────────────
export interface Profile {
  id?: string;
  displayName: string;
  avatarUrl: string | null;
  encryptionKeyHint: string | null;
  preferences: {
    theme: "dark" | "light" | "system";
    notificationsEnabled: boolean;
  };
  createdAt: Timestamp | null;
}

// ── 17. FCM Tokens ────────────────────────────────────────────────────────────
export interface FcmToken {
  id?: string;
  token: string;
  device: string;
  lastSeen: Timestamp | null;
  createdAt: Timestamp | null;
}

// ── 18. Goals ─────────────────────────────────────────────────────────────────
export interface Goal {
  id?: string;
  title: string;
  description: string | null;
  targetDate: Timestamp | null;
  milestones: string[];
  status: "active" | "achieved" | "abandoned";
  createdAt: Timestamp | null;
}

// ── 19. Vault (Quick Access Secrets / Passwords) ──────────────────────────────
export interface VaultItem {
  id?: string;
  title: string;
  content: string; // will be encrypted
  category: "password" | "pin" | "secure_note" | "link";
  createdAt: Timestamp | null;
}

// ── 20. Moods ─────────────────────────────────────────────────────────────────
export interface MoodEntry {
  id?: string;
  mood: "great" | "good" | "okay" | "rough" | "bad";
  note: string | null;
  date: string; // YYYY-MM-DD
  createdAt: Timestamp | null;
}

// ── 21. Health ────────────────────────────────────────────────────────────────
export interface HealthNote {
  id?: string;
  kind: "symptom" | "medication" | "appointment";
  note: string;
  date: string; // YYYY-MM-DD
  createdAt: Timestamp | null;
}

// ── 22. Periods & Cycle Tracking ──────────────────────────────────────────────
export interface PeriodEntry {
  id?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
  flow: "spotting" | "light" | "medium" | "heavy";
  symptoms: string[];
  notes: string | null;
  createdAt: Timestamp | null;
}

// ── Collection References ─────────────────────────────────────────────────────
const col = (uid: string, path: string) => collection(db, "users", uid, path);

// ── Helper: Extract time from capture text ──────────────────────────────────
export function parseTimeFromText(text: string): { time: string; cleanTitle: string; hours: number; minutes: number } | null {
  const m12 = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = m12[2] ? parseInt(m12[2], 10) : 0;
    const period = m12[3].toLowerCase();
    if (period === "pm" && h < 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    const time = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    let clean = text.replace(m12[0], "").replace(/\b(every\s+day|daily|every\s+morning|every\s+night|remind\s+me|reminder:)\b/gi, "").trim();
    clean = clean.replace(/^[:,\s-]+/, "").trim();
    return { time, cleanTitle: clean || text, hours: h, minutes: min };
  }

  const m24 = text.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    const time = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    let clean = text.replace(m24[0], "").replace(/\b(every\s+day|daily|every\s+morning|every\s+night|remind\s+me|reminder:)\b/gi, "").trim();
    clean = clean.replace(/^[:,\s-]+/, "").trim();
    return { time, cleanTitle: clean || text, hours: h, minutes: min };
  }

  return null;
}

// ── Central Capture Processor ─────────────────────────────────────────────────
// Routes a raw string + classified type into the correct local collection.

export async function processCapture(
  uid: string, 
  type: ClassifiedType, 
  text: string, 
  key_info?: Record<string, any>
) {
  const todayStr = new Date().toISOString().split("T")[0];

  switch (type) {
    case "mood":
      return addDoc(col(uid, "moods"), {
        mood: "okay", // Default, can be refined in UI later
        note: key_info?.content || text.replace(/^(mood:|feeling:|felt:)\s*/i, "").trim(),
        date: todayStr,
        createdAt: serverTimestamp(),
      });

    case "health":
      return addDoc(col(uid, "health"), {
        kind: "symptom", // Default
        note: key_info?.content || text.replace(/^(health:|symptom:|med:|medication:|dr:|doctor:)\s*/i, "").trim(),
        date: todayStr,
        createdAt: serverTimestamp(),
      });

    case "todo":
      return addDoc(col(uid, "todos"), {
        title: key_info?.content || text.replace(/^(!|todo:)\s*/i, "").trim(),
        priority: key_info?.priority || "normal",
        dueDate: key_info?.dueDate ? Timestamp.fromDate(new Date(key_info.dueDate)) : null,
        completedAt: null,
        status: "pending",
        createdAt: serverTimestamp(),
      });

    case "routine": {
      const parsed = parseTimeFromText(text);
      const scheduleTime = key_info?.time || parsed?.time || "09:00";
      const scheduleType = key_info?.intervalDays ? "interval" : "daily";
      return addDoc(col(uid, "routines"), {
        title: key_info?.content || parsed?.cleanTitle || text,
        schedule: { 
          type: scheduleType, 
          time: scheduleTime,
          intervalDays: key_info?.intervalDays || null
        },
        streak: 0,
        longestStreak: 0,
        lastCompletedAt: null,
        completionLog: {},
        status: "active",
        createdAt: serverTimestamp(),
      });
    }

    case "reminder": {
      const parsed = parseTimeFromText(text);
      let scheduledAt: Timestamp | null = null;
      
      if (key_info?.date && key_info?.time) {
        // AI gave us both
        scheduledAt = Timestamp.fromDate(new Date(`${key_info.date}T${key_info.time}:00`));
      } else if (key_info?.date) {
        // AI gave date, default to 9am
        scheduledAt = Timestamp.fromDate(new Date(`${key_info.date}T09:00:00`));
      } else if (key_info?.time) {
        // AI gave time, use today or tomorrow depending on if time has passed
        const [h, m] = key_info.time.split(":").map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
        scheduledAt = Timestamp.fromDate(d);
      } else if (parsed) {
        // Fallback to offline regex
        const d = new Date();
        d.setHours(parsed.hours, parsed.minutes, 0, 0);
        if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
        scheduledAt = Timestamp.fromDate(d);
      }

      return addDoc(col(uid, "reminders"), {
        title: key_info?.content || parsed?.cleanTitle || text,
        scheduledAt,
        notified: false,
        status: "pending",
        createdAt: serverTimestamp(),
      });
    }

    case "errand":
      return addDoc(col(uid, "errands"), {
        title: key_info?.content || text,
        location: key_info?.location || "unknown",
        completedAt: null,
        status: "pending",
        createdAt: serverTimestamp(),
      });

    case "shopping":
      return addDoc(col(uid, "shopping"), {
        name: key_info?.name || text.replace(/^(buy|get|grab|pick\s+up)\s/i, "").trim(),
        quantity: key_info?.quantity || null,
        category: null,
        checked: false,
        createdAt: serverTimestamp(),
      });

    case "stock":
      return addDoc(col(uid, "stock"), {
        name: key_info?.name || text.replace(/^(running\s+low|almost\s+out|out\s+of|need\s+more\s+)\s*/i, "").trim(),
        threshold: key_info?.level || "low",
        lastRestockedAt: null,
        createdAt: serverTimestamp(),
      });

    case "iou":
    case "borrowed":
      return addDoc(col(uid, "ledger"), {
        kind: type,
        person: key_info?.personName || "Unknown",
        amount: key_info?.amount || null,
        currency: key_info?.currency || null,
        item: key_info?.item || null,
        direction: key_info?.direction || (type === "iou" ? "owed_to_me" : "borrowed"),
        settled: false,
        settledAt: null,
        notes: text,
        createdAt: serverTimestamp(),
      });

    case "idea":
    case "question":
      return addDoc(col(uid, "notes"), {
        kind: type,
        content: key_info?.content || text,
        tags: [],
        status: "active",
        createdAt: serverTimestamp(),
      });

    case "link":
    case "personal_link": {
      let domain = null;
      try {
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          domain = new URL(urlMatch[0]).hostname;
        }
      } catch (e) {}
      return addDoc(col(uid, "links"), {
        url: text,
        title: null,
        domain,
        kind: type === "personal_link" ? "personal_ref" : "article",
        read: false,
        tags: [],
        createdAt: serverTimestamp(),
      });
    }

    case "journal":
      return addDoc(col(uid, "journal"), {
        content: key_info?.content || text.replace(/^(journal:|j:)\s*/i, "").trim(),
        mood: null,
        date: todayStr,
        createdAt: serverTimestamp(),
      });

    case "gratitude":
      return addDoc(col(uid, "gratitude"), {
        content: key_info?.content || text.replace(/^(grateful:|gratitude:|g:)\s*/i, "").trim(),
        date: todayStr,
        createdAt: serverTimestamp(),
      });

    case "people_note":
    case "meeting":
    case "followup": {
      let followupDate = null;
      if (key_info?.deadline) {
        followupDate = Timestamp.fromDate(new Date(`${key_info.deadline}T09:00:00`));
      }
      return addDoc(col(uid, "people_notes"), {
        personId: null,
        personName: key_info?.personName || "Unknown",
        kind: type === "people_note" ? "note" : type,
        content: key_info?.content || key_info?.reason || text,
        followupDate,
        followupDone: false,
        date: key_info?.date || todayStr,
        createdAt: serverTimestamp(),
      });
    }

    case "travel":
      return addDoc(col(uid, "travel"), {
        destination: key_info?.destination || text,
        startDate: key_info?.startDate || null,
        endDate: key_info?.endDate || null,
        status: key_info?.status || "idea",
        notes: [],
        tags: [],
        createdAt: serverTimestamp(),
      });

    case "wishlist":
      return addDoc(col(uid, "wishlist"), {
        title: key_info?.title || text,
        kind: key_info?.kind || "other",
        recommendedBy: null,
        status: "want",
        createdAt: serverTimestamp(),
      });

    case "vault":
      return addDoc(col(uid, "vault"), {
        title: "Quick Access",
        content: key_info?.content || text.replace(/^(password:|secret:|vault:|pin:)\s*/i, "").trim(),
        category: "secure_note",
        createdAt: serverTimestamp(),
      });

    case "goal":
      return addDoc(col(uid, "goals"), {
        title: key_info?.title || text.replace(/^(goal:|target:)\s*/i, "").trim(),
        description: null,
        targetDate: key_info?.targetDate ? Timestamp.fromDate(new Date(`${key_info.targetDate}T09:00:00`)) : null,
        milestones: [],
        status: "active",
        createdAt: serverTimestamp(),
      });

    case "period":
      return addDoc(col(uid, "periods"), {
        startDate: todayStr,
        endDate: null,
        flow: "medium",
        symptoms: [],
        notes: key_info?.content || text.replace(/^(period:|cycle:)\s*/i, "").trim(),
        createdAt: serverTimestamp(),
      });

    default:
      // Fallback
      return addDoc(col(uid, "notes"), {
        kind: "thought",
        content: text,
        tags: [],
        status: "active",
        createdAt: serverTimestamp(),
      });
  }
}

// ── Real-time Data Subscriptions (No Mock Data) ───────────────────────────────

export interface HomeTask {
  id: string;
  title: string;
  type: "todo" | "routine" | "reminder";
  status: "overdue" | "today" | "completed";
  time?: string;
  streak?: string;
}

export function subscribeHomeTasks(uid: string, onUpdate: (tasks: HomeTask[]) => void) {
  let todosList: HomeTask[] = [];
  let routinesList: HomeTask[] = [];
  let remindersList: HomeTask[] = [];

  const emit = () => {
    onUpdate([...todosList, ...routinesList, ...remindersList]);
  };

  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Todos
  const qTodos = query(col(uid, "todos"), where("status", "!=", "archived"));
  const unsubTodos = onSnapshot(qTodos, (snap) => {
    todosList = snap.docs.map((d) => {
      const data = d.data();
      const isDone = data.status === "done";
      return {
        id: d.id,
        title: data.title || "Untitled task",
        type: "todo" as const,
        status: isDone ? ("completed" as const) : ("today" as const),
      };
    });
    emit();
  });

  // 2. Routines
  const qRoutines = query(col(uid, "routines"), where("status", "==", "active"));
  const unsubRoutines = onSnapshot(qRoutines, (snap) => {
    routinesList = snap.docs.map((d) => {
      const data = d.data();
      const isCompletedToday = Boolean(data.completionLog?.[todayStr]);
      return {
        id: d.id,
        title: data.title || "Routine",
        type: "routine" as const,
        status: isCompletedToday ? ("completed" as const) : ("today" as const),
        streak: data.streak ? `${data.streak}d` : undefined,
        time: data.schedule?.time,
      };
    });
    emit();
  });

  // 3. Reminders
  const qReminders = query(col(uid, "reminders"), where("status", "!=", "archived"));
  const unsubReminders = onSnapshot(qReminders, (snap) => {
    remindersList = snap.docs.map((d) => {
      const data = d.data();
      const isDone = data.status === "done";
      let timeStr: string | undefined = undefined;
      if (data.scheduledAt?.toDate) {
        const dt = data.scheduledAt.toDate();
        timeStr = dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }
      return {
        id: d.id,
        title: data.title || "Reminder",
        type: "reminder" as const,
        status: isDone ? ("completed" as const) : ("today" as const),
        time: timeStr,
      };
    });
    emit();
  });

  return () => {
    unsubTodos();
    unsubRoutines();
    unsubReminders();
  };
}

export async function toggleTaskCompletion(uid: string, task: HomeTask) {
  const isCompleted = task.status === "completed";
  const todayStr = new Date().toISOString().split("T")[0];

  if (task.type === "todo") {
    await updateDoc(doc(col(uid, "todos"), task.id), {
      status: isCompleted ? "pending" : "done",
      completedAt: isCompleted ? null : serverTimestamp(),
    });
  } else if (task.type === "reminder") {
    await updateDoc(doc(col(uid, "reminders"), task.id), {
      status: isCompleted ? "pending" : "done",
    });
  } else if (task.type === "routine") {
    await updateDoc(doc(col(uid, "routines"), task.id), {
      [`completionLog.${todayStr}`]: !isCompleted,
      streak: isCompleted ? increment(-1) : increment(1),
      lastCompletedAt: isCompleted ? null : serverTimestamp(),
    });
  }
}

export function subscribeLatestJournal(
  uid: string,
  onUpdate: (entry: { date: string; text: string } | null) => void
) {
  const q = query(col(uid, "journal"), orderBy("createdAt", "desc"), limit(1));
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      onUpdate(null);
    } else {
      const docData = snap.docs[0].data();
      onUpdate({
        date: docData.date || "Today",
        text: docData.content || "",
      });
    }
  });
}

export interface LiveNudge {
  id: string;
  iconType: "package" | "users" | "link";
  text: string;
}

export function subscribeHomeNudges(
  uid: string,
  onUpdate: (nudges: LiveNudge[]) => void
) {
  let stockNudges: LiveNudge[] = [];
  let linkNudges: LiveNudge[] = [];

  const emit = () => {
    onUpdate([...stockNudges, ...linkNudges]);
  };

  // Stock running low or out
  const qStock = query(col(uid, "stock"), where("threshold", "in", ["low", "out"]));
  const unsubStock = onSnapshot(qStock, (snap) => {
    stockNudges = snap.docs.slice(0, 2).map((d) => ({
      id: d.id,
      iconType: "package" as const,
      text: `${d.data().name || "Item"} is running low — add to shopping?`,
    }));
    emit();
  });

  // Unread links
  const qLinks = query(col(uid, "links"), where("read", "==", false));
  const unsubLinks = onSnapshot(qLinks, (snap) => {
    const unreadCount = snap.size;
    if (unreadCount > 0) {
      linkNudges = [
        {
          id: "unread-links",
          iconType: "link" as const,
          text: `${unreadCount} unread link${unreadCount > 1 ? "s" : ""} saved in your reading list`,
        },
      ];
    } else {
      linkNudges = [];
    }
    emit();
  });

  return () => {
    unsubStock();
    unsubLinks();
  };
}

// ── Clear All User Data (Purge Temporary / Test DB Data) ───────────────────────

export const ALL_USER_SUBCOLLECTIONS = [
  "todos",
  "reminders",
  "routines",
  "shopping",
  "stock",
  "ledger",
  "notes",
  "links",
  "journal",
  "gratitude",
  "people",
  "people_notes",
  "travel",
  "wishlist",
  "vault",
  "moods",
  "health",
  "periods",
  "goals",
  "location_errands",
  "nudges",
  "fcm_tokens",
  "graph_nodes",
  "graph_edges",
  "briefing_cache",
  "pending_classifications",
];

export async function clearAllUserData(uid: string): Promise<{ deletedCount: number }> {
  // One round trip — SQLite deletes the whole tree server-side.
  const deletedCount = await purgeCollections(
    ALL_USER_SUBCOLLECTIONS.map((sub) => `users/${uid}/${sub}`)
  );
  return { deletedCount };
}

