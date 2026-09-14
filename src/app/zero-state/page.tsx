"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { IconChevronLeft, IconPlayerPlay, IconPlayerPause, IconRotateClockwise } from "@tabler/icons-react";

export default function ZeroStatePage() {
  const [phase, setPhase] = useState<"Inhale" | "Hold" | "Exhale" | "Rest">("Inhale");
  const [isActive, setIsActive] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(3);
  const [secondsRemaining, setSecondsRemaining] = useState(3 * 60);

  // 4-4-4-4 Box breathing rhythm
  useEffect(() => {
    if (!isActive) return;

    const phases: ("Inhale" | "Hold" | "Exhale" | "Rest")[] = ["Inhale", "Hold", "Exhale", "Rest"];
    let phaseIndex = 0;

    const interval = setInterval(() => {
      phaseIndex = (phaseIndex + 1) % phases.length;
      setPhase(phases[phaseIndex]);
    }, 4000);

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [isActive]);

  const toggleSession = () => {
    if (!isActive && secondsRemaining === 0) {
      setSecondsRemaining(sessionMinutes * 60);
    }
    setIsActive(!isActive);
  };

  const resetSession = (mins: number) => {
    setIsActive(false);
    setSessionMinutes(mins);
    setSecondsRemaining(mins * 60);
    setPhase("Inhale");
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen flex flex-col justify-between pt-4 pb-24 px-4 select-none relative overflow-hidden">
      {/* ── Background subtle glows ─────────────────────────────────── */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] bg-[#0ea5e9]/10 rounded-full blur-[100px] pointer-events-none" />

      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between z-10">
        <Link
          href="/"
          className="w-10 h-10 rounded-full flex items-center justify-center glass-card text-[var(--text-muted)] hover:text-white transition-colors"
        >
          <IconChevronLeft size={20} stroke={1.8} />
        </Link>
        <div className="text-center">
          <h1 className="text-[16px] font-semibold text-white tracking-wide m-0">Zero State</h1>
          <p className="text-[10px] text-sky-400/80 uppercase tracking-widest font-mono m-0 mt-0.5">Sanctuary</p>
        </div>
        <div className="w-10" />
      </div>

      {/* ── Center Breathing Orb ────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center my-auto relative z-10">
        <div className="relative w-[240px] h-[240px] flex items-center justify-center">
          {/* Outer Breathing Wave */}
          <motion.div
            animate={{
              scale: isActive ? (phase === "Inhale" || phase === "Hold" ? 1.35 : 0.9) : 1,
              opacity: isActive ? (phase === "Inhale" || phase === "Hold" ? 0.35 : 0.1) : 0.2,
            }}
            transition={{ duration: 4, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full border border-sky-400/40 bg-sky-500/5 blur-sm"
          />

          {/* Secondary Ring */}
          <motion.div
            animate={{
              scale: isActive ? (phase === "Inhale" || phase === "Hold" ? 1.18 : 0.95) : 1,
              opacity: isActive ? 0.6 : 0.3,
            }}
            transition={{ duration: 4, ease: "easeInOut" }}
            className="absolute inset-4 rounded-full border border-sky-400/30"
          />

          {/* Center Orb */}
          <motion.div
            animate={{
              scale: isActive ? (phase === "Inhale" || phase === "Hold" ? 1.08 : 0.92) : 1,
              boxShadow: isActive
                ? "0 0 35px 8px rgba(56,189,248,0.4)"
                : "0 0 20px 2px rgba(56,189,248,0.2)",
            }}
            transition={{ duration: 4, ease: "easeInOut" }}
            className="w-[150px] h-[150px] rounded-full glass-card border border-sky-400/40 flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/20 via-transparent to-transparent" />
            
            <AnimatePresence mode="wait">
              <motion.p
                key={isActive ? phase : "Ready"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-[17px] font-medium text-white tracking-wide z-10 m-0"
              >
                {isActive ? phase : "Ready"}
              </motion.p>
            </AnimatePresence>

            <span className="text-[12px] font-mono text-sky-300/70 mt-1 z-10">
              {formatTime(secondsRemaining)}
            </span>
          </motion.div>
        </div>

        {/* Affirmation / guidance */}
        <p className="text-[13px] text-stone-400/90 text-center max-w-[260px] mt-8 leading-relaxed font-light">
          {isActive
            ? phase === "Inhale"
              ? "Deep breath in through your nose..."
              : phase === "Hold"
              ? "Hold gently. Relax your shoulders."
              : phase === "Exhale"
              ? "Slow breath out through your mouth."
              : "Empty mind. Stillness."
            : "Empty your thoughts. Return to center."}
        </p>
      </div>

      {/* ── Controls & Duration Selection ───────────────────────────── */}
      <div className="flex flex-col items-center gap-5 z-10">
        {/* Preset duration buttons */}
        <div className="flex items-center gap-2 p-1 rounded-full glass-card border border-white/[0.08]">
          {[1, 3, 5, 10].map((m) => (
            <button
              key={m}
              onClick={() => resetSession(m)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                sessionMinutes === m
                  ? "bg-sky-500/25 text-sky-300 border border-sky-400/30"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              {m}m
            </button>
          ))}
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => resetSession(sessionMinutes)}
            className="w-11 h-11 rounded-full glass-card flex items-center justify-center text-stone-400 hover:text-white border border-white/[0.08] transition-colors"
          >
            <IconRotateClockwise size={18} stroke={1.8} />
          </button>

          <button
            onClick={toggleSession}
            className="px-8 py-3.5 rounded-full font-medium text-[15px] flex items-center gap-2.5 transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:shadow-[0_0_28px_rgba(56,189,248,0.5)] active:scale-95"
            style={{
              background: "linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)",
              color: "#ffffff",
            }}
          >
            {isActive ? (
              <>
                <IconPlayerPause size={18} stroke={2} />
                <span>Pause</span>
              </>
            ) : (
              <>
                <IconPlayerPlay size={18} stroke={2} fill="currentColor" />
                <span>Begin Flow</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
