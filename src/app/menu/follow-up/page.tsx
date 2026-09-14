"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronLeft,
  IconCheck,
  IconClock,
  IconUser,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Threshold in days: people not mentioned in > 30 days appear here
const FOLLOW_UP_THRESHOLD_DAYS = 30;

type PersonFollowUpRecord = {
  id: string;
  name: string;
  bio?: string;
  lastMentionedAt: Date;
  lastContactedOverride?: Date | null;
};

const initialPeopleIndex: PersonFollowUpRecord[] = [];

export default function FollowUpPage() {
  const router = useRouter();
  const [people, setPeople] = useState<PersonFollowUpRecord[]>(initialPeopleIndex);
  const [justCaughtUpIds, setJustCaughtUpIds] = useState<Set<string>>(new Set());

  const now = Date.now();
  const MS_PER_DAY = 86400000;

  // Computed follow-up list:
  // 1. Effective last contact = override timestamp || lastMentionedAt
  // 2. Filter to people older than 30 days
  // 3. Sort oldest-contact-first (longest silence at top)
  const followUpQueue = useMemo(() => {
    return people
      .map((p) => {
        const effectiveDate = p.lastContactedOverride ?? p.lastMentionedAt;
        const diffMs = now - effectiveDate.getTime();
        const daysAgo = Math.floor(diffMs / MS_PER_DAY);
        return {
          ...p,
          daysAgo,
          effectiveDate,
        };
      })
      .filter((p) => p.daysAgo >= FOLLOW_UP_THRESHOLD_DAYS && !justCaughtUpIds.has(p.id))
      .sort((a, b) => b.daysAgo - a.daysAgo); // Longest silence first
  }, [people, justCaughtUpIds, now]);

  // Mark as caught up action (records override timestamp, resets position)
  const handleMarkCaughtUp = (id: string) => {
    // Add to animation set
    setJustCaughtUpIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    // Record lightweight manual override timestamp
    setPeople((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, lastContactedOverride: new Date() } : item
      )
    );

    setTimeout(() => {
      setJustCaughtUpIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 450);
  };

  return (
    <div className="min-h-screen bg-[#18120a] text-white overflow-x-hidden selection:bg-sky-500/20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#18120a]/85 backdrop-blur-xl border-b border-white/5 pt-12 pb-4 px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/menu?item=followup"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 active:bg-white/10 transition-colors"
          >
            <IconChevronLeft size={20} className="text-white/70" />
          </Link>
          <h1 className="text-[20px] font-medium tracking-tight">Follow up</h1>
        </div>
        <div className="text-[13px] text-white/40 font-mono">
          {followUpQueue.length} {followUpQueue.length === 1 ? "nudge" : "nudges"}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-5 pt-6 pb-24">
        {/* Nudge Context Explanation */}
        <div className="mb-6 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-[12.5px] text-white/50 leading-relaxed">
          <p className="m-0">
            Contacts not referenced anywhere in TRON in over{" "}
            <span className="text-sky-400 font-medium">30 days</span>. Longest silence
            is sorted to the top.
          </p>
        </div>

        {/* Follow-up Queue along Spine */}
        {followUpQueue.length === 0 ? (
          <div className="mt-16 text-center text-[15px] text-white/30">
            All caught up. No contacts overdue for a check-in.
          </div>
        ) : (
          <div className="relative">
            {/* Continuous Vertical Spine Line */}
            <div className="absolute top-2 bottom-6 left-[7px] w-[1px] bg-white/10 z-0" />

            <div className="flex flex-col gap-2 relative z-10">
              <AnimatePresence>
                {followUpQueue.map((person) => {
                  const isExiting = justCaughtUpIds.has(person.id);

                  return (
                    <motion.div
                      key={person.id}
                      layout="position"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{
                        opacity: isExiting ? 0.3 : 1,
                        y: 0,
                      }}
                      exit={{ opacity: 0, scale: 0.95, x: -10 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="flex items-start gap-4 py-2.5 group"
                    >
                      {/* Amber Accent Dot on Spine */}
                      <div className="relative mt-[5px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] border-sky-400/80 bg-[#18120a] flex items-center justify-center z-10">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                      </div>

                      {/* Content Row */}
                      <div className="flex-1 flex justify-between items-center pr-2">
                        {/* Tapping name navigates to People profile page */}
                        <div
                          onClick={() => router.push("/menu/people")}
                          className="flex flex-col cursor-pointer group/name"
                        >
                          <span className="text-[16px] font-medium text-white/95 leading-snug group-hover/name:text-sky-300 transition-colors">
                            {person.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <IconClock size={11} className="text-sky-400/70" />
                            <span className="text-[12px] text-white/40 font-mono">
                              Last mentioned {person.daysAgo} days ago
                            </span>
                          </div>
                        </div>

                        {/* "Mark as caught up" Action Button */}
                        <button
                          onClick={() => handleMarkCaughtUp(person.id)}
                          className="px-3 py-1 rounded-full text-[12px] font-medium font-mono text-sky-400/90 bg-sky-400/10 border border-sky-400/30 hover:bg-sky-400 hover:text-[#18120a] active:scale-95 transition-all shrink-0 ml-3"
                          title="Reset follow-up timer without adding a note"
                        >
                          Caught up
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
