"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronLeft,
  IconTarget,
  IconCheck,
  IconPlus,
  IconTrash,
  IconTrophy,
  IconCalendar,
  IconFlag,
  IconCircleCheck,
} from "@tabler/icons-react";
import { useAuthContext } from "@/context/AuthContext";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "@/lib/tron/firestore";
import { db } from "@/lib/local-db";

interface Milestone {
  id: string;
  text: string;
  completed: boolean;
}

interface GoalItem {
  id: string;
  title: string;
  description?: string;
  targetDate?: string; // YYYY-MM-DD
  category?: string;
  status: "active" | "achieved" | "abandoned";
  milestones: Milestone[];
  createdAt?: any;
}

const initialDemoGoals: GoalItem[] = [];

export default function GoalsPage() {
  const { user } = useAuthContext();

  const [goals, setGoals] = useState<GoalItem[]>(initialDemoGoals);
  const [filterStatus, setFilterStatus] = useState<"active" | "achieved">("active");

  // New Goal Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newCategory, setNewCategory] = useState("Productivity");
  const [milestoneInputs, setMilestoneInputs] = useState<string[]>(["", ""]);

  // Live sync with the local store
  useEffect(() => {
    if (!user) {
      setGoals([]);
      return;
    }
    const q = query(collection(db, "users", user.uid, "goals"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setGoals(
        snap.docs.map((d) => {
          const data = d.data();
          // Format milestones array if needed
          const ms: Milestone[] = (data.milestones || []).map((m: any, idx: number) => {
            if (typeof m === "string") return { id: `m_${idx}`, text: m, completed: false };
            return m;
          });
          return {
            id: d.id,
            ...data,
            milestones: ms,
          } as GoalItem;
        })
      );
    });
    return () => unsub();
  }, [user]);

  const toggleMilestone = async (goalId: string, milestoneId: string) => {
    const updatedGoals = goals.map((g) => {
      if (g.id !== goalId) return g;
      const nextMs = g.milestones.map((m) =>
        m.id === milestoneId ? { ...m, completed: !m.completed } : m
      );
      const allCompleted = nextMs.length > 0 && nextMs.every((m) => m.completed);
      return {
        ...g,
        milestones: nextMs,
        status: allCompleted ? ("achieved" as const) : g.status,
      };
    });

    setGoals(updatedGoals);

    if (user) {
      const targetGoal = updatedGoals.find((g) => g.id === goalId);
      if (targetGoal) {
        try {
          await updateDoc(doc(db, "users", user.uid, "goals", goalId), {
            milestones: targetGoal.milestones,
            status: targetGoal.status,
          });
        } catch (err) {
          console.error("Failed to update goal", err);
        }
      }
    }
  };

  const handleAddMilestoneInput = () => {
    setMilestoneInputs((prev) => [...prev, ""]);
  };

  const handleMilestoneInputChange = (index: number, val: string) => {
    setMilestoneInputs((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const validMilestones: Milestone[] = milestoneInputs
      .filter((m) => m.trim().length > 0)
      .map((text, idx) => ({
        id: `ms_${Date.now()}_${idx}`,
        text: text.trim(),
        completed: false,
      }));

    const newGoal: Omit<GoalItem, "id"> = {
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      targetDate: newDate || undefined,
      category: newCategory,
      status: "active",
      milestones: validMilestones,
    };

    if (user) {
      try {
        await addDoc(collection(db, "users", user.uid, "goals"), {
          ...newGoal,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Failed to add goal", err);
      }
    } else {
      setGoals((prev) => [{ id: "g_" + Date.now(), ...newGoal }, ...prev]);
    }

    setNewTitle("");
    setNewDesc("");
    setNewDate("");
    setMilestoneInputs(["", ""]);
    setIsAddOpen(false);
  };

  const handleDeleteGoal = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "goals", id));
      } catch (err) {}
    }
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const filteredGoals = useMemo(() => {
    return goals.filter((g) => g.status === filterStatus);
  }, [goals, filterStatus]);

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white flex flex-col selection:bg-sky-500/30">
      {/* ── Top Header ────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#0a0c10]/80 backdrop-blur-xl">
        <Link
          href="/menu?item=goals"
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <IconChevronLeft size={20} />
          <span className="text-sm font-medium">Menu</span>
        </Link>
        <div className="flex items-center gap-2">
          <IconTarget size={18} className="text-sky-400" />
          <span className="font-semibold text-sm tracking-wide text-white">Goals & Milestones</span>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="p-1.5 rounded-full bg-sky-500 hover:bg-sky-400 text-black shadow-[0_0_16px_rgba(56,189,248,0.3)] transition-all"
        >
          <IconPlus size={16} stroke={2.5} />
        </button>
      </header>

      <main className="flex-1 flex flex-col max-w-md w-full mx-auto p-5 space-y-5">
        {/* ── Active vs Achieved Tabs ───────────────────────── */}
        <div className="flex p-1 rounded-2xl bg-white/[0.04] border border-white/5">
          <button
            onClick={() => setFilterStatus("active")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              filterStatus === "active"
                ? "bg-sky-500 text-black shadow-[0_0_16px_rgba(56,189,248,0.3)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            <IconFlag size={14} />
            <span>Active Goals</span>
          </button>
          <button
            onClick={() => setFilterStatus("achieved")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              filterStatus === "achieved"
                ? "bg-sky-500 text-black shadow-[0_0_16px_rgba(56,189,248,0.3)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            <IconTrophy size={14} />
            <span>Achieved</span>
          </button>
        </div>

        {/* ── Goals List ────────────────────────────────────── */}
        <div className="space-y-4">
          {filteredGoals.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-white/10 rounded-3xl">
              <IconTarget size={32} className="mx-auto text-white/20 mb-2" />
              <p className="text-xs text-white/40">No {filterStatus} goals found.</p>
            </div>
          ) : (
            filteredGoals.map((goal) => {
              const totalMilestones = goal.milestones.length;
              const completedMilestones = goal.milestones.filter((m) => m.completed).length;
              const progressPct =
                totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors space-y-4 shadow-lg"
                >
                  {/* Top Bar of Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {goal.category && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-sky-400/10 text-sky-400 border border-sky-400/20">
                          {goal.category}
                        </span>
                      )}
                      <h3 className="text-base font-bold text-white tracking-tight mt-1.5">
                        {goal.title}
                      </h3>
                      {goal.description && (
                        <p className="text-xs text-white/60 mt-1 leading-relaxed">
                          {goal.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="p-1 text-white/20 hover:text-rose-400 transition-colors shrink-0"
                    >
                      <IconTrash size={15} />
                    </button>
                  </div>

                  {/* Progress Bar & Countdown */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-medium text-white/50">
                      <span>
                        {completedMilestones} of {totalMilestones} milestones
                      </span>
                      <span className="text-sky-400 font-bold">{progressPct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-sky-500 to-sky-300 rounded-full shadow-[0_0_8px_#38bdf8]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  {/* Target Date */}
                  {goal.targetDate && (
                    <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                      <IconCalendar size={13} className="text-sky-400" />
                      <span>Target: {goal.targetDate}</span>
                    </div>
                  )}

                  {/* Milestones Checklist */}
                  {goal.milestones.length > 0 && (
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <span className="text-[10.5px] uppercase font-semibold tracking-wider text-white/30 block">
                        Milestones
                      </span>
                      <div className="space-y-1.5">
                        {goal.milestones.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => toggleMilestone(goal.id, m.id)}
                            className="flex items-center gap-2.5 p-2 rounded-xl bg-black/20 hover:bg-black/40 cursor-pointer border border-white/[0.03] transition-colors"
                          >
                            <div
                              className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                                m.completed
                                  ? "bg-sky-400 text-black shadow-[0_0_8px_#38bdf8]"
                                  : "border border-white/30 bg-transparent"
                              }`}
                            >
                              {m.completed && <IconCheck size={12} stroke={3} />}
                            </div>
                            <span
                              className={`text-xs leading-snug select-none ${
                                m.completed ? "line-through text-white/40" : "text-white/90"
                              }`}
                            >
                              {m.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </main>

      {/* ── Add Goal Modal ───────────────────────────────── */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-[#14171e] border border-white/10 p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base">New Objective / Goal</h3>
                <button onClick={() => setIsAddOpen(false)} className="text-white/40 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateGoal} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider block mb-1">
                    Goal Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Master TypeScript & Ship SaaS"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider block mb-1">
                    Description / Rationale
                  </label>
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Why this matters..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider block mb-1">
                      Target Date
                    </label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider block mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="e.g. Health, Career"
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>

                {/* Milestones inputs */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
                      Milestones
                    </label>
                    <button
                      type="button"
                      onClick={handleAddMilestoneInput}
                      className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                    >
                      <IconPlus size={12} /> Add Step
                    </button>
                  </div>
                  <div className="space-y-2">
                    {milestoneInputs.map((val, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={val}
                        onChange={(e) => handleMilestoneInputChange(idx, e.target.value)}
                        placeholder={`Milestone #${idx + 1}`}
                        className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/20 focus:outline-none focus:border-sky-400"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.05] text-white/70 text-xs font-semibold hover:bg-white/[0.1]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-semibold shadow-[0_0_16px_rgba(56,189,248,0.3)]"
                  >
                    Create Goal
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
