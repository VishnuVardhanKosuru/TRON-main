import type { NextConfig } from "next";
// @ts-expect-error - next-pwa lacks type declarations
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  turbopack: {},

  // SQLite drivers are native / Node-only — never bundle them.
  serverExternalPackages: ["better-sqlite3", "node:sqlite"],

  // TRON is reached from the phone, the Mac and (later) a private tunnel.
  // List the origins that are allowed to call server actions.
  experimental: {
    serverActions: {
      allowedOrigins: (process.env.TRON_ALLOWED_ORIGINS || "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    },
  },
};

export default withPWA(nextConfig);
