"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { IconLock, IconArrowRight } from "@tabler/icons-react";

export default function LoginPage() {
  const { unlock, loading, error } = useAuth();
  const [passphrase, setPassphrase] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim() || loading) return;
    void unlock(passphrase);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center tron-bg px-8 relative overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: "80vw",
          height: "80vw",
          top: "5%",
          left: "50%",
          transform: "translateX(-50%)",
          background: "radial-gradient(circle, rgba(56,189,248,0.14) 0%, transparent 65%)",
          borderRadius: "50%",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center gap-8 w-full max-w-[320px] z-10"
      >
        {/* TRON mark */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="relative"
        >
          <div
            className="absolute inset-[-14px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(56,189,248,0.26) 0%, transparent 70%)",
              animation: "orb-pulse 3s ease-in-out infinite",
            }}
          />
          <div
            className="w-[96px] h-[96px] rounded-full flex items-center justify-center relative"
            style={{
              border: "1.5px solid rgba(56,189,248,0.5)",
              background: "radial-gradient(circle at 50% 30%, rgba(56,189,248,0.16), rgba(8,12,22,0.9))",
              boxShadow:
                "0 0 34px rgba(14,165,233,0.42), inset 0 0 20px rgba(56,189,248,0.18)",
            }}
          >
            <span
              className="text-[22px] font-semibold tracking-[0.28em] pl-[0.28em]"
              style={{ color: "#7dd3fc", textShadow: "0 0 14px rgba(56,189,248,0.8)" }}
            >
              TRON
            </span>
          </div>
        </motion.div>

        {/* Text */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)] leading-tight m-0">
            TRON is offline-private
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] leading-relaxed m-0">
            Everything lives on your own server.
            <br />
            Enter your passphrase to unlock.
          </p>
        </div>

        {/* Passphrase form */}
        <form onSubmit={submit} className="w-full flex flex-col gap-3">
          <div className="glass-input flex items-center gap-2 px-4 py-3">
            <IconLock size={17} stroke={1.5} className="text-[var(--text-muted)] shrink-0" />
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Passphrase"
              autoComplete="current-password"
              autoFocus
              className="flex-1 bg-transparent border-none outline-none text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading || !passphrase.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[16px] focus:outline-none disabled:opacity-40 cursor-pointer"
            style={{
              background:
                "linear-gradient(135deg, rgba(14,165,233,0.9), rgba(37,99,235,0.85))",
              border: "0.5px solid rgba(125,211,252,0.5)",
              boxShadow: "0 4px 22px rgba(14,165,233,0.34)",
            }}
          >
            <span className="text-[14px] font-medium text-white">
              {loading ? "Unlocking…" : "Unlock TRON"}
            </span>
            {!loading && <IconArrowRight size={16} stroke={2} className="text-white" />}
          </motion.button>
        </form>

        {error && (
          <div className="w-full p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-center">
            <p className="text-[12px] text-rose-300 m-0 leading-relaxed font-medium">{error}</p>
          </div>
        )}

        <p className="text-[11px] text-[var(--text-muted)] text-center leading-relaxed m-0">
          No cloud account. No third party.
          <br />
          Your data never leaves your server.
        </p>
      </motion.div>
    </div>
  );
}
