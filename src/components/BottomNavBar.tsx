"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { IconCalendarMonth, IconMenu2 } from "@tabler/icons-react";
import CenterFAB from "./CenterFAB";

export default function BottomNavBar() {
  const pathname = usePathname();

  const isCalendar = pathname === "/calendar";
  const isMenu = pathname.startsWith("/menu");

  return (
    <>
      <nav
        aria-label="Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-30 select-none border-t border-white/[0.08]"
        style={{
          background: "rgba(10, 9, 7, 0.95)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="w-full max-w-[440px] mx-auto h-[68px] flex items-center justify-between px-10 relative">
          {/* ── Left Tab: Calendar ──────────────────────── */}
          <Link
            href="/calendar"
            className="flex flex-col items-center justify-center gap-1.5 focus:outline-none"
          >
            <motion.div whileTap={{ scale: 0.82 }} className="flex flex-col items-center gap-1.5">
              <IconCalendarMonth
                size={24}
                stroke={isCalendar ? 2 : 1.5}
                style={{ color: isCalendar ? "#38bdf8" : "rgba(255,255,255,0.4)" }}
              />
              <span
                className="block w-[5px] h-[5px] rounded-full transition-all duration-300"
                style={{
                  background: isCalendar ? "#38bdf8" : "transparent",
                  boxShadow: isCalendar ? "0 0 8px 3px rgba(56,189,248,0.6)" : "none",
                }}
              />
            </motion.div>
          </Link>

          {/* ── Center Floating Action Button (Radial Speed-Dial) ───── */}
          <div className="relative flex items-center justify-center">
            <CenterFAB />
          </div>

          {/* ── Right Tab: Core ──────────────────────────── */}
          <Link
            href="/menu"
            aria-label="Core"
            className="flex flex-col items-center justify-center gap-1.5 focus:outline-none"
          >
            <motion.div whileTap={{ scale: 0.82 }} className="flex flex-col items-center gap-1.5">
              <IconMenu2
                size={24}
                stroke={isMenu ? 2 : 1.5}
                style={{ color: isMenu ? "#38bdf8" : "rgba(255,255,255,0.4)" }}
              />
              <span
                className="block w-[5px] h-[5px] rounded-full transition-all duration-300"
                style={{
                  background: isMenu ? "#38bdf8" : "transparent",
                  boxShadow: isMenu ? "0 0 8px 3px rgba(56,189,248,0.6)" : "none",
                }}
              />
            </motion.div>
          </Link>
        </div>
      </nav>

      {/* Safe-area fill — covers the gap below the navbar on phones with gesture bars */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none"
        style={{
          height: "env(safe-area-inset-bottom, 0px)",
          background: "rgba(10, 9, 7, 0.95)",
        }}
      />
    </>
  );
}
