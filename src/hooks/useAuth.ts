"use client";

import { useState, useEffect } from "react";
import {
  signInWithPassphrase,
  signOutOfTron,
  onUserChanged,
  getCurrentUser,
  hasResolved,
  type TronUser,
} from "@/lib/tron/session";

export function useAuth() {
  const [user, setUser] = useState<TronUser | null>(getCurrentUser());
  const [loading, setLoading] = useState(!hasResolved());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onUserChanged(setUser), []);

  async function unlock(passphrase: string) {
    setError(null);
    setLoading(true);
    try {
      await signInWithPassphrase(passphrase);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock TRON.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await signOutOfTron();
  }

  return { user, loading, error, unlock, signOut };
}
