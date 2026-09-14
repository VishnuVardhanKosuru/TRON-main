"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthContext } from "@/context/AuthContext";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") router.replace("/login");
    if (user && pathname === "/login") router.replace("/");
  }, [user, loading, pathname, router]);

  // Spinner while the local session is confirmed
  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center tron-bg">
        <div
          className="w-10 h-10 rounded-full border-2 border-transparent animate-spin"
          style={{
            borderTopColor: "var(--fill-accent)",
            borderRightColor: "rgba(14,165,233,0.3)",
          }}
        />
      </div>
    );
  }

  if (pathname === "/login") return <>{children}</>;
  if (!user) return null;
  return <>{children}</>;
}
