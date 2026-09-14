"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconCheck, IconMicrophone, IconSend } from "@tabler/icons-react";
import { useAuthContext } from "@/context/AuthContext";
import { processCapture } from "@/lib/db";
import { classifyCapture, tronReply } from "@/lib/classifier";

// Calls server-side /api/classify so the local model is reached from the server
async function classifyWithAI(text: string) {
  const res = await fetch("/api/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Classify failed");
  return res.json();
}


interface Message {
  id: string;
  role: "user" | "tron";
  text: string;
}

export default function CaptureSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuthContext();
  const [input,    setInput]    = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [saving,   setSaving]   = useState(false);

  async function handleSubmit() {
    const text = input.trim();
    if (!text || !user || saving) return;

    setInput("");
    setSaving(true);

    // Show user bubble immediately
    setMessages(prev => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text },
    ]);

    try {
      // Step 1: Classify offline (instant, always succeeds)
      const offlineResult = classifyCapture(text);

      // Step 2: Save immediately with offline result → instant confirmation
      const docRef = await processCapture(user.uid, offlineResult.type as any, text, {
        content: text,
      });

      // Step 3: Show user an immediate confirmation
      let reply = tronReply(offlineResult.type as any);
      const isPrivate = ["journal", "gratitude", "vault", "mood", "health", "period"].includes(offlineResult.type);

      if (!isPrivate && docRef?.id) {
        reply = `${reply} I'm running a deeper analysis in the background — might update the classification.`;

        // Step 4: Fire background AI upgrade (non-blocking)
        classifyWithAI(text).then(async (aiResult) => {
            if (!aiResult.captures?.length) return;
            const { processCapture: pc } = await import("@/lib/db");
            const { processGraphEntities } = await import("@/lib/graphUtils");
            const primary = aiResult.captures[0];

            if (primary.type !== offlineResult.type) {
              // Different type — delete offline doc
              const { deleteDoc, doc } = await import("@/lib/tron/firestore");
              const { db } = await import("@/lib/local-db");
              try { await deleteDoc(doc(db, "users", user.uid, offlineResult.type === "idea" ? "notes" : offlineResult.type, docRef.id)); } catch {}
            }
            for (const capture of aiResult.captures) {
              await pc(user.uid, capture.type as any, text, capture.key_info);
            }
            if (aiResult.entities?.length) {
              await processGraphEntities(user.uid, aiResult.entities);
            }
          }).catch(() => {}); // Silent failure — offline doc is already saved
      }

      setMessages(prev => [
        ...prev,
        { id: `l-${Date.now()}`, role: "tron", text: reply },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { id: `e-${Date.now()}`, role: "tron", text: "Hmm, something went wrong. Try again?" },
      ]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[60]"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[412px] rounded-t-[28px] rounded-b-none p-4 z-[70]"
            style={{
              background: "rgba(16, 14, 10, 0.97)",
              borderTop:   "0.5px solid rgba(255,255,255,0.1)",
              borderLeft:  "0.5px solid rgba(255,255,255,0.06)",
              borderRight: "0.5px solid rgba(255,255,255,0.06)",
              boxShadow:   "0 -8px 40px rgba(0,0,0,0.6), 0 -1px 0 rgba(14,165,233,0.2)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
            }}
          >
            {/* Handle */}
            <div className="w-9 h-1 bg-[rgba(255,255,255,0.15)] rounded-full mx-auto mb-4" />

            {/* Messages */}
            <div className="flex flex-col gap-2.5 mb-4 max-h-[240px] overflow-y-auto no-scrollbar">
              {messages.length === 0 && (
                <p className="text-center text-[12px] text-[var(--text-muted)] py-6">
                  Type anything — TRON will figure out where it goes.
                </p>
              )}
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "user" ? (
                    <div
                      className="rounded-tl-[14px] rounded-tr-[14px] rounded-bl-[14px] rounded-br-[2px]
                                 px-3.5 py-2.5 max-w-[78%] text-[14px] text-white"
                      style={{
                        background: "linear-gradient(135deg, #0ea5e9, #0369a1)",
                        boxShadow:  "0 4px 16px rgba(14,165,233,0.3)",
                      }}
                    >
                      {msg.text}
                    </div>
                  ) : (
                    <div
                      className="rounded-tl-[14px] rounded-tr-[14px] rounded-br-[14px] rounded-bl-[2px]
                                 px-3.5 py-2.5 max-w-[78%]"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "0.5px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <div className="flex items-start gap-1.5">
                        <IconCheck
                          size={13}
                          stroke={2.5}
                          className="shrink-0 mt-[2px]"
                          style={{ color: "#4ade80" }}
                        />
                        <span className="text-[13px] text-[var(--text-secondary)] leading-snug">
                          {msg.text}
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Input row */}
            <div
              className="flex items-center gap-2.5 px-3.5 py-3 rounded-[14px]"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "0.5px solid rgba(255,255,255,0.09)",
              }}
            >
              <input
                autoFocus
                type="text"
                placeholder="Type or speak..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                className="bg-transparent outline-none flex-1 text-[14px]
                           text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
              <motion.button
                whileTap={{ scale: 0.82 }}
                onClick={input.trim() ? handleSubmit : undefined}
                disabled={saving}
                className="focus:outline-none disabled:opacity-40 shrink-0"
              >
                {input.trim()
                  ? <IconSend size={18} stroke={1.5} style={{ color: "var(--text-accent)" }} />
                  : <IconMicrophone size={18} stroke={1.5} style={{ color: "var(--text-accent)" }} />
                }
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
