import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "TRON",
  description: "Private personal AI, self-hosted",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TRON",
  },
  icons: {
    icon: "/icon-192x192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // viewport-fit=cover lets the app paint behind the gesture bar
  // so we can control safe-area insets ourselves via CSS env()
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="tron-bg text-[var(--text-primary)] font-sans antialiased min-h-[100dvh] relative body-safe-bottom">
        <AuthProvider>
          <AuthGuard>
            <AppShell>{children}</AppShell>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
