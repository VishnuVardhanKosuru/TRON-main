"use client";

import { usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { CaptureProvider } from "@/components/CaptureProvider";
import PWAInstaller from "@/components/PWAInstaller";

/**
 * The lock screen is not part of the app chrome — no nav, no capture FAB,
 * no install prompt until TRON is actually unlocked.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <CaptureProvider>
      <main className="w-full max-w-[412px] mx-auto min-h-[100dvh] glass-main-surface">
        <div className="px-4 pt-5 nav-scroll-pad">{children}</div>
      </main>
      <BottomNav />
      <PWAInstaller />
    </CaptureProvider>
  );
}
