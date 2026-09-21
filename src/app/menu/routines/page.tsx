"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuthContext } from "@/context/AuthContext";
import { collection, query, onSnapshot } from "@/lib/tron/firestore";
import { db } from "@/lib/local-db";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronLeft,
  IconPlus,
  IconCheck,
  IconX,
  IconFlame,
  IconClock,
  IconCalendar,
  IconRepeat,
} from "@tabler/icons-react";
import Link from "next/link";

// --- Types ---
export type Routine = {
  id: string;
  name: string;
  recurrenceDesc: string; // e.g. "Weekdays, 6:00 PM"
  recurrenceType: "daily" | "weekdays" | "interval";
  weekdays?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  intervalDays?: number;
  timeOfDay: string; // e.g. "18:00"
  streak: number; // e.g. 12
  isDueToday: boolean;
  completedToday: boolean;
  nextOccurrence: string; // e.g. "Tomorrow, 8:00 AM" or "Monday, 6:00 PM"
  completion_log: string[]; // ISO date strings e.g. "2026-09-05", "2026-09-04"
};

// Generate simulated completion dates for the last 28 days
const generateHistory = (rate = 0.85, streak = 12): string[] => {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 1; i <= 28; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (i <= streak || Math.random() < rate) {
      dates.push(dateStr);
    }
  }
  return dates;
};

