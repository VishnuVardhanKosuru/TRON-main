"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronLeft,
  IconMoodSmile,
  IconSparkles,
  IconCalendar,
  IconPlus,
  IconTrash,
  IconChartBar,
} from "@tabler/icons-react";
import { useAuthContext } from "@/context/AuthContext";
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy, limit } from "@/lib/tron/firestore";
import { db } from "@/lib/local-db";

export type MoodLevel = "great" | "good" | "okay" | "rough" | "bad";

interface MoodRecord {
  id: string;
  mood: MoodLevel;
  tags?: string[];
  note: string;
  date: string; // YYYY-MM-DD
  createdAt?: any;
}

const MOOD_CONFIG: Record<
  MoodLevel,
  { label: string; emoji: string; color: string; bg: string; border: string }
> = {
  great: {
    label: "Great",
    emoji: "🌟",
    color: "#38bdf8",
    bg: "rgba(56,189,248, 0.15)",
    border: "rgba(56,189,248, 0.4)",
  },
  good: {
    label: "Good",
    emoji: "😊",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.15)",
    border: "rgba(16, 185, 129, 0.4)",
  },
  okay: {
    label: "Okay",
    emoji: "😐",
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.15)",
    border: "rgba(56, 189, 248, 0.4)",
  },
  rough: {
    label: "Rough",
    emoji: "😔",
    color: "#fb923c",
    bg: "rgba(251, 146, 60, 0.15)",
    border: "rgba(251, 146, 60, 0.4)",
  },
  bad: {
    label: "Bad",
    emoji: "😫",
    color: "#f43f5e",
    bg: "rgba(244, 63, 94, 0.15)",
    border: "rgba(244, 63, 94, 0.4)",
  },
};

const AVAILABLE_TAGS = [
  "Work",
  "Family",
  "Sleep",
  "Fitness",
  "Social",
  "Stress",
  "Solitude",
  "Creative",
  "Health",
];

const initialDemoMoods: MoodRecord[] = [];

