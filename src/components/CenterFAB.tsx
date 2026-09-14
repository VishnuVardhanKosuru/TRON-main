"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  BookOpen,
  Mic,
  DollarSign,
  Sparkles,
  Send,
} from "lucide-react";
import { useCapture } from "./CaptureProvider";
import AgentAvatar from "./AgentAvatar";

type CloseMode = "all" | "stagger-rtl";

type SubButtonConfig = {
  id: string;
  name: string;
  icon: typeof BookOpen;
  angle: number; // degrees: 150 = left, 90 = up, 30 = right
  distance: number; // distance in px from center
  rtlDelay: number;
  action: () => void;
};

export default function CenterFAB() {
  const router = useRouter();
  const pathname = usePathname();
  const { open: openCapture } = useCapture();

  const [isOpen, setIsOpen] = useState(false);
  const [closeMode, setCloseMode] = useState<CloseMode>("all");
  const [showTronModal, setShowTronModal] = useState(false);
  const [tronMessage, setTronMessage] = useState("");
  const [tronChatHistory, setTronChatHistory] = useState<
    Array<{ role: "user" | "tron"; text: string }>
  >([
    {
      role: "tron",
      text: "Hi, I'm TRON. Everything runs on your own server. How can I help you right now?",
    },
  ]);

  // Gesture refs
  const pointerStartTime = useRef(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isDragging = useRef(false);

  // Backdrop swipe tracking for arc close
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);

  // Sub-button definitions (Mathematically symmetric golden arc)
  const subButtons: SubButtonConfig[] = [
    {
      id: "journal",
      name: "Journal",
      icon: BookOpen,
      angle: 140,
      distance: 108,
      rtlDelay: 0.16,
      action: () => {
        setIsOpen(false);
        router.push("/menu/journal");
      },
    },
    {
      id: "mic",
      name: "Mic",
      icon: Mic,
      angle: 90,
      distance: 118,
      rtlDelay: 0.08,
      action: () => {
        setIsOpen(false);
        openCapture();
      },
    },
    {
      id: "money",
      name: "Money",
      icon: DollarSign,
      angle: 40,
      distance: 108,
      rtlDelay: 0.0,
      action: () => {
        setIsOpen(false);
        router.push("/menu/ious");
      },
    },
  ];

  const getCoordinates = (dist: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    const x = dist * Math.cos(rad);
    const y = -dist * Math.sin(rad);
    return { x, y };
  };

  const handleCloseAll = () => {
    setCloseMode("all");
    setIsOpen(false);
  };

  const handleCloseRTL = () => {
    setCloseMode("stagger-rtl");
    setIsOpen(false);
  };

  const handleOpen = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(25);
    }
    setCloseMode("all");
    setIsOpen(true);
  };

  const handleOpenTron = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([30, 40, 30]);
    }
    setShowTronModal(true);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const handleBackdropPointerDown = (e: React.PointerEvent) => {
    swipeStartX.current = e.clientX;
    swipeStartY.current = e.clientY;
  };

  const handleBackdropPointerUp = (e: React.PointerEvent) => {
    if (swipeStartX.current === null || swipeStartY.current === null) return;

    const deltaX = e.clientX - swipeStartX.current;
    const deltaY = e.clientY - swipeStartY.current;

    if (deltaX < -35 && Math.abs(deltaX) > Math.abs(deltaY) * 0.5) {
      handleCloseRTL();
    } else if (Math.hypot(deltaX, deltaY) < 12) {
      handleCloseAll();
    }

    swipeStartX.current = null;
    swipeStartY.current = null;
  };

  const handleSendTronMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tronMessage.trim()) return;

    const text = tronMessage.trim();
    setTronMessage("");
    
    const userMsg = { role: "user", text };
    const newHistory = [...tronChatHistory, userMsg] as any;
    setTronChatHistory(newHistory);

    try {
      const { runMemoryCommand } = await import("@/lib/tron/memory-commands");

      // Explicit memory commands never reach the model.
      const memoryReply = await runMemoryCommand(text);
      if (memoryReply !== null) {
        setTronChatHistory((prev) => [...prev, { role: "tron", text: memoryReply }]);
        return;
      }

      const { askTron } = await import("@/actions/chat");
      const { executeClientTool } = await import("@/lib/tools");
      const { auth } = await import("@/lib/local-db");

      const formatForTron = newHistory.map((m: any) => ({
        role: m.role === "tron" ? "assistant" : m.role,
        content: m.text
      }));

      // 1. Call LLM
      let responseMsg = await askTron(formatForTron);
      
      // 2. Handle Tools (if any)
      if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
        let updatedForTron = [...formatForTron, responseMsg];
        const uid = auth.currentUser?.uid || "";
        
        for (const tc of responseMsg.tool_calls) {
          const resultStr = await executeClientTool(uid, tc);
          updatedForTron.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: resultStr
          });
        }
        responseMsg = await askTron(updatedForTron);
      }

      setTronChatHistory((prev) => [
        ...prev,
        { role: "tron", text: responseMsg.content || "Done!" },
      ]);
    } catch (err) {
      console.error(err);
      setTronChatHistory((prev) => [
        ...prev,
        {
          role: "tron",
          text: err instanceof Error ? err.message : "I ran into an error.",
        },
      ]);
    }
  };

  return (
    <>
      {/* ── Backdrop for Open State ───────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onPointerDown={handleBackdropPointerDown}
            onPointerUp={handleBackdropPointerUp}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[6px] touch-none select-none pointer-events-auto"
          />
        )}
      </AnimatePresence>

      {/* ── Center FAB & Sub-Buttons Container ─────────────────────── */}
      <div className="relative flex items-center justify-center -translate-y-3 z-30">
        {/* ── Sub-Buttons Fan (Radial Speed-Dial) ─────────────────── */}
        <AnimatePresence>
          {isOpen &&
            subButtons.map((btn) => {
              const { x, y } = getCoordinates(btn.distance, btn.angle);
              const Icon = btn.icon;

              return (
                <motion.div
                  key={btn.id}
                  initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                  animate={{
                    x,
                    y,
                    scale: 1,
                    opacity: 1,
                  }}
                  exit={
                    closeMode === "stagger-rtl"
                      ? {
                          x: 0,
                          y: 0,
                          scale: 0,
                          opacity: 0,
                          transition: {
                            duration: 0.18,
                            delay: btn.rtlDelay,
                            ease: [0.4, 0, 0.2, 1],
                          },
                        }
                      : {
                          x: 0,
                          y: 0,
                          scale: 0,
                          opacity: 0,
                          transition: { duration: 0.15, ease: "easeOut" },
                        }
                  }
                  transition={{
                    type: "spring",
                    stiffness: 440,
                    damping: 26,
                    mass: 0.7,
                  }}
                  className="absolute pointer-events-auto flex flex-col items-center -ml-[26px] -mt-[26px]"
                  style={{ width: 52 }}
                >
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.06 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      btn.action();
                    }}
                    className="relative w-[52px] h-[52px] rounded-full flex items-center justify-center select-none overflow-hidden group transition-shadow"
                    style={{
                      background:
                        "linear-gradient(145deg, rgba(34, 30, 26, 0.90) 0%, rgba(18, 16, 14, 0.94) 100%)",
                      backdropFilter: "blur(24px)",
                      WebkitBackdropFilter: "blur(24px)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      boxShadow:
                        "0 12px 28px -4px rgba(0, 0, 0, 0.7), inset 0 1px 1px 0 rgba(255, 255, 255, 0.22), inset 0 0 0 1px rgba(56,189,248, 0.12)",
                    }}
                    title={btn.name}
                  >
                    {/* Subtle top specular glass reflection */}
                    <div
                      className="absolute inset-x-2 top-0 h-[45%] rounded-t-full pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255, 255, 255, 0.25) 0%, transparent 100%)",
                      }}
                    />

                    {/* Crisp white icon with subtle warm specular tone */}
                    <Icon
                      size={21}
                      strokeWidth={2}
                      className="text-white/90 group-hover:text-sky-200 transition-colors z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                    />
                  </motion.button>

                  {/* Clean Geometric Sans Label nested right below button */}
                  <span className="mt-1.5 text-[11px] font-sans font-medium tracking-tight text-white/80 whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] pointer-events-none select-none">
                    {btn.name}
                  </span>
                </motion.div>
              );
            })}
        </AnimatePresence>

        {/* ── Main Center FAB ────────────────────────────────────── */}
        <motion.div
          drag={!isOpen ? "y" : false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.4}
          onDragStart={() => {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
            isDragging.current = true;
          }}
          onDragEnd={(_, info) => {
            setTimeout(() => {
              isDragging.current = false;
            }, 60);
            if (info.offset.y < -22 || info.velocity.y < -120) {
              handleOpen();
            }
          }}
          onPointerDown={() => {
            isDragging.current = false;
            pointerStartTime.current = Date.now();
            longPressTimer.current = setTimeout(() => {
              if (!isDragging.current && !isOpen) {
                handleOpenTron();
              }
            }, 400);
          }}
          onPointerUp={() => {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
          }}
          onTap={() => {
            if (isDragging.current) return;
            const pressDuration = Date.now() - pointerStartTime.current;
            if (pressDuration >= 400) return;

            if (isOpen) {
              handleCloseAll();
            } else {
              if (pathname !== "/") {
                router.push("/");
              }
            }
          }}
          whileTap={{ scale: 0.88 }}
          className="relative w-[58px] h-[58px] rounded-full flex items-center justify-center cursor-pointer select-none pointer-events-auto"
          style={{
            touchAction: "none",
          }}
          title={isOpen ? "Close" : "TRON (tap: Home · drag up: actions · hold: copilot)"}
        >
          {isOpen ? (
            /* Open state: Clean X with subtle amber rim */
            <div
              className="w-full h-full rounded-full flex items-center justify-center transition-all"
              style={{
                background:
                  "linear-gradient(145deg, rgba(34, 30, 26, 0.94) 0%, rgba(18, 16, 14, 0.98) 100%)",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                boxShadow:
                  "0 12px 28px -4px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.2), inset 0 0 0 1px rgba(56,189,248, 0.2)",
              }}
            >
              <X size={22} strokeWidth={2.4} className="text-white/90 drop-shadow-sm" />
            </div>
          ) : (
            /* Closed state: Original TRON pulsing orb */
            <div className="w-full h-full relative">
              {/* Pulsing ambient glow ring */}
              <div
                className="absolute inset-[-8px] rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, rgba(14,165,233,0.28) 0%, transparent 70%)",
                  animation: "orb-pulse 3s ease-in-out infinite",
                }}
              />

              {/* Orb container */}
              <div className="w-full h-full rounded-full overflow-hidden relative">
                {/* Slowly rotating TRON core */}
                <motion.div
                  className="w-full h-full"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                >
                  <AgentAvatar size={56} className="w-full h-full" />
                </motion.div>

                {/* Amber ring overlay */}
                <span
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    border: "1.5px solid rgba(56,189,248,0.6)",
                    boxShadow:
                      "inset 0 0 12px rgba(14,165,233,0.25), 0 0 16px rgba(14,165,233,0.4)",
                  }}
                />
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── TRON Chatbot Modal (Long-Press Target) ─────────────────── */}
      <AnimatePresence>
        {showTronModal && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTronModal(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />

            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="relative w-full max-w-md bg-[#16130f] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl z-10 max-h-[85vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-sky-400/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-white tracking-tight leading-none">
                      TRON Copilot
                    </h3>
                    <span className="text-[11px] font-mono text-sky-400/80">
                      TRON AI Assistant
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowTronModal(false)}
                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 min-h-[160px] max-h-[320px]">
                {tronChatHistory.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug ${
                        msg.role === "user"
                          ? "bg-sky-500/25 border border-sky-500/40 text-white rounded-br-none"
                          : "bg-white/5 border border-white/10 text-white/90 rounded-bl-none"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Box */}
              <form onSubmit={handleSendTronMessage} className="relative mt-3 pt-2">
                <input
                  type="text"
                  placeholder="Ask TRON anything or capture a thought..."
                  value={tronMessage}
                  onChange={(e) => setTronMessage(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-3.5 pr-11 text-[14.5px] text-white placeholder:text-white/35 focus:outline-none focus:border-sky-400/60 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!tronMessage.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-sky-400 text-[#18120a] flex items-center justify-center disabled:opacity-30 disabled:bg-white/10 disabled:text-white/30 transition-all active:scale-95"
                >
                  <Send size={14} strokeWidth={2.5} />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
