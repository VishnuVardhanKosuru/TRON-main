"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronLeft,
  IconLock,
  IconEye,
  IconEyeOff,
  IconCopy,
  IconCheck,
  IconPlus,
  IconTrash,
  IconKey,
  IconCreditCard,
  IconFileText,
  IconSearch,
  IconShieldLock,
} from "@tabler/icons-react";
import { useAuthContext } from "@/context/AuthContext";
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "@/lib/tron/firestore";
import { db } from "@/lib/local-db";

interface VaultItem {
  id: string;
  title: string;
  content: string;
  category: "password" | "pin" | "card" | "note";
  username?: string;
  createdAt?: any;
}

const initialDemoItems: VaultItem[] = [];

export default function VaultPage() {
  const { user } = useAuthContext();

  // PIN & Unlock State
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [storedPin, setStoredPin] = useState("1234");
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPin, setNewPin] = useState("");

  // Items State
  const [items, setItems] = useState<VaultItem[]>(initialDemoItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Secret Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newCategory, setNewCategory] = useState<"password" | "pin" | "card" | "note">("password");

  // Load custom PIN from localStorage if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPin = localStorage.getItem("tron_vault_pin");
      if (savedPin) setStoredPin(savedPin);
    }
  }, []);

  // Live sync with the local store once unlocked
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    const colRef = collection(db, "users", user.uid, "vault");
    const unsub = onSnapshot(colRef, (snap) => {
      const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() } as VaultItem));
      setItems(loaded);
    });
    return () => unsub();
  }, [user]);

  // Handle PIN input
  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        if (nextPin === storedPin) {
          setIsUnlocked(true);
          setPin("");
        } else {
          setPinError(true);
          setTimeout(() => {
            setPin("");
            setPinError(false);
          }, 600);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setPin("");
    setRevealedIds(new Set());
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newItem: Omit<VaultItem, "id"> = {
      title: newTitle.trim(),
      content: newContent.trim(),
      username: newUsername.trim() || undefined,
      category: newCategory,
    };

    if (user) {
      try {
        await addDoc(collection(db, "users", user.uid, "vault"), {
          ...newItem,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Failed to add secret", err);
      }
    } else {
      setItems((prev) => [{ id: "v_" + Date.now(), ...newItem }, ...prev]);
    }

    setNewTitle("");
    setNewContent("");
    setNewUsername("");
    setIsAddOpen(false);
  };

  const handleDeleteItem = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "vault", id));
      } catch (err) {
        console.error("Failed to delete secret", err);
      }
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSaveNewPin = () => {
    if (newPin.length === 4) {
      setStoredPin(newPin);
      if (typeof window !== "undefined") {
        localStorage.setItem("tron_vault_pin", newPin);
      }
      setIsChangingPin(false);
      setNewPin("");
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.username && item.username.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, categoryFilter]);

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case "password":
        return <IconKey size={16} className="text-sky-400" />;
      case "pin":
        return <IconLock size={16} className="text-emerald-400" />;
      case "card":
        return <IconCreditCard size={16} className="text-sky-400" />;
      default:
        return <IconFileText size={16} className="text-purple-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white flex flex-col selection:bg-sky-500/30">
      {/* ── Top Header ────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#0a0c10]/80 backdrop-blur-xl">
        <Link
          href="/menu?item=vault"
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <IconChevronLeft size={20} />
          <span className="text-sm font-medium">Menu</span>
        </Link>
        <div className="flex items-center gap-2">
          <IconShieldLock size={18} className="text-sky-400" />
          <span className="font-semibold text-sm tracking-wide text-white">Private Vault</span>
        </div>
        {isUnlocked ? (
          <button
            onClick={handleLock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-medium text-sky-300 border border-sky-500/20 transition-all"
          >
            <IconLock size={14} />
            <span>Lock</span>
          </button>
        ) : (
          <div className="w-12" />
        )}
      </header>

      {/* ── Content Area ──────────────────────────────────── */}
      <main className="flex-1 flex flex-col max-w-md w-full mx-auto p-5">
        <AnimatePresence mode="wait">
          {!isUnlocked ? (
            /* ── PIN PAD LOCK SCREEN ─────────────────────── */
            <motion.div
              key="locked"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col items-center justify-center py-6"
            >
              {/* Icon badge */}
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-sky-500/20 to-blue-900/40 border border-sky-500/30 shadow-[0_0_30px_rgba(56,189,248,0.2)] mb-4">
                <IconLock size={30} className="text-sky-400" />
              </div>

              <h2 className="text-xl font-bold text-white mb-1 tracking-tight">Security Lock</h2>
              <p className="text-xs text-white/50 mb-8 text-center max-w-[240px]">
                Enter 4-digit PIN to decrypt your passwords, PINs, and secure credentials.
              </p>

              {/* PIN Indicator Dots */}
              <motion.div
                animate={pinError ? { x: [-14, 14, -10, 10, -5, 5, 0] } : {}}
                transition={{ duration: 0.4 }}
                className="flex items-center gap-4 mb-10"
              >
                {[0, 1, 2, 3].map((idx) => {
                  const filled = pin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full transition-all duration-200 border ${
                        pinError
                          ? "border-rose-500 bg-rose-500/30"
                          : filled
                          ? "border-sky-400 bg-sky-400 shadow-[0_0_12px_#38bdf8]"
                          : "border-white/20 bg-white/5"
                      }`}
                    />
                  );
                })}
              </motion.div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleDigit(num)}
                    className="h-16 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/5 flex items-center justify-center text-xl font-medium text-white transition-all focus:outline-none"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => setPin("")}
                  className="h-16 rounded-2xl hover:bg-white/[0.04] active:scale-95 flex items-center justify-center text-xs font-medium text-white/40 uppercase tracking-wider transition-all focus:outline-none"
                >
                  Clear
                </button>
                <button
                  onClick={() => handleDigit("0")}
                  className="h-16 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/5 flex items-center justify-center text-xl font-medium text-white transition-all focus:outline-none"
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  className="h-16 rounded-2xl hover:bg-white/[0.04] active:scale-95 flex items-center justify-center text-white/60 transition-all focus:outline-none"
                >
                  ⌫
                </button>
              </div>

              <p className="mt-8 text-[11px] text-white/30 text-center">
                Default PIN is <span className="text-sky-400/80 font-mono">1234</span>
              </p>
            </motion.div>
          ) : (
            /* ── UNLOCKED VAULT DASHBOARD ────────────────── */
            <motion.div
              key="unlocked"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col space-y-4"
            >
              {/* Actions Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <IconSearch
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search secrets..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-sky-400/50 transition-colors"
                  />
                </div>
                <button
                  onClick={() => setIsAddOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-semibold text-xs transition-colors shrink-0 shadow-[0_0_16px_rgba(56,189,248,0.3)]"
                >
                  <IconPlus size={15} stroke={2.5} />
                  <span>Add Secret</span>
                </button>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { id: "all", label: "All Items" },
                  { id: "password", label: "Passwords" },
                  { id: "pin", label: "PINs" },
                  { id: "card", label: "Cards" },
                  { id: "note", label: "Secure Notes" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      categoryFilter === cat.id
                        ? "bg-sky-400/15 text-sky-300 border border-sky-400/40"
                        : "bg-white/[0.03] text-white/50 border border-white/5 hover:text-white/80"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Items List */}
              <div className="flex-1 space-y-3 pt-1">
                {filteredItems.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
                    <p className="text-xs text-white/40">No secrets found.</p>
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const isRevealed = revealedIds.has(item.id);
                    const isCopied = copiedId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-white/[0.05]">
                              {categoryIcon(item.category)}
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-white tracking-tight">
                                {item.title}
                              </h4>
                              {item.username && (
                                <p className="text-[11px] text-white/40">{item.username}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-white/30 hover:text-rose-400 transition-colors"
                          >
                            <IconTrash size={15} />
                          </button>
                        </div>

                        {/* Secret Content Box */}
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/5 font-mono text-xs">
                          <span className="text-sky-200/90 tracking-wider truncate mr-2 select-all">
                            {isRevealed ? item.content : "••••••••••••••••"}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => toggleReveal(item.id)}
                              className="p-1 text-white/50 hover:text-white transition-colors"
                              title={isRevealed ? "Hide" : "Reveal"}
                            >
                              {isRevealed ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                            </button>
                            <button
                              onClick={() => handleCopy(item.id, item.content)}
                              className="p-1 text-sky-400 hover:text-sky-300 transition-colors"
                              title="Copy"
                            >
                              {isCopied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* In-App Change PIN option */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
                <span>Master PIN: {storedPin}</span>
                <button
                  onClick={() => setIsChangingPin(!isChangingPin)}
                  className="text-sky-400 hover:underline"
                >
                  {isChangingPin ? "Cancel" : "Change PIN"}
                </button>
              </div>

              {isChangingPin && (
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-sky-400/30 flex items-center gap-2">
                  <input
                    type="password"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="New 4-digit PIN"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-black/50 text-xs text-white focus:outline-none border border-white/10"
                  />
                  <button
                    onClick={handleSaveNewPin}
                    disabled={newPin.length !== 4}
                    className="px-3 py-1.5 rounded-lg bg-sky-500 disabled:opacity-40 text-black font-semibold text-xs"
                  >
                    Save
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Add Secret Modal ─────────────────────────────── */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-[#14171e] border border-white/10 p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base">New Vault Secret</h3>
                <button onClick={() => setIsAddOpen(false)} className="text-white/40 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddItem} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider block mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Netflix Password or Gate PIN"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider block mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#1a1e27] border border-white/10 text-xs text-white focus:outline-none focus:border-sky-400"
                  >
                    <option value="password">Password</option>
                    <option value="pin">PIN Code</option>
                    <option value="card">Bank / Card</option>
                    <option value="note">Secure Note</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider block mb-1">
                    Username / Account (Optional)
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. user@email.com or Card # ending 4402"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider block mb-1">
                    Secret Content / Password
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 font-mono text-xs text-sky-300 placeholder-white/30 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.05] text-white/70 text-xs font-semibold hover:bg-white/[0.1]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-semibold shadow-[0_0_16px_rgba(56,189,248,0.3)]"
                  >
                    Save to Vault
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