export default function MoodPage() {
  const { user } = useAuthContext();

  const [moods, setMoods] = useState<MoodRecord[]>(initialDemoMoods);
  const [selectedMood, setSelectedMood] = useState<MoodLevel>("good");
  const [selectedTags, setSelectedTags] = useState<string[]>(["Work"]);
  const [noteText, setNoteText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedToday, setSubmittedToday] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Live sync with the local store
  useEffect(() => {
    if (!user) {
      setMoods([]);
      return;
    }
    const q = query(collection(db, "users", user.uid, "moods"), orderBy("createdAt", "desc"), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      const loaded = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as MoodRecord));
      setMoods(loaded);
      const hasToday = loaded.some((m) => m.date === todayStr);
      setSubmittedToday(hasToday);
    });
    return () => unsub();
  }, [user, todayStr]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleLogMood = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const newRecord: Omit<MoodRecord, "id"> = {
      mood: selectedMood,
      tags: selectedTags,
      note: noteText.trim(),
      date: todayStr,
    };

    if (user) {
      try {
        await addDoc(collection(db, "users", user.uid, "moods"), {
          ...newRecord,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Failed to save mood", err);
      }
    } else {
      setMoods((prev) => [{ id: "m_" + Date.now(), ...newRecord }, ...prev]);
    }

    setNoteText("");
    setIsSubmitting(false);
    setSubmittedToday(true);
  };

  const handleDelete = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "moods", id));
      } catch (err) {
        console.error("Failed to delete mood", err);
      }
    }
    setMoods((prev) => prev.filter((m) => m.id !== id));
  };

  // Distribution stats
  const stats = useMemo(() => {
    const counts: Record<MoodLevel, number> = { great: 0, good: 0, okay: 0, rough: 0, bad: 0 };
    moods.forEach((m) => {
      if (counts[m.mood] !== undefined) counts[m.mood]++;
    });
    return counts;
  }, [moods]);

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white flex flex-col selection:bg-sky-500/30">
      {/* ── Top Header ────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#0a0c10]/80 backdrop-blur-xl">
        <Link
          href="/menu?item=mood"
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <IconChevronLeft size={20} />
          <span className="text-sm font-medium">Menu</span>
        </Link>
        <div className="flex items-center gap-2">
          <IconMoodSmile size={18} className="text-sky-400" />
          <span className="font-semibold text-sm tracking-wide text-white">Mood Tracker</span>
        </div>
        <div className="w-12" />
      </header>

      <main className="flex-1 flex flex-col max-w-md w-full mx-auto p-5 space-y-6">
        {/* ── Daily Check-in Card ───────────────────────────── */}
        <section className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[10.5px] uppercase tracking-wider font-semibold text-sky-400">
                Daily Check-in
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">How are you feeling?</h2>
            </div>
            {submittedToday && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                Logged Today
              </span>
            )}
          </div>

          {/* 5 Mood Selectors */}
          <div className="grid grid-cols-5 gap-2 mb-5">
            {(Object.keys(MOOD_CONFIG) as MoodLevel[]).map((level) => {
              const cfg = MOOD_CONFIG[level];
              const isSelected = selectedMood === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSelectedMood(level)}
                  className={`flex flex-col items-center justify-center py-3 rounded-2xl transition-all duration-200 ${
                    isSelected
                      ? "scale-105 shadow-[0_0_20px_rgba(56,189,248,0.2)]"
                      : "opacity-60 hover:opacity-100 bg-white/[0.02]"
                  }`}
                  style={{
                    backgroundColor: isSelected ? cfg.bg : undefined,
                    border: `1px solid ${isSelected ? cfg.border : "rgba(255,255,255,0.05)"}`,
                  }}
                >
                  <span className="text-2xl mb-1">{cfg.emoji}</span>
                  <span
                    className="text-[10px] font-semibold tracking-tight"
                    style={{ color: isSelected ? cfg.color : "rgba(255,255,255,0.7)" }}
                  >
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Context Tag Pills */}
          <div className="mb-4">
            <span className="text-[11px] text-white/40 block mb-2 font-medium">What contributed?</span>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? "bg-white/20 text-white border border-white/30"
                        : "bg-white/[0.03] text-white/40 border border-white/5 hover:text-white/70"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes Input */}
          <form onSubmit={handleLogMood} className="space-y-3">
            <textarea
              rows={2}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="What's on your mind? (optional reflection)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-400/50 transition-colors"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-semibold text-xs transition-all shadow-[0_0_16px_rgba(56,189,248,0.25)] active:scale-[0.99]"
            >
              {submittedToday ? "Update Today's Mood" : "Log Mood Entry"}
            </button>
          </form>
        </section>

        {/* ── Distribution Mini Bar ─────────────────────────── */}
        <section className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span className="flex items-center gap-1.5 font-medium">
              <IconChartBar size={14} className="text-sky-400" />
              <span>Recent Distribution</span>
            </span>
            <span>{moods.length} entries recorded</span>
          </div>
          <div className="flex h-2 w-full rounded-full overflow-hidden bg-white/5 gap-0.5">
            {(Object.keys(MOOD_CONFIG) as MoodLevel[]).map((lvl) => {
              const count = stats[lvl];
              const pct = moods.length > 0 ? (count / moods.length) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={lvl}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: MOOD_CONFIG[lvl].color,
                  }}
                  title={`${MOOD_CONFIG[lvl].label}: ${count}`}
                />
              );
            })}
          </div>
        </section>

        {/* ── Timeline of Past Moods ────────────────────────── */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 px-1">
            Mood History
          </h3>

          <div className="space-y-2.5">
            {moods.map((record) => {
              const cfg = MOOD_CONFIG[record.mood] ?? MOOD_CONFIG.okay;
              return (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{cfg.emoji}</span>
                      <div>
                        <span className="text-xs font-semibold text-white mr-2">
                          {cfg.label}
                        </span>
                        <span className="text-[11px] text-white/40">{record.date}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="p-1 text-white/20 hover:text-rose-400 transition-colors"
                      title="Delete"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>

                  {record.note && (
                    <p className="text-xs text-white/80 leading-relaxed pl-1">{record.note}</p>
                  )}

                  {record.tags && record.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 pl-1">
                      {record.tags.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[10px] text-white/50 border border-white/5"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
