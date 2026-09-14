"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronLeft,
  IconHeartbeat,
  IconDroplet,
  IconCalendar,
  IconPill,
  IconPlus,
  IconTrash,
  IconAlertCircle,
  IconClock,
  IconFlame,
  IconStethoscope,
} from "@tabler/icons-react";
import { useAuthContext } from "@/context/AuthContext";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "@/lib/tron/firestore";
import { db } from "@/lib/local-db";

export type FlowLevel = "spotting" | "light" | "medium" | "heavy";

interface PeriodRecord {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  flow: FlowLevel;
  symptoms: string[];
  notes?: string;
  createdAt?: any;
}

interface GeneralHealthNote {
  id: string;
  kind: "symptom" | "medication" | "appointment";
  note: string;
  date: string;
  createdAt?: any;
}

const SYMPTOM_OPTIONS = [
  "Cramps (Mild)",
  "Cramps (Severe)",
  "Headache",
  "Bloating",
  "Fatigue",
  "Lower Back Pain",
  "Tender Breasts",
  "Mood Swings",
  "Cravings",
  "Nausea",
];

const initialDemoPeriods: PeriodRecord[] = [];

const initialDemoHealthNotes: GeneralHealthNote[] = [];

export default function HealthPage() {
  const { user } = useAuthContext();

  const [activeTab, setActiveTab] = useState<"cycle" | "health">("cycle");

  // Periods State
  const [periods, setPeriods] = useState<PeriodRecord[]>(initialDemoPeriods);
  const [isLoggingPeriod, setIsLoggingPeriod] = useState(false);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedFlow, setSelectedFlow] = useState<FlowLevel>("medium");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [periodNotes, setPeriodNotes] = useState("");

  // Health Notes State
  const [healthNotes, setHealthNotes] = useState<GeneralHealthNote[]>(initialDemoHealthNotes);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteKind, setNoteKind] = useState<"symptom" | "medication" | "appointment">("medication");
  const [noteContent, setNoteContent] = useState("");

  // Live sync with the local store
  useEffect(() => {
    if (!user) {
      setPeriods([]);
      setHealthNotes([]);
      return;
    }
    const qPeriods = query(collection(db, "users", user.uid, "periods"), orderBy("createdAt", "desc"));
    const unsubPeriods = onSnapshot(qPeriods, (snap) => {
      setPeriods(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PeriodRecord)));
    });

    const qHealth = query(collection(db, "users", user.uid, "health"), orderBy("createdAt", "desc"));
    const unsubHealth = onSnapshot(qHealth, (snap) => {
      setHealthNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GeneralHealthNote)));
    });

    return () => {
      unsubPeriods();
      unsubHealth();
    };
  }, [user]);

  // Cycle calculations
  const latestPeriod = periods[0];
  const isPeriodActive = latestPeriod && !latestPeriod.endDate;

  const cycleDays = useMemo(() => {
    if (!latestPeriod) return null;
    const start = new Date(latestPeriod.startDate).getTime();
    const now = Date.now();
    const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1);
  }, [latestPeriod]);

  const toggleSymptom = (sym: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleSavePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: Omit<PeriodRecord, "id"> = {
      startDate: logDate,
      endDate: null,
      flow: selectedFlow,
      symptoms: selectedSymptoms,
      notes: periodNotes.trim() || undefined,
    };

    if (user) {
      try {
        await addDoc(collection(db, "users", user.uid, "periods"), {
          ...newEntry,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Failed to save period", err);
      }
    } else {
      setPeriods((prev) => [{ id: "p_" + Date.now(), ...newEntry }, ...prev]);
    }

    setPeriodNotes("");
    setSelectedSymptoms([]);
    setIsLoggingPeriod(false);
  };

  const handleEndCurrentPeriod = async () => {
    if (!latestPeriod) return;
    const today = new Date().toISOString().split("T")[0];
    setPeriods((prev) =>
      prev.map((p) => (p.id === latestPeriod.id ? { ...p, endDate: today } : p))
    );
  };

  const handleSaveHealthNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    const newNote: Omit<GeneralHealthNote, "id"> = {
      kind: noteKind,
      note: noteContent.trim(),
      date: new Date().toISOString().split("T")[0],
    };

    if (user) {
      try {
        await addDoc(collection(db, "users", user.uid, "health"), {
          ...newNote,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Failed to save health note", err);
      }
    } else {
      setHealthNotes((prev) => [{ id: "h_" + Date.now(), ...newNote }, ...prev]);
    }

    setNoteContent("");
    setIsAddingNote(false);
  };

  const handleDeletePeriod = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "periods", id));
      } catch (err) {}
    }
    setPeriods((prev) => prev.filter((p) => p.id !== id));
  };

  const handleDeleteHealth = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "health", id));
      } catch (err) {}
    }
    setHealthNotes((prev) => prev.filter((h) => h.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white flex flex-col selection:bg-rose-500/30">
      {/* ── Top Header ────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#0a0c10]/80 backdrop-blur-xl">
        <Link
          href="/menu?item=health"
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <IconChevronLeft size={20} />
          <span className="text-sm font-medium">Menu</span>
        </Link>
        <div className="flex items-center gap-2">
          <IconHeartbeat size={18} className="text-rose-400" />
          <span className="font-semibold text-sm tracking-wide text-white">Health & Cycle</span>
        </div>
        <div className="w-12" />
      </header>

      <main className="flex-1 flex flex-col max-w-md w-full mx-auto p-5 space-y-6">
        {/* ── Tab Switcher: Cycle Tracker vs General Health ─ */}
        <div className="flex p-1 rounded-2xl bg-white/[0.04] border border-white/5">
          <button
            onClick={() => setActiveTab("cycle")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "cycle"
                ? "bg-rose-500 text-white shadow-[0_0_16px_rgba(244,63,94,0.35)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            <IconDroplet size={14} />
            <span>Cycle & Periods</span>
          </button>
          <button
            onClick={() => setActiveTab("health")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "health"
                ? "bg-rose-500 text-white shadow-[0_0_16px_rgba(244,63,94,0.35)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            <IconStethoscope size={14} />
            <span>Health & Meds</span>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "cycle" ? (
            /* ── CYCLE & PERIOD TRACKER ──────────────────── */
            <motion.div
              key="cycle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              {/* Cycle Status Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-rose-950/40 via-black to-[#130d12] border border-rose-500/30 relative overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full text-[10.5px] font-bold tracking-wider uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    {isPeriodActive ? "● Period Active" : "Cycle Tracking"}
                  </span>
                  {isPeriodActive && (
                    <button
                      onClick={handleEndCurrentPeriod}
                      className="text-[11px] text-white/50 hover:text-rose-300 underline transition-colors"
                    >
                      Mark as Ended
                    </button>
                  )}
                </div>

                <div className="space-y-1 mb-5">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">
                    {isPeriodActive ? `Day ${cycleDays}` : `Cycle Day ${cycleDays ?? 14}`}
                  </h2>
                  <p className="text-xs text-rose-200/60">
                    {isPeriodActive
                      ? `Flow: ${latestPeriod.flow} · Started ${latestPeriod.startDate}`
                      : "Estimated ~14 days until next cycle"}
                  </p>
                </div>

                {/* Quick Log Action */}
                <button
                  onClick={() => setIsLoggingPeriod(true)}
                  className="w-full py-3 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs tracking-wide transition-all shadow-[0_0_24px_rgba(244,63,94,0.4)] flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  <IconPlus size={16} stroke={2.5} />
                  <span>Log Flow & Symptoms</span>
                </button>
              </div>

              {/* Past Period History */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 px-1 flex items-center gap-1.5">
                  <IconCalendar size={14} className="text-rose-400" />
                  <span>Cycle History</span>
                </h3>

                <div className="space-y-3">
                  {periods.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                            <IconDroplet size={16} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white tracking-tight">
                              {item.startDate} {item.endDate ? `→ ${item.endDate}` : "(Active)"}
                            </span>
                            <p className="text-[11px] text-white/40 capitalize">
                              {item.flow} flow
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeletePeriod(item.id)}
                          className="p-1.5 text-white/20 hover:text-rose-400 transition-colors"
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>

                      {item.notes && (
                        <p className="text-xs text-white/70 italic pl-1">{item.notes}</p>
                      )}

                      {item.symptoms && item.symptoms.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {item.symptoms.map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[10px]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── GENERAL HEALTH & MEDS ───────────────────── */
            <motion.div
              key="health"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              {/* Header + Add Action */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/50">
                  {healthNotes.length} health logs
                </span>
                <button
                  onClick={() => setIsAddingNote(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs shadow-[0_0_16px_rgba(244,63,94,0.3)] transition-colors"
                >
                  <IconPlus size={14} stroke={2.5} />
                  <span>Log Health Note</span>
                </button>
              </div>

              {/* Health Notes List */}
              <div className="space-y-2.5">
                {healthNotes.map((h) => {
                  const icon =
                    h.kind === "medication" ? (
                      <IconPill size={15} className="text-emerald-400" />
                    ) : h.kind === "appointment" ? (
                      <IconCalendar size={15} className="text-sky-400" />
                    ) : (
                      <IconAlertCircle size={15} className="text-sky-400" />
                    );
                  return (
                    <div
                      key={h.id}
                      className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-white/[0.05]">{icon}</div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                            {h.kind}
                          </span>
                          <span className="text-[11px] text-white/30">· {h.date}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteHealth(h.id)}
                          className="p-1 text-white/20 hover:text-rose-400 transition-colors"
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                      <p className="text-xs text-white/80 pl-1 leading-relaxed">{h.note}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Log Period Modal ──────────────────────────────── */}
      <AnimatePresence>
        {isLoggingPeriod && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-[#141014] border border-rose-500/30 p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base">Log Period & Symptoms</h3>
                <button
                  onClick={() => setIsLoggingPeriod(false)}
                  className="text-white/40 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSavePeriod} className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white focus:outline-none focus:border-rose-400"
                  />
                </div>

                {/* Flow Pills */}
                <div>
                  <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider block mb-1.5">
                    Flow Level
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["spotting", "light", "medium", "heavy"] as FlowLevel[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setSelectedFlow(f)}
                        className={`py-2 rounded-xl text-xs font-medium capitalize transition-all ${
                          selectedFlow === f
                            ? "bg-rose-500 text-white border border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                            : "bg-white/[0.03] text-white/50 border border-white/5 hover:text-white"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Symptoms */}
                <div>
                  <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider block mb-1.5">
                    Symptoms
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {SYMPTOM_OPTIONS.map((sym) => {
                      const active = selectedSymptoms.includes(sym);
                      return (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => toggleSymptom(sym)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                            active
                              ? "bg-rose-500/25 text-rose-200 border border-rose-500/50"
                              : "bg-white/[0.03] text-white/40 border border-white/5 hover:text-white/70"
                          }`}
                        >
                          {sym}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider block mb-1">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    value={periodNotes}
                    onChange={(e) => setPeriodNotes(e.target.value)}
                    placeholder="E.g. Cramp severity, hydration, supplements taken..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsLoggingPeriod(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.05] text-white/70 text-xs font-semibold hover:bg-white/[0.1]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold shadow-[0_0_16px_rgba(244,63,94,0.3)]"
                  >
                    Save Entry
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Log General Health Note Modal ─────────────────── */}
      <AnimatePresence>
        {isAddingNote && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-[#141214] border border-white/10 p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base">New Health Note</h3>
                <button
                  onClick={() => setIsAddingNote(false)}
                  className="text-white/40 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveHealthNote} className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider block mb-1">
                    Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["medication", "symptom", "appointment"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setNoteKind(k)}
                        className={`py-2 rounded-xl text-xs font-medium capitalize transition-all ${
                          noteKind === k
                            ? "bg-rose-500 text-white border border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                            : "bg-white/[0.03] text-white/50 border border-white/5 hover:text-white"
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider block mb-1">
                    Details
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="E.g. Ibuprofen 400mg taken, or Dr. Smith follow up..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingNote(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.05] text-white/70 text-xs font-semibold hover:bg-white/[0.1]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold shadow-[0_0_16px_rgba(244,63,94,0.3)]"
                  >
                    Save Note
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