export default function RoutinesPage() {
  const { user } = useAuthContext();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "routines"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Routine[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          name: data.title || data.name || "",
          recurrenceDesc: data.frequency || "daily",
          recurrenceType: data.frequency === "weekly" ? "weekdays" : "daily",
          weekdays: [1, 2, 3, 4, 5],
          intervalDays: 1,
          timeOfDay: "Morning",
          streak: data.streak || 0,
          isDueToday: true, // simplified for now
          completedToday: data.lastCompleted ? new Date(data.lastCompleted.toDate()).toDateString() === new Date().toDateString() : false,
          nextOccurrence: "Tomorrow",
          completion_log: data.completion_log || [],
        });
      });
      setRoutines(items);
    });
    return () => unsubscribe();
  }, [user]);

  // Modal / Sheet states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);

  // Add Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"daily" | "weekdays" | "interval">("daily");
  const [formWeekdays, setFormWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [formInterval, setFormInterval] = useState<number>(2);
  const [formTime, setFormTime] = useState("09:00");

  // Format time (e.g. "18:00" -> "6:00 PM")
  const formatTimeStr = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  };

  // Group routines
  const groups = useMemo(() => {
    const dueToday: Routine[] = [];
    const notDueToday: Routine[] = [];

    routines.forEach((r) => {
      // If it is due today and hasn't settled yet into completed state
      if (r.isDueToday && !r.completedToday) {
        dueToday.push(r);
      } else {
        notDueToday.push(r);
      }
    });

    return { dueToday, notDueToday };
  }, [routines]);

  // Toggle routine for today
  const handleToggle = (id: string) => {
    const r = routines.find((item) => item.id === id);
    if (!r) return;

    if (r.completedToday) {
      // Revert completion
      setRoutines((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                completedToday: false,
                streak: Math.max(0, item.streak - 1),
                completion_log: item.completion_log.slice(1),
              }
            : item
        )
      );
    } else {
      // Complete today: animate in place, settle, then shift
      setJustCompletedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      const todayStr = new Date().toISOString().split("T")[0];

      setRoutines((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                completedToday: true,
                streak: item.streak + 1,
                completion_log: [todayStr, ...item.completion_log],
              }
            : item
        )
      );

      setTimeout(() => {
        setJustCompletedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 550);
    }
  };

  // Handle Add Submit
  const handleCreateRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    let desc = "Daily";
    if (formType === "weekdays") {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      if (formWeekdays.length === 5 && !formWeekdays.includes(0) && !formWeekdays.includes(6)) {
        desc = "Weekdays";
      } else {
        desc = formWeekdays.map((d) => dayNames[d]).join(", ");
      }
    } else if (formType === "interval") {
      desc = `Every ${formInterval} days`;
    }
    desc += `, ${formatTimeStr(formTime)}`;

    const newRoutine: Routine = {
      id: `rt_${Date.now()}`,
      name: formName.trim(),
      recurrenceDesc: desc,
      recurrenceType: formType,
      weekdays: formWeekdays,
      intervalDays: formInterval,
      timeOfDay: formTime,
      streak: 0,
      isDueToday: true,
      completedToday: false,
      nextOccurrence: `Today, ${formatTimeStr(formTime)}`,
      completion_log: [],
    };

    setRoutines((prev) => [newRoutine, ...prev]);
    setIsAddOpen(false);
    setFormName("");
  };

  // Calendar Heatmap Grid Renderer for 28 days
  const renderHistoryGrid = (log: string[]) => {
    const days: { date: Date; dateStr: string; completed: boolean }[] = [];
    const today = new Date();

    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      days.push({
        date: d,
        dateStr,
        completed: log.includes(dateStr),
      });
    }

    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center text-[11px] font-mono text-white/40">
          <span>4 weeks history</span>
          <span>{log.length} total completed</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/10">
          {days.map((day, idx) => (
            <div
              key={idx}
              title={`${day.dateStr}: ${day.completed ? "Completed" : "Skipped"}`}
              className={`aspect-square rounded-[5px] flex items-center justify-center transition-all ${
                day.completed
                  ? "bg-sky-400 text-[#050a14] font-bold"
                  : "bg-white/5 border border-white/10"
              }`}
            >
              {day.completed && <IconCheck size={10} stroke={3} />}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px] text-white/30 px-1">
          <span>28 days ago</span>
          <span>Today</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white overflow-x-hidden selection:bg-sky-500/20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 glass-bg-elevated backdrop-blur-xl border-b border-white/5 pt-12 pb-4 px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/menu?item=routines"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20 transition-all"
          >
            <IconChevronLeft size={20} className="text-white/70" />
          </Link>
          <h1 className="text-[20px] font-medium tracking-tight">Routines</h1>
        </div>

        {/* Structured Add Button */}
        <button
          onClick={() => setIsAddOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-sky-400 text-[#05070d] active:scale-95 hover:scale-105 transition-all"
          title="Add routine"
        >
          <IconPlus size={18} stroke={2.5} />
        </button>
      </header>

      {/* Main Content */}
      <main className="px-5 pt-6 pb-24">
        {routines.length === 0 ? (
          <div className="mt-16 text-center text-[15px] text-white/30">
            No routines configured yet.
          </div>
        ) : (
          <div className="relative">
            {/* Continuous Vertical Spine Line */}
            <div className="absolute top-2 bottom-6 left-[7px] w-[1px] bg-gradient-to-b from-sky-500/30 via-white/10 to-sky-500/30 z-0" />

            <div className="flex flex-col gap-8 relative z-10">
              {/* Due Today */}
              {groups.dueToday.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-[11px] font-semibold tracking-widest uppercase text-sky-400 pl-8">
                    Due Today
                  </h2>
                  <div className="flex flex-col gap-1">
                    <AnimatePresence>
                      {groups.dueToday.map((r) => {
                        const isJustCompleted = justCompletedIds.has(r.id);

                        return (
                          <motion.div
                            key={r.id}
                            layout="position"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{
                              opacity: isJustCompleted ? 0.55 : 1,
                              y: 0,
                            }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className="flex items-start gap-4 py-2 group cursor-pointer"
                            onClick={() => setSelectedRoutine(r)}
                          >
                            {/* Checkbox Dot on Spine */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggle(r.id);
                              }}
                              className={`relative mt-[3px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] border-sky-400 bg-[#050a14] flex items-center justify-center transition-all duration-300 z-10`}
                            >
                              <AnimatePresence>
                                {isJustCompleted && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0 }}
                                  >
                                    <IconCheck size={10} stroke={3} className="text-white/80" />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Content */}
                            <div className="flex-1 flex justify-between items-start gap-3 pr-2">
                              <div className="flex flex-col">
                                <span
                                  className={`text-[15.5px] font-medium leading-snug transition-all ${
                                    isJustCompleted ? "line-through text-white/40" : "text-white/95"
                                  }`}
                                >
                                  {r.name}
                                </span>
                                <span className="text-[12px] text-white/45 mt-0.5">
                                  {r.recurrenceDesc}
                                </span>
                              </div>

                              {/* Streak badge */}
                              {r.streak > 0 && (
                                <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[11.5px] font-mono mt-0.5">
                                  <IconFlame size={12} stroke={2.2} />
                                  <span>{r.streak}d</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Not Due Today */}
              {groups.notDueToday.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-[11px] font-semibold tracking-widest uppercase text-white/40 pl-8">
                    Not Due Today
                  </h2>
                  <div className="flex flex-col gap-1">
                    <AnimatePresence>
                      {groups.notDueToday.map((r) => {
                        const isCompletedToday = r.completedToday;

                        return (
                          <motion.div
                            key={r.id}
                            layout="position"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`flex items-start gap-4 py-2 group cursor-pointer rounded-lg bg-white/[0.02] border border-white/5 transition-all hover:bg-white/[0.04] hover:border-white/10 ${isCompletedToday ? "opacity-60" : "opacity-100 hover:opacity-100"}`}
                            onClick={() => setSelectedRoutine(r)}
                          >
                            {/* Disabled / Completed Dot */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isCompletedToday) handleToggle(r.id);
                              }}
                              className={`relative mt-[3px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] transition-all duration-300 z-10 ${
                                isCompletedToday
                                  ? "border-sky-400/60 bg-sky-400/20"
                                  : "border-white/20 bg-[#05070d]"
                              } flex items-center justify-center`}
                            >
                              {isCompletedToday && (
                                <IconCheck size={10} stroke={3} className="text-sky-400" />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 flex justify-between items-start gap-3 pr-2">
                              <div className="flex flex-col">
                                <span className={`text-[15.5px] font-medium leading-snug transition-all ${
                                  isCompletedToday ? "line-through text-white/40" : "text-white/95"
                                }`}>
                                  {r.name}
                                </span>
                                <span className="text-[12px] text-white/45 mt-0.5">
                                  {isCompletedToday
                                    ? "Completed today"
                                    : `Next: ${r.nextOccurrence}`}
                                </span>
                              </div>

                              {/* Streak badge */}
                              {r.streak > 0 && (
                                <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[11.5px] font-mono mt-0.5">
                                  <IconFlame size={12} stroke={2.2} />
                                  <span>{r.streak}d</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Add Routine Bottom Sheet Modal ───────────────────────── */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md bg-[#1c160f] border-t border-white/10 rounded-t-3xl p-6 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[18px] font-medium tracking-tight text-white">New Routine</h3>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60"
                >
                  <IconX size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateRoutine} className="flex flex-col gap-4">
                {/* Field 1: Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                    Routine name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Read 20 pages"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-[15px] text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                {/* Field 2: Recurrence pattern */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                    Recurrence pattern
                  </label>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                    {(["daily", "weekdays", "interval"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormType(t)}
                        className={`py-1.5 text-[12.5px] font-medium rounded-lg capitalize transition-all ${
                          formType === t
                            ? "bg-sky-400 text-[#050a14] font-semibold"
                            : "text-white/60 hover:text-white"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Weekday Selector */}
                  {formType === "weekdays" && (
                    <div className="flex justify-between gap-1.5 mt-2">
                      {["S", "M", "T", "W", "T", "F", "S"].map((name, dayIndex) => {
                        const isSelected = formWeekdays.includes(dayIndex);
                        return (
                          <button
                            key={dayIndex}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (formWeekdays.length > 1) {
                                  setFormWeekdays(formWeekdays.filter((d) => d !== dayIndex));
                                }
                              } else {
                                setFormWeekdays([...formWeekdays, dayIndex]);
                              }
                            }}
                            className={`w-9 h-9 rounded-full text-[12px] font-medium flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-sky-400/20 text-sky-400 border border-sky-400/50"
                                : "bg-white/5 text-white/40 border border-white/10"
                            }`}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Interval Selector */}
                  {formType === "interval" && (
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[13px] text-white/60">Repeat every</span>
                      <input
                        type="number"
                        min={2}
                        max={30}
                        value={formInterval}
                        onChange={(e) => setFormInterval(Math.max(2, Number(e.target.value)))}
                        className="w-16 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-center font-mono text-white text-[14px]"
                      />
                      <span className="text-[13px] text-white/60">days</span>
                    </div>
                  )}
                </div>

                {/* Field 3: Time of day */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                    Time of day
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-[15px] font-mono text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-3 py-3 rounded-xl bg-sky-400 text-[#050a14] font-medium text-[15px] active:scale-[0.99] transition-transform"
                >
                  Create routine
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Routine Detail & History Visualization Modal ─────────── */}
      <AnimatePresence>
        {selectedRoutine && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRoutine(null)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md bg-[#1c160f] border-t border-white/10 rounded-t-3xl p-6 shadow-2xl z-10 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-[19px] font-semibold text-white tracking-tight leading-tight">
                    {selectedRoutine.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[12.5px] text-sky-400/90 font-medium">
                      {selectedRoutine.recurrenceDesc}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/30" />
                    <span className="text-[12px] font-mono text-white/50">
                      Streak: {selectedRoutine.streak}d
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedRoutine(null)}
                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60"
                >
                  <IconX size={16} />
                </button>
              </div>

              {/* Recurrence Settings Overview */}
              <div className="flex flex-col gap-2 my-5 p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-[13px]">
                <div className="flex items-center justify-between text-white/70">
                  <span className="flex items-center gap-2">
                    <IconRepeat size={14} className="text-sky-400" />
                    Pattern
                  </span>
                  <span className="capitalize font-mono text-white/90">
                    {selectedRoutine.recurrenceType}
                  </span>
                </div>
                <div className="flex items-center justify-between text-white/70">
                  <span className="flex items-center gap-2">
                    <IconClock size={14} className="text-sky-400" />
                    Time scheduled
                  </span>
                  <span className="font-mono text-white/90">
                    {formatTimeStr(selectedRoutine.timeOfDay)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-white/70">
                  <span className="flex items-center gap-2">
                    <IconCalendar size={14} className="text-sky-400" />
                    Status today
                  </span>
                  <span className="font-medium text-white/90">
                    {selectedRoutine.completedToday
                      ? "Completed"
                      : selectedRoutine.isDueToday
                      ? "Due today"
                      : "Rest day"}
                  </span>
                </div>
              </div>

              {/* Calendar Grid Visualization of History */}
              <div className="mt-4">
                <h4 className="text-[12px] font-mono uppercase tracking-wider text-white/50 mb-2">
                  Completion Log
                </h4>
                {renderHistoryGrid(selectedRoutine.completion_log)}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    handleToggle(selectedRoutine.id);
                    setSelectedRoutine((prev) =>
                      prev
                        ? {
                            ...prev,
                            completedToday: !prev.completedToday,
                            streak: prev.completedToday
                              ? Math.max(0, prev.streak - 1)
                              : prev.streak + 1,
                          }
                        : null
                    );
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-[14px] font-medium transition-all ${
                    selectedRoutine.completedToday
                      ? "bg-white/10 text-white/80 border border-white/10"
                      : "bg-sky-400 text-[#050a14]"
                  }`}
                >
                  {selectedRoutine.completedToday ? "Mark not completed" : "Mark completed today"}
                </button>
                <button
                  onClick={() => setSelectedRoutine(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-[14px]"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
