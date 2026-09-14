"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronLeft,
  IconChevronDown,
  IconCheck,
  IconPlus,
} from "@tabler/icons-react";
import Link from "next/link";

// --- Types ---
type ShoppingItem = {
  id: string;
  name: string;
  completedAt: Date | null;
  createdAt: Date;
};
import { useAuthContext } from "@/context/AuthContext";
import { collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "@/lib/tron/firestore";
import { db } from "@/lib/local-db";

export default function ShoppingListPage() {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const { user } = useAuthContext();
  const [items, setItems] = useState<ShoppingItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "shopping"));
    const unsub = onSnapshot(q, (snap) => {
      const loaded: ShoppingItem[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.title || "",
          completedAt: data.status === "done" && data.completedAt ? data.completedAt.toDate() : null,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });
      setItems(loaded);
    });
    return () => unsub();
  }, [user]);
  const [newItemName, setNewItemName] = useState("");
  const [isRecentExpanded, setIsRecentExpanded] = useState(false);
  const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set());

  // Client-side filter on read:
  // Active items + Recently bought items completed within the last 7 days only
  const { activeItems, recentlyBoughtItems } = useMemo(() => {
    const active: ShoppingItem[] = [];
    const recent: ShoppingItem[] = [];
    const now = Date.now();

    items.forEach((it) => {
      const isActuallyCompleted = it.completedAt && !justCompletedIds.has(it.id);

      if (isActuallyCompleted) {
        // Exclude items whose completed timestamp is older than 7 days
        const age = now - it.completedAt!.getTime();
        if (age <= SEVEN_DAYS_MS) {
          recent.push(it);
        }
      } else {
        active.push(it);
      }
    });

    // Recent sorted newest completed first
    recent.sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());

    return { activeItems: active, recentlyBoughtItems: recent };
  }, [items, justCompletedIds]);

  // Inline Quick Add
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !user) return;

    await addDoc(collection(db, "users", user.uid, "shopping"), {
      title: newItemName.trim(),
      status: "active",
      createdAt: serverTimestamp(),
    });
    setNewItemName("");
  };

  // Toggle bought state
  const handleToggle = async (id: string) => {
    if (!user) return;
    const it = items.find((item) => item.id === id);
    if (!it) return;
    const ref = doc(db, "users", user.uid, "shopping", id);

    if (it.completedAt) {
      // Re-add to active list instantly
      await updateDoc(ref, {
        status: "active",
        completedAt: null
      });
    } else {
      // Mark bought: animate in place, then move down
      setJustCompletedIds((prev) => new Set(prev).add(id));

      setTimeout(async () => {
        await updateDoc(ref, {
          status: "done",
          completedAt: serverTimestamp()
        });
        setJustCompletedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 550);
    }
  };

  return (
    <div className="min-h-screen bg-[#18120a] text-white overflow-x-hidden selection:bg-sky-500/20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#18120a]/85 backdrop-blur-xl border-b border-white/5 pt-12 pb-4 px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/menu?item=shopping"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 active:bg-white/10 transition-colors"
          >
            <IconChevronLeft size={20} className="text-white/70" />
          </Link>
          <h1 className="text-[20px] font-medium tracking-tight">Shopping list</h1>
        </div>
        <div className="text-[13px] text-white/40 font-mono">
          {activeItems.length} {activeItems.length === 1 ? "item" : "items"}
        </div>
      </header>

      {/* Main Content */}
      <main className="px-5 pt-6 pb-24">
        {/* Inline Quick-Add Input pinned near top */}
        <form onSubmit={handleQuickAdd} className="relative mb-8">
          <input
            type="text"
            placeholder="Add an item to buy..."
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-4 pr-11 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-sky-400/60 transition-colors"
          />
          <button
            type="submit"
            disabled={!newItemName.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-sky-400 text-[#18120a] flex items-center justify-center disabled:opacity-30 disabled:bg-white/10 disabled:text-white/30 transition-all active:scale-95"
            title="Add item"
          >
            <IconPlus size={16} stroke={2.5} />
          </button>
        </form>

        {/* Flat Checklist on Spine */}
        {activeItems.length === 0 && recentlyBoughtItems.length === 0 ? (
          <div className="mt-16 text-center text-[15px] text-white/30">
            Shopping list is empty.
          </div>
        ) : (
          <div className="relative">
            {/* Continuous Vertical Spine Line */}
            <div className="absolute top-2 bottom-6 left-[7px] w-[1px] bg-white/10 z-0" />

            <div className="flex flex-col gap-6 relative z-10">
              {/* Active List */}
              <div className="flex flex-col gap-1">
                <AnimatePresence>
                  {activeItems.map((it) => {
                    const isJustCompleted = justCompletedIds.has(it.id);

                    return (
                      <motion.div
                        key={it.id}
                        layout="position"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{
                          opacity: isJustCompleted ? 0.55 : 1,
                          y: 0,
                        }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="flex items-start gap-4 py-2 group cursor-pointer"
                        onClick={() => handleToggle(it.id)}
                      >
                        {/* Checkbox on Spine */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggle(it.id);
                          }}
                          className="relative mt-[3px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] border-sky-400/80 bg-[#18120a] flex items-center justify-center transition-all duration-200 z-10"
                        >
                          <AnimatePresence>
                            {isJustCompleted && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                transition={{ duration: 0.15 }}
                              >
                                <IconCheck size={10} stroke={3} className="text-white/80" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Item Name */}
                        <div className="flex-1 pr-2">
                          <span
                            className={`text-[15.5px] font-medium leading-snug transition-all ${
                              isJustCompleted
                                ? "line-through text-white/35"
                                : "text-white/95"
                            }`}
                          >
                            {it.name}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Recently Bought (Collapsible, auto-removed after 7 days) */}
              {recentlyBoughtItems.length > 0 && (
                <div className="flex flex-col gap-3 mt-4">
                  <div className="pl-6 relative">
                    <div className="absolute top-0 bottom-0 left-[-24px] w-[30px] bg-[#18120a] z-0" />

                    <button
                      onClick={() => setIsRecentExpanded(!isRecentExpanded)}
                      className="relative z-10 flex items-center gap-2 group py-1"
                    >
                      <IconChevronDown
                        size={14}
                        className={`text-white/30 transition-transform duration-200 ${
                          isRecentExpanded ? "rotate-180" : ""
                        }`}
                      />
                      <h2 className="text-[11px] font-semibold tracking-widest uppercase text-white/30 group-hover:text-white/50 transition-colors">
                        Recently bought ({recentlyBoughtItems.length})
                      </h2>
                    </button>
                  </div>

                  <AnimatePresence>
                    {isRecentExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-1 pt-1 pb-4">
                          {recentlyBoughtItems.map((it) => (
                            <div
                              key={it.id}
                              onClick={() => handleToggle(it.id)}
                              className="flex items-start gap-4 py-2 opacity-40 hover:opacity-75 transition-opacity cursor-pointer"
                            >
                              <div className="relative mt-[3px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] border-white/20 bg-white/10 flex items-center justify-center">
                                <IconCheck size={10} stroke={3} className="text-white/70" />
                              </div>
                              <span className="text-[15.5px] font-medium leading-snug line-through text-white/40">
                                {it.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
