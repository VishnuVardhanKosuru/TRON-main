"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  IconChevronRight,
  IconPackage,
  IconUsers,
  IconLink,
  IconCalendarEvent,
  IconSparkles,
  IconAlertCircle,
  IconBolt,
  IconTrash,
  IconLoader2,
} from "@tabler/icons-react";
import AgentAvatar from "@/components/AgentAvatar";
import { useAuthContext } from "@/context/AuthContext";
import {
  subscribeHomeTasks,
  toggleTaskCompletion,
  subscribeLatestJournal,
  subscribeHomeNudges,
  clearAllUserData,
  HomeTask,
  LiveNudge,
} from "@/lib/db";

const DEFAULT_USER_NAME = "Lavanya";
const AGENT_NAME = "TRON";

export default function Home() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState<HomeTask[]>([]);
  const [journalSnippet, setJournalSnippet] = useState<{ date: string; text: string } | null>(null);
  const [nudges, setNudges] = useState<LiveNudge[]>([]);
  const [isClearingDb, setIsClearingDb] = useState(false);

  // Phase 3 AI Briefing State
  const [aiBriefing, setAiBriefing] = useState<string>("Loading briefing...");
  const [isRefreshingBriefing, setIsRefreshingBriefing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubTasks = subscribeHomeTasks(user.uid, setTasks);
    const unsubJournal = subscribeLatestJournal(user.uid, setJournalSnippet);
    const unsubNudges = subscribeHomeNudges(user.uid, setNudges);

    import("@/lib/briefing").then((m) => {
      m.getOrFetchBriefing(user.uid).then(setAiBriefing);
    });

    return () => {
      unsubTasks();
      unsubJournal();
      unsubNudges();
    };
  }, [user]);

  const refreshBriefing = async () => {
    if (!user) return;
    setIsRefreshingBriefing(true);
    setAiBriefing("Thinking...");
    try {
      const { getOrFetchBriefing } = await import("@/lib/briefing");
      const text = await getOrFetchBriefing(user.uid, true);
      setAiBriefing(text);
    } catch (e) {
      setAiBriefing("Briefing unavailable right now.");
    } finally {
      setIsRefreshingBriefing(false);
    }
  };

  const toggleTask = (task: HomeTask) => {
    if (!user) return;
    toggleTaskCompletion(user.uid, task);
  };

  const handleClearDatabase = async () => {
    if (!user) {
      alert("Please ensure you are signed in to clear your database.");
      return;
    }
    const confirmed = window.confirm(
      "Clear all TRON data? This permanently deletes every task, note and record from the local database. It cannot be undone."
    );
    if (!confirmed) return;

    try {
      setIsClearingDb(true);
      const res = await clearAllUserData(user.uid);
      alert(`Database cleared successfully! (${res.deletedCount} items deleted)`);
      setTasks([]);
      setNudges([]);
      setAiBriefing("All clear. Your mind is free to explore.");
    } catch (err: any) {
      console.error("Error clearing database:", err);
      alert("Failed to clear database: " + (err.message || String(err)));
    } finally {
      setIsClearingDb(false);
    }
  };

  const overdueTasks = tasks.filter((t) => t.status === "overdue");
  const todayTasks = tasks.filter((t) => t.status === "today");



  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning!";
    if (hour < 18) return "Good afternoon!";
    return "Good evening!";
  };

  const userName = user?.displayName ? user.displayName.split(" ")[0] : DEFAULT_USER_NAME;

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-3 pb-4">

      {/* ── Zone 1: Identity bar + T.R.O.N. acronym ───────────────────────── */}
      <div className="flex items-start justify-between pt-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-0">
            <span className="text-[19px] font-bold text-sky-400 tracking-wide" style={{ textShadow: '0 0 12px rgba(56,189,248,0.5)' }}>T</span>
            <span className="text-[11px] font-medium text-[var(--text-muted)] mx-[1px]">·</span>
            <span className="text-[19px] font-bold text-sky-400 tracking-wide" style={{ textShadow: '0 0 12px rgba(56,189,248,0.5)' }}>R</span>
            <span className="text-[11px] font-medium text-[var(--text-muted)] mx-[1px]">·</span>
            <span className="text-[19px] font-bold text-sky-400 tracking-wide" style={{ textShadow: '0 0 12px rgba(56,189,248,0.5)' }}>O</span>
            <span className="text-[11px] font-medium text-[var(--text-muted)] mx-[1px]">·</span>
            <span className="text-[19px] font-bold text-sky-400 tracking-wide" style={{ textShadow: '0 0 12px rgba(56,189,248,0.5)' }}>N</span>
          </div>
          <p className="text-[9.5px] text-[var(--text-muted)] m-0 leading-none tracking-[0.06em] font-mono uppercase">
            <span className="text-sky-400/70 font-semibold">T</span>houghtful{' '}
            <span className="text-sky-400/70 font-semibold">R</span>eactive{' '}
            <span className="text-sky-400/70 font-semibold">O</span>rchestration{' '}
            <span className="text-sky-400/70 font-semibold">N</span>ode
          </p>
        </div>
        
        <div className="flex items-center gap-2 -translate-y-1">
          {/* Quick Clear DB Button */}
          <button
            onClick={handleClearDatabase}
            disabled={isClearingDb}
            title="Clear all temporary database data"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10.5px] font-mono transition-all disabled:opacity-50 cursor-pointer"
          >
            {isClearingDb ? (
              <IconLoader2 size={12} className="animate-spin" />
            ) : (
              <IconTrash size={12} />
            )}
            <span>Clear DB</span>
          </button>

          {/* Tapping the avatar navigates to Synapse */}
          <Link href="/synapse" className="focus:outline-none">
            <motion.div
              whileTap={{ scale: 0.88 }}
              className="agent-avatar-wrapper"
            >
              <AgentAvatar size={40} />
            </motion.div>
          </Link>
        </div>
      </div>

      {/* ── Zone 2: Greeting + date ────────────────────── */}
      <div className="mt-0 mb-1">
        <p className="text-[18px] text-[var(--text-primary)] font-light leading-tight m-0 tracking-wide">
          {getGreeting()}
        </p>
        <p className="text-[28px] font-medium leading-tight m-0 tracking-[-0.5px] text-[var(--text-primary)]">
          {userName}
        </p>
        <div className="flex items-center gap-2 mt-1.5 opacity-70">
          <IconCalendarEvent size={13} className="text-[var(--text-primary)]" stroke={1.5} />
          <p className="text-[12px] text-[var(--text-primary)] tracking-wide m-0 font-medium">
            Today is {format(new Date(), "EEEE, d MMM yyyy")}
          </p>
        </div>
      </div>

      {/* ── Zone 3: From TRON Agent Summary Box (On Top) ────── */}
      <div className="glass-card p-3.5 relative overflow-hidden flex flex-col gap-2.5 border border-white/[0.08]">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/[0.04] via-transparent to-sky-500/[0.02] pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-sky-500/15 border border-sky-400/30 flex items-center justify-center">
              <IconSparkles size={11} className="text-sky-400" />
            </div>
            <span className="text-[12px] font-medium text-[var(--text-primary)] tracking-wide">From TRON</span>
          </div>
          <button 
            onClick={refreshBriefing}
            disabled={isRefreshingBriefing}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-400/10 border border-sky-400/20 hover:bg-sky-400/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <span className={`w-1.5 h-1.5 rounded-full bg-sky-400 ${isRefreshingBriefing ? 'animate-bounce' : 'animate-pulse'}`} />
            <span className="text-[9.5px] font-mono text-sky-300 uppercase tracking-wider">{isRefreshingBriefing ? 'Updating...' : 'AI Summary'}</span>
          </button>
        </div>

        {/* AI Summary text */}
        <div className="relative z-10 bg-white/[0.02] border border-white/[0.05] rounded-xl p-2.5">
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)] m-0">
            {aiBriefing}
          </p>
        </div>

        {/* Quick Attention */}
        <div className="relative z-10 flex flex-col gap-1.5">
          <p className="text-[9.5px] text-[var(--text-muted)] uppercase tracking-wider font-medium m-0 px-0.5">
            Quick Attention
          </p>

          {overdueTasks.slice(0, 1).map((t) => (
            <div
              key={t.id}
              onClick={() => toggleTask(t)}
              className="flex items-center gap-2.5 p-2 rounded-xl bg-red-500/[0.06] border border-red-500/20 hover:bg-red-500/[0.1] transition-all cursor-pointer group"
            >
              <IconAlertCircle size={14} className="text-red-400 shrink-0" stroke={1.8} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[var(--text-primary)] font-medium m-0 truncate">{t.title}</p>
                <p className="text-[10px] text-red-400/80 m-0 mt-0.5">Overdue • Tap to mark done</p>
              </div>
              <IconChevronRight size={13} className="text-[var(--text-muted)] group-hover:text-red-400 transition-all shrink-0" />
            </div>
          ))}

          {nudges.slice(0, 2).map((nudge) => {
            const Icon = nudge.iconType === "package" ? IconPackage : nudge.iconType === "users" ? IconUsers : IconLink;
            return (
              <div
                key={nudge.id}
                onClick={() => router.push("/menu")}
                className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] transition-all cursor-pointer group"
              >
                <Icon size={14} className="text-sky-400 shrink-0" stroke={1.8} />
                <p className="text-[12px] text-[var(--text-primary)] font-medium m-0 flex-1 truncate">{nudge.text}</p>
                <IconChevronRight size={13} className="text-[var(--text-muted)] group-hover:text-sky-400 transition-all shrink-0" />
              </div>
            );
          })}

          {todayTasks.filter((t) => t.status !== "completed").slice(0, overdueTasks.length > 0 ? 1 : 2).map((t) => (
            <div
              key={t.id}
              onClick={() => toggleTask(t)}
              className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] transition-all cursor-pointer group"
            >
              <IconBolt size={14} className="text-sky-400/80 shrink-0" stroke={1.8} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[var(--text-primary)] font-medium m-0 truncate">{t.title}</p>
                <p className="text-[10px] text-[var(--text-muted)] m-0 mt-0.5 truncate">
                  {t.time ? `Scheduled for ${t.time}` : t.streak ? `${t.streak} streak active` : "Tap to complete"}
                </p>
              </div>
              <IconChevronRight size={13} className="text-[var(--text-muted)] group-hover:text-sky-400 transition-all shrink-0" />
            </div>
          ))}

          {overdueTasks.length === 0 && nudges.length === 0 && todayTasks.filter((t) => t.status !== "completed").length === 0 && (
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
              <p className="text-[11px] text-[var(--text-muted)] m-0">Nothing urgent right now ✦</p>
            </div>
          )}
        </div>

        {/* Synapse footer link */}
        <Link
          href="/synapse"
          className="relative z-10 flex items-center justify-between pt-2 border-t border-white/[0.05] text-[11.5px] text-sky-400/80 hover:text-sky-300 transition-colors"
        >
          <span>Speak or brainstorm with TRON</span>
          <span className="flex items-center gap-1 font-medium text-[10.5px]">
            Synapse <IconChevronRight size={12} />
          </span>
        </Link>
      </div>

      {/* ── Zone 4: Zero State Card (Below From TRON) ────────── */}
      <Link
        href="/zero-state"
        className="glass-card px-4 py-4 relative overflow-hidden group border border-white/[0.08] hover:border-sky-400/30 transition-all flex items-center gap-5"
      >
        {/* Ambient gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/[0.08] via-sky-500/[0.03] to-transparent pointer-events-none" />

        {/* LEFT: Orb with pulsing rings & flowing light runner */}
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: 72, height: 72 }}>
          {/* Outer ring */}
          <div
            className="absolute rounded-full border border-sky-400/20 pointer-events-none"
            style={{ width: 70, height: 70, animation: "medit-ring-outer 3.5s ease-in-out infinite" }}
          />

          {/* Inner border ring with flowing light runner */}
          <div
            className="absolute rounded-full pointer-events-none flex items-center justify-center"
            style={{ width: 50, height: 50, animation: "medit-ring-inner 3s ease-in-out infinite" }}
          >
            {/* Static base blue border */}
            <div className="absolute inset-0 rounded-full border border-sky-400/35" />

            {/* Running light along the border outline: flowing cyan dash & point */}
            <svg
              className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
              viewBox="0 0 50 50"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Glowing cyan trailing dash */}
              <circle
                cx="25"
                cy="25"
                r="24"
                stroke="#bae6fd"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeDasharray="14 136.796"
                className="orb-dash-runner"
                style={{
                  filter: "drop-shadow(0 0 4px #bae6fd) drop-shadow(0 0 8px #38bdf8)",
                }}
              />
              {/* Brilliant flowing white leading point */}
              <circle
                cx="25"
                cy="25"
                r="24"
                stroke="#ffffff"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="2.5 148.296"
                className="orb-dot-runner"
                style={{
                  filter: "drop-shadow(0 0 4px #ffffff) drop-shadow(0 0 8px #bae6fd)",
                }}
              />
            </svg>
          </div>

          {/* SVG figure */}
          <svg
            width="52"
            height="52"
            viewBox="0 0 96 96"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="relative z-10"
            style={{ filter: "drop-shadow(0 0 10px rgba(14,165,233,0.7))" }}
          >
            <circle cx="48" cy="16" r="7" stroke="#0ea5e9" strokeWidth="2.5" fill="none"
              style={{ animation: "medit-glow 3s ease-in-out infinite" }}
            />
            <line x1="48" y1="23" x2="48" y2="50" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round"
              style={{ animation: "medit-glow 3s ease-in-out infinite", animationDelay: "0.2s" }}
            />
            <path d="M48 35 Q34 38 24 48" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" fill="none"
              style={{ animation: "medit-glow 3s ease-in-out infinite", animationDelay: "0.4s" }}
            />
            <path d="M48 35 Q62 38 72 48" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" fill="none"
              style={{ animation: "medit-glow 3s ease-in-out infinite", animationDelay: "0.6s" }}
            />
            <path d="M48 50 Q38 60 20 65 Q30 68 48 66" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" fill="none"
              style={{ animation: "medit-glow 3s ease-in-out infinite", animationDelay: "0.8s" }}
            />
            <path d="M48 50 Q58 60 76 65 Q66 68 48 66" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" fill="none"
              style={{ animation: "medit-glow 3s ease-in-out infinite", animationDelay: "1.0s" }}
            />
            <circle cx="24" cy="48" r="2.5"
              style={{ animation: "medit-dot 3s ease-in-out infinite", animationDelay: "0.5s" }}
            />
            <circle cx="72" cy="48" r="2.5"
              style={{ animation: "medit-dot 3s ease-in-out infinite", animationDelay: "0.5s" }}
            />
          </svg>
        </div>

        {/* RIGHT: Text */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0 relative z-10">
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-semibold text-[var(--text-primary)] m-0 tracking-wide">Zero State</p>
            <span className="text-[8.5px] font-mono text-sky-400 uppercase tracking-wider bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-400/20 shrink-0">
              Sanctuary
            </span>
          </div>
          <p className="text-[12px] text-[var(--text-muted)] m-0 leading-snug">
            Need a moment just for yourself?
          </p>
          <p className="text-[11.5px] text-sky-400/70 m-0 leading-snug">
            Breathe. Be still. Come back to you.
          </p>
          <div className="flex items-center gap-1 text-[11px] text-sky-400/60 group-hover:text-sky-300 transition-colors mt-0.5">
            <span>Enter sanctuary</span>
            <IconChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </Link>

    </div>
  );
}
