"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronLeft,
  IconSend,
} from "@tabler/icons-react";
import Link from "next/link";

export type DiaryEntry = {
  id: string;
  text: string;
  timestamp: Date;
  tag: "journal" | "gratitude";
};

export type TimelineDiaryProps = {
  title: string;
  tag: "journal" | "gratitude";
  composerPlaceholder: string;
  initialEntries: DiaryEntry[];
};

// Helper to format day headers ("Today", "Yesterday", or "Sep 4, 2026")
function getDayHeader(date: Date, now: Date): string {
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function TimelineDiary({
  title,
  tag,
  composerPlaceholder,
  initialEntries,
}: TimelineDiaryProps) {
  const [entries, setEntries] = useState<DiaryEntry[]>(initialEntries);
  const [inputText, setInputText] = useState("");

  const now = new Date();

  // Group entries by day (newest day group first)
  const dayGroups = useMemo(() => {
    const map = new Map<string, { label: string; date: Date; items: DiaryEntry[] }>();

    // Sort entries newest first overall
    const sorted = [...entries].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    sorted.forEach((item) => {
      const dayKey = `${item.timestamp.getFullYear()}-${String(
        item.timestamp.getMonth() + 1
      ).padStart(2, "0")}-${String(item.timestamp.getDate()).padStart(2, "0")}`;

      if (!map.has(dayKey)) {
        map.set(dayKey, {
          label: getDayHeader(item.timestamp, now),
          date: item.timestamp,
          items: [],
        });
      }
      map.get(dayKey)!.items.push(item);
    });

    return Array.from(map.values());
  }, [entries, now]);

  // Handle immediate submission (bypasses all classification/AI pipelines)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newEntry: DiaryEntry = {
      id: `${tag}_${Date.now()}`,
      text: inputText.trim(),
      timestamp: new Date(),
      tag,
    };

    setEntries((prev) => [newEntry, ...prev]);
    setInputText("");
  };

  return (
    <div className="min-h-screen bg-[#18120a] text-white overflow-x-hidden selection:bg-sky-500/20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#18120a]/85 backdrop-blur-xl border-b border-white/5 pt-12 pb-4 px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={tag === "gratitude" ? "/menu?item=gratitude" : "/menu?item=journal"}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 active:bg-white/10 transition-colors"
          >
            <IconChevronLeft size={20} className="text-white/70" />
          </Link>
          <h1 className="text-[20px] font-medium tracking-tight">{title}</h1>
        </div>
        <div className="text-[13px] text-white/40 font-mono">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-5 pt-6 pb-28">
        {/* Inline Composer: Always visible, direct submit */}
        <form onSubmit={handleSubmit} className="relative mb-8">
          <input
            type="text"
            placeholder={composerPlaceholder}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:border-sky-400/60 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-sky-400 text-[#18120a] flex items-center justify-center disabled:opacity-30 disabled:bg-white/10 disabled:text-white/30 transition-all active:scale-95"
            title="Post entry"
          >
            <IconSend size={15} stroke={2.5} />
          </button>
        </form>

        {entries.length === 0 ? (
          <div className="mt-16 text-center text-[15px] text-white/30">
            No entries logged yet. Write your first reflection above.
          </div>
        ) : (
          <div className="relative">
            {/* Continuous Vertical Spine Line */}
            <div className="absolute top-2 bottom-6 left-[7px] w-[1px] bg-white/10 z-0" />

            <div className="flex flex-col gap-8 relative z-10">
              {dayGroups.map((group) => (
                <div key={group.label} className="flex flex-col gap-3">
                  {/* Day Section Header */}
                  <div className="pl-8">
                    <h2 className="text-[11px] font-semibold tracking-widest uppercase text-sky-400 font-mono">
                      {group.label}
                    </h2>
                  </div>

                  {/* Entries for this day */}
                  <div className="flex flex-col gap-2">
                    <AnimatePresence>
                      {group.items.map((entry) => (
                        <motion.div
                          key={entry.id}
                          layout="position"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="flex items-start gap-4 py-1.5 group"
                        >
                          {/* Accent Dot on Spine */}
                          <div className="relative mt-[5px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] border-sky-400/70 bg-[#18120a] flex items-center justify-center z-10">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                          </div>

                          {/* Text + Timestamp Content */}
                          <div className="flex-1 flex justify-between items-baseline gap-3 pr-2">
                            <span className="text-[15.5px] font-normal text-white/95 leading-relaxed">
                              {entry.text}
                            </span>
                            <span className="text-[11.5px] font-mono text-white/35 shrink-0 whitespace-nowrap">
                              {formatTime(entry.timestamp)}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
