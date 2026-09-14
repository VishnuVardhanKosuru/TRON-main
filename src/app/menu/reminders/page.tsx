"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuthContext } from "@/context/AuthContext";
import { collection, query, onSnapshot } from "@/lib/tron/firestore";
import { db } from "@/lib/local-db";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronLeft,
  IconChevronDown,
  IconSearch,
  IconCheck,
  IconRefresh,
  IconPlus,
} from "@tabler/icons-react";
import Link from "next/link";

// --- Types ---
type Reminder = {
  id: string;
  title: string;
  dueAt: Date;
  completedAt: Date | null;
  mirrored?: boolean; // Synced with Google Tasks / Calendar
  createdAt: Date;
};

export default function RemindersPage() {
  const { user } = useAuthContext();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPastExpanded, setIsPastExpanded] = useState(false);
  const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set());
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "reminders"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Reminder[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          title: data.title || "",
          dueAt: data.scheduledAt?.toDate() || new Date(),
          completedAt: data.status === "done" ? new Date() : null,
          mirrored: false,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });
      setReminders(items);
    });
    return () => unsubscribe();
  }, [user]);

  // Active items count (not completed, excluding items in the middle of completing animation)
  const activeCount = useMemo(() => {
    return reminders.filter((r) => !r.completedAt && !justCompletedIds.has(r.id)).length;
  }, [reminders, justCompletedIds]);

  // Filtered by search text
  const filteredReminders = useMemo(() => {
    if (!searchQuery.trim()) return reminders;
    const q = searchQuery.toLowerCase();
    return reminders.filter((r) => r.title.toLowerCase().includes(q));
  }, [reminders, searchQuery]);

  // Grouping
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000 - 1);

  const groups = useMemo(() => {
    const overdue: Reminder[] = [];
    const today: Reminder[] = [];
    const upcoming: Reminder[] = [];
    const past: Reminder[] = [];

    filteredReminders.forEach((r) => {
      const isActuallyCompleted = r.completedAt && !justCompletedIds.has(r.id);

      if (isActuallyCompleted) {
        past.push(r);
        return;
      }

      if (r.dueAt < startOfToday) {
        overdue.push(r);
      } else if (r.dueAt <= endOfToday) {
        today.push(r);
      } else {
        upcoming.push(r);
      }
    });

    overdue.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
    today.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
    upcoming.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
    past.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

    return { overdue, today, upcoming, past };
  }, [filteredReminders, startOfToday, endOfToday, justCompletedIds]);

  const handleToggle = (id: string) => {
    const r = reminders.find((item) => item.id === id);
    if (!r) return;

    if (r.completedAt) {
      // Unmark completed immediately
      setReminders((prev) =>
        prev.map((item) => (item.id === id ? { ...item, completedAt: null } : item))
      );
    } else {
      // Settle animation before moving to Past
      setJustCompletedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      setReminders((prev) =>
        prev.map((item) => (item.id === id ? { ...item, completedAt: new Date() } : item))
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

  const formatDueTime = (d: Date) => {
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday) {
      return `Today, ${timeStr}`;
    }

    const tomorrow = new Date(now.getTime() + 86400000);
    const isTomorrow =
      d.getDate() === tomorrow.getDate() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getFullYear() === tomorrow.getFullYear();

    if (isTomorrow) {
      return `Tomorrow, ${timeStr}`;
    }

    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${dateStr}, ${timeStr}`;
  };

  const renderItem = (reminder: Reminder, dotColorClass: string) => {
    const isJustCompleted = justCompletedIds.has(reminder.id);
    const isCompleted = !!reminder.completedAt;

    let dotBorder = dotColorClass;
    let dotBg = "bg-[#05070d]";
    let textColor = "text-white/95";
    let containerBg = "bg-white/[0.02]";
    let containerBorder = "border border-white/5";

    if (isCompleted || isJustCompleted) {
      dotBorder = "border-sky-400/60";
      dotBg = "bg-sky-400/15";
      textColor = "text-white/40 line-through";
      containerBg = "bg-sky-500/[0.08]";
      containerBorder = "border border-sky-500/10";
    }

    return (
      <motion.div
        key={reminder.id}
        layout="position"
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: isCompleted && !isJustCompleted ? 0.5 : isJustCompleted ? 0.55 : 1,
          y: 0,
        }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={`flex items-start gap-4 py-2 group cursor-pointer rounded-lg ${containerBg} ${containerBorder} transition-all hover:bg-white/[0.04] hover:border-white/10`}
        onClick={() => {
          // Placeholder for opening full note detail view
        }}
      >
        {/* Dot on Spine */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(reminder.id);
          }}
          className={`relative mt-[3px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] ${dotBorder} ${dotBg} flex items-center justify-center transition-all duration-300 z-10`}
        >
          <AnimatePresence>
            {(isCompleted || isJustCompleted) && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ duration: 0.2 }}
              >
                <IconCheck size={10} stroke={3} className="text-sky-400" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Text & Timing Content */}
        <div className="flex-1 flex justify-between items-start gap-3 pr-2">
          <span
            className={`text-[15.5px] font-medium leading-snug transition-all duration-500 ${textColor}`}
          >
            {reminder.title}
          </span>

          {!isCompleted && !isJustCompleted && (
            <div className="flex items-center gap-1.5 shrink-0 mt-[2px]">
              {reminder.mirrored && (
                <span
                  title="Mirrored to Google Calendar / Tasks"
                  className="text-white/35 flex items-center"
                >
                  <IconRefresh size={12} stroke={2} className="text-sky-400/60" />
                </span>
              )}
              <span className="text-[12.5px] font-normal text-white/45 whitespace-nowrap">
                {formatDueTime(reminder.dueAt)}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white overflow-x-hidden selection:bg-sky-500/20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 glass-bg-elevated backdrop-blur-xl border-b border-white/5 pt-12 pb-4 px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/menu?item=reminders"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20 transition-all"
          >
            <IconChevronLeft size={20} className="text-white/70" />
          </Link>
          <h1 className="text-[20px] font-medium tracking-tight">Reminders</h1>
          <button
            onClick={() => setIsAddOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-sky-400 text-[#05070d] active:scale-95 hover:scale-105 transition-all"
            title="Add reminder"
          >
            <IconPlus size={18} stroke={2.5} />
          </button>
        </div>
        <div className="text-[13px] text-white/40 font-mono">{activeCount} upcoming</div>
      </header>

      {/* Main Content Area */}
      <main className="px-5 pt-6 pb-24">
        {/* Search Bar */}
        <div className="relative mb-8">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <IconSearch size={16} className="text-white/30" />
          </div>
          <input
            type="text"
            placeholder="Search reminders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full glass-bg border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/30 transition-all"
          />
        </div>

        {/* Reminders Spine Container */}
        {filteredReminders.length === 0 ? (
          <div className="mt-16 text-center text-[15px] text-white/30">Nothing here yet.</div>
        ) : (
          <div className="relative">
            {/* Continuous Vertical Spine Line */}
            <div className="absolute top-2 bottom-6 left-[7px] w-[1px] bg-gradient-to-b from-sky-500/30 via-white/10 to-sky-500/30 z-0" />

            <div className="flex flex-col gap-8 relative z-10">
              {/* Overdue */}
              {groups.overdue.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-[11px] font-semibold tracking-widest uppercase text-red-400 pl-8">
                    Overdue
                  </h2>
                  <div className="flex flex-col gap-1">
                    <AnimatePresence>
                      {groups.overdue.map((r) => renderItem(r, "border-red-400/80"))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Today */}
              {groups.today.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-[11px] font-semibold tracking-widest uppercase text-sky-400 pl-8">
                    Today
                  </h2>
                  <div className="flex flex-col gap-1">
                    <AnimatePresence>
                      {groups.today.map((r) => renderItem(r, "border-sky-400/90"))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Upcoming */}
              {groups.upcoming.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-[11px] font-semibold tracking-widest uppercase text-white/40 pl-8">
                    Upcoming
                  </h2>
                  <div className="flex flex-col gap-1">
                    <AnimatePresence>
                      {groups.upcoming.map((r) => renderItem(r, "border-white/40"))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Past (Collapsible) */}
              {groups.past.length > 0 && (
                <div className="flex flex-col gap-3 mt-4">
                  <div className="pl-6 relative">
                    <div className="absolute top-0 bottom-0 left-[-24px] w-[30px] bg-[#05070d] z-0" />

                    <button
                      onClick={() => setIsPastExpanded(!isPastExpanded)}
                      className="relative z-10 flex items-center gap-2 group py-1"
                    >
                      <IconChevronDown
                        size={14}
                        className={`text-sky-400/60 transition-transform duration-300 ${
                          isPastExpanded ? "rotate-180" : ""
                        }`}
                      />
                      <h2 className="text-[11px] font-semibold tracking-widest uppercase text-white/30 group-hover:text-sky-400/80 transition-colors">
                        Past ({groups.past.length})
                      </h2>
                    </button>
                  </div>

                  <AnimatePresence>
                    {isPastExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-1 pt-1 pb-4">
                          {groups.past.map((r) => renderItem(r, "border-white/20"))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Add Reminder Bottom Sheet Modal ───────────────────────── */}
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
              className="relative w-full max-w-md bg-[#05070d] border-t border-white/10 rounded-t-3xl p-6 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[18px] font-medium tracking-tight text-white">New Reminder</h3>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20 transition-all"
                >
                  <IconCheck size={20} className="text-white/60" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-[13px] text-white/50 uppercase tracking-wider font-medium mb-2 block">
                    Title
                  </label>
                  <input
                    type="text"
                    placeholder="What do you need to remember?"
                    className="w-full glass-bg border border-white/10 rounded-xl py-3 px-4 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/30 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[13px] text-white/50 uppercase tracking-wider font-medium mb-2 block">
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full glass-bg border border-white/10 rounded-xl py-3 px-4 text-[15px] text-white focus:outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/30 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-white/80 text-[15px] font-medium hover:bg-white/[0.02] active:bg-white/[0.04] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-sky-400 text-[#05070d] text-[15px] font-medium hover:opacity-90 active:scale-95 transition-all"
                >
                  Add Reminder
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
