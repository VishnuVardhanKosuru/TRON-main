"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronLeft,
  IconPlus,
  IconAlertTriangle,
  IconCircleCheck,
  IconRefresh,
} from "@tabler/icons-react";
import Link from "next/link";

// --- Types ---
type StockItem = {
  id: string;
  name: string;
  isLow: boolean; // true = Running low, false = Stocked
  updatedAt: Date;
};

const initialStock: StockItem[] = [];

export default function StockTrackingPage() {
  const [items, setItems] = useState<StockItem[]>(initialStock);
  const [newItemName, setNewItemName] = useState("");

  // Group into Running Low vs Stocked
  const { runningLow, stocked } = useMemo(() => {
    const low: StockItem[] = [];
    const ok: StockItem[] = [];

    items.forEach((item) => {
      if (item.isLow) {
        low.push(item);
      } else {
        ok.push(item);
      }
    });

    return { runningLow: low, stocked: ok };
  }, [items]);

  // Inline Quick Add
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem: StockItem = {
      id: `stock_${Date.now()}`,
      name: newItemName.trim(),
      isLow: false, // Default to stocked
      updatedAt: new Date(),
    };

    setItems((prev) => [newItem, ...prev]);
    setNewItemName("");
  };

  // Flip low-stock state
  const handleToggleLow = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, isLow: !item.isLow, updatedAt: new Date() }
          : item
      )
    );
  };

  return (
    <div className="min-h-screen bg-[#18120a] text-white overflow-x-hidden selection:bg-sky-500/20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#18120a]/85 backdrop-blur-xl border-b border-white/5 pt-12 pb-4 px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/menu?item=stock"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 active:bg-white/10 transition-colors"
          >
            <IconChevronLeft size={20} className="text-white/70" />
          </Link>
          <h1 className="text-[20px] font-medium tracking-tight">Stock tracking</h1>
        </div>
        <div className="text-[13px] text-white/40 font-mono">
          {runningLow.length} running low
        </div>
      </header>

      {/* Main Content */}
      <main className="px-5 pt-6 pb-24">
        {/* Inline Quick-Add Input pinned near top */}
        <form onSubmit={handleQuickAdd} className="relative mb-8">
          <input
            type="text"
            placeholder="Add household staple..."
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-4 pr-11 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-sky-400/60 transition-colors"
          />
          <button
            type="submit"
            disabled={!newItemName.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-sky-400 text-[#18120a] flex items-center justify-center disabled:opacity-30 disabled:bg-white/10 disabled:text-white/30 transition-all active:scale-95"
            title="Add stock item"
          >
            <IconPlus size={16} stroke={2.5} />
          </button>
        </form>

        {items.length === 0 ? (
          <div className="mt-16 text-center text-[15px] text-white/30">
            No stock items tracked.
          </div>
        ) : (
          <div className="relative">
            {/* Continuous Vertical Spine Line */}
            <div className="absolute top-2 bottom-6 left-[7px] w-[1px] bg-white/10 z-0" />

            <div className="flex flex-col gap-8 relative z-10">
              {/* Group 1: Running low (Warning / Amber) */}
              {runningLow.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 pl-8">
                    <h2 className="text-[11px] font-semibold tracking-widest uppercase text-sky-400">
                      Running low
                    </h2>
                    <span className="text-[11px] font-mono text-sky-400/60">
                      ({runningLow.length})
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <AnimatePresence>
                      {runningLow.map((item) => (
                        <motion.div
                          key={item.id}
                          layout="position"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="flex items-start gap-4 py-2 group cursor-pointer"
                          onClick={() => handleToggleLow(item.id)}
                        >
                          {/* Amber Dot on Spine */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleLow(item.id);
                            }}
                            className="relative mt-[3px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] border-sky-400 bg-sky-400/20 flex items-center justify-center z-10"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                          </div>

                          {/* Item Content */}
                          <div className="flex-1 flex justify-between items-center pr-2">
                            <span className="text-[15.5px] font-medium text-white/95">
                              {item.name}
                            </span>

                            {/* Low Stock Status Pill / Toggle Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLow(item.id);
                              }}
                              className="px-2.5 py-1 rounded-full text-[11.5px] font-mono font-medium flex items-center gap-1.5 bg-sky-500/15 border border-sky-500/35 text-sky-400 transition-all hover:bg-sky-500/25 active:scale-95"
                              title="Tap to mark stocked"
                            >
                              <IconAlertTriangle size={12} stroke={2.2} />
                              <span>Low</span>
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Group 2: Stocked */}
              {stocked.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 pl-8">
                    <h2 className="text-[11px] font-semibold tracking-widest uppercase text-white/40">
                      Stocked
                    </h2>
                    <span className="text-[11px] font-mono text-white/30">
                      ({stocked.length})
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <AnimatePresence>
                      {stocked.map((item) => (
                        <motion.div
                          key={item.id}
                          layout="position"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="flex items-start gap-4 py-2 group cursor-pointer opacity-75 hover:opacity-100 transition-opacity"
                          onClick={() => handleToggleLow(item.id)}
                        >
                          {/* Neutral Muted Dot on Spine */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleLow(item.id);
                            }}
                            className="relative mt-[3px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] border-white/20 bg-[#18120a] flex items-center justify-center z-10"
                          />

                          {/* Item Content */}
                          <div className="flex-1 flex justify-between items-center pr-2">
                            <span className="text-[15.5px] font-medium text-white/80">
                              {item.name}
                            </span>

                            {/* Stocked Status Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLow(item.id);
                              }}
                              className="px-2.5 py-1 rounded-full text-[11.5px] font-mono font-medium flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/45 hover:text-white/70 transition-all active:scale-95"
                              title="Tap to mark running low"
                            >
                              <IconCircleCheck size={12} stroke={2} className="text-white/40" />
                              <span>OK</span>
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
