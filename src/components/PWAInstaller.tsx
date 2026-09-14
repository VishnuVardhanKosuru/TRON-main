"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconDownload, IconX, IconShare } from "@tabler/icons-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstaller() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker for Chrome PWA installability
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("PWA Service Worker registered:", reg.scope))
        .catch((err) => console.error("PWA Service Worker registration failed:", err));
    }

    // 2. Check if already running in standalone mode (installed app)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(Boolean(isStandaloneMode));
    };
    checkStandalone();

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // 4. Capture Chrome/Android PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsStandalone(true);
      }
      setInstallPrompt(null);
    } else if (isIOS) {
      setShowIOSTip(true);
    }
  };

  // If already installed or dismissed, don't show the banner
  if (isStandalone || isDismissed) return null;

  // Show only if install prompt is captured OR on iOS
  if (!installPrompt && !isIOS) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="fixed bottom-[84px] left-4 right-4 z-30 max-w-[380px] mx-auto"
      >
        <div
          className="p-3 rounded-2xl glass-card border border-sky-400/30 flex items-center justify-between gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          style={{
            background: "rgba(18, 15, 12, 0.92)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shrink-0">
              <IconDownload size={16} className="text-sky-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-white m-0 truncate">Install TRON</p>
              <p className="text-[10px] text-sky-400/80 m-0 truncate">Run full-screen without browser bars</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 rounded-full text-[11.5px] font-medium bg-sky-500 hover:bg-sky-400 text-black transition-all active:scale-95 flex items-center gap-1"
            >
              {isIOS && !installPrompt ? <IconShare size={12} /> : null}
              <span>{isIOS && !installPrompt ? "How" : "Install"}</span>
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-stone-400 hover:text-white"
              aria-label="Dismiss"
            >
              <IconX size={14} />
            </button>
          </div>
        </div>

        {/* iOS installation helper modal/tooltip */}
        {showIOSTip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-2 p-3 rounded-xl bg-black/95 border border-white/10 text-center"
          >
            <p className="text-[11.5px] text-stone-300 m-0 leading-relaxed">
              Tap the Safari <span className="text-sky-400 font-semibold">Share</span> icon below, then scroll down and tap <span className="text-sky-400 font-semibold">&ldquo;Add to Home Screen&rdquo;</span>.
            </p>
            <button
              onClick={() => setShowIOSTip(false)}
              className="mt-2 text-[10.5px] text-stone-400 underline"
            >
              Got it
            </button>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
