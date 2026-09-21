"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronLeft,
  IconChevronDown,
  IconPlus,
  IconCheck,
  IconX,
  IconArrowUpRight,
  IconArrowDownLeft,
} from "@tabler/icons-react";
import Link from "next/link";

export type LedgerItem = {
  id: string;
  direction: "outgoing" | "incoming"; // outgoing = You lent / You're owed; incoming = You borrowed / You owe
  primaryText: string; // Item name (for borrowed) OR Person name (for IOUs)
  secondaryText?: string; // Person name (for borrowed) OR Note/Context (for IOUs)
  amount?: number; // For IOUs (e.g. 45.00)
  date: Date;
  resolvedAt: Date | null;
};

export type DirectionalLedgerProps = {
  title: string; // "Borrowed and lent" or "IOUs"
  outgoingTitle: string; // "You lent" or "You're owed"
  incomingTitle: string; // "You borrowed" or "You owe"
  resolvedTitle: string; // "Returned" or "Settled"
  resolveVerb: string; // "Returned" or "Settled"
  mode: "borrowed" | "ious";
  initialItems: LedgerItem[];
};

export default function DirectionalLedger({
  title,
  outgoingTitle,
  incomingTitle,
  resolvedTitle,
  resolveVerb,
  mode,
  initialItems,
}: DirectionalLedgerProps) {
  const [items, setItems] = useState<LedgerItem[]>(initialItems);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isResolvedExpanded, setIsResolvedExpanded] = useState(false);
  const [justResolvedIds, setJustResolvedIds] = useState<Set<string>>(new Set());

  // Form states
  const [formDirection, setFormDirection] = useState<"outgoing" | "incoming">("outgoing");
  const [formPrimary, setFormPrimary] = useState("");
  const [formSecondary, setFormSecondary] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Active items count
  const activeCount = useMemo(() => {
    return items.filter((it) => !it.resolvedAt && !justResolvedIds.has(it.id)).length;
  }, [items, justResolvedIds]);

  // Grouping by direction
  const { outgoingItems, incomingItems, resolvedItems } = useMemo(() => {
    const out: LedgerItem[] = [];
    const inc: LedgerItem[] = [];
    const resolved: LedgerItem[] = [];

    items.forEach((it) => {
      const isActuallyResolved = it.resolvedAt && !justResolvedIds.has(it.id);

      if (isActuallyResolved) {
        resolved.push(it);
      } else if (it.direction === "outgoing") {
        out.push(it);
      } else {
        inc.push(it);
      }
    });

    out.sort((a, b) => b.date.getTime() - a.date.getTime());
    inc.sort((a, b) => b.date.getTime() - a.date.getTime());
    resolved.sort((a, b) => (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0));

    return { outgoingItems: out, incomingItems: inc, resolvedItems: resolved };
  }, [items, justResolvedIds]);

  // Toggle resolve
  const handleToggleResolve = (id: string) => {
    const target = items.find((it) => it.id === id);
    if (!target) return;

    if (target.resolvedAt) {
      // Un-resolve
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, resolvedAt: null } : it))
      );
    } else {
      // Settle animation before moving to resolved section
      setJustResolvedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, resolvedAt: new Date() } : it))
      );

      setTimeout(() => {
        setJustResolvedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 500);
    }
  };

  // Add Item Submit
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPrimary.trim()) return;

    const newItem: LedgerItem = {
      id: `ledg_${Date.now()}`,
      direction: formDirection,
      primaryText: formPrimary.trim(),
      secondaryText: formSecondary.trim() || undefined,
      amount: mode === "ious" && formAmount ? parseFloat(formAmount) || 0 : undefined,
      date: new Date(formDate),
      resolvedAt: null,
    };

    setItems((prev) => [newItem, ...prev]);
    setIsAddOpen(false);
    setFormPrimary("");
    setFormSecondary("");
    setFormAmount("");
    setFormDate(new Date().toISOString().split("T")[0]);
  };

  const formatDateShort = (d: Date) => {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatCurrency = (amt?: number) => {
    if (amt == null) return "";
    return `$${amt.toFixed(2)}`;
  };

  const renderRow = (it: LedgerItem, dotBorder: string, isResolved = false) => {
    const isJustResolved = justResolvedIds.has(it.id);
    const resolved = !!it.resolvedAt || isResolved;

    return (
      <motion.div
        key={it.id}
        layout="position"
        initial={{ opacity: 0, y: 8 }}
        animate={{
          opacity: resolved && !isJustResolved ? 0.45 : isJustResolved ? 0.5 : 1,
          y: 0,
        }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex items-start gap-4 py-2 group"
      >
        {/* Checkbox / Toggle Dot on Spine */}
        <div
          onClick={() => handleToggleResolve(it.id)}
          className={`relative mt-[3px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] cursor-pointer ${
            resolved || isJustResolved
              ? "border-white/20 bg-white/10"
              : dotBorder
          } flex items-center justify-center transition-all duration-200 z-10`}
          title={`Mark as ${resolveVerb}`}
        >
          <AnimatePresence>
            {(resolved || isJustResolved) && (
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

        {/* Content */}
        <div className="flex-1 flex justify-between items-start gap-3 pr-2">
          <div className="flex flex-col">
            <span
              className={`text-[15.5px] font-medium leading-snug transition-all ${
                resolved || isJustResolved ? "line-through text-white/35" : "text-white/95"
              }`}
            >
              {it.primaryText}
            </span>

            {it.secondaryText && (
              <span className="text-[12px] text-white/45 mt-0.5">
                {mode === "borrowed"
                  ? it.direction === "outgoing"
                    ? `To ${it.secondaryText}`
                    : `From ${it.secondaryText}`
                  : it.secondaryText}
              </span>
            )}
          </div>

          <div className="flex flex-col items-end shrink-0 mt-[2px]">
            {mode === "ious" && it.amount != null ? (
              <span
                className={`text-[15px] font-mono font-medium ${
                  resolved || isJustResolved
                    ? "line-through text-white/30"
                    : it.direction === "outgoing"
                    ? "text-sky-400"
                    : "text-white/80"
                }`}
              >
                {it.direction === "outgoing" ? "+" : "-"}
                {formatCurrency(it.amount)}
              </span>
            ) : (
              <span className="text-[12.5px] text-white/40 whitespace-nowrap">
                {formatDateShort(it.date)}
              </span>
            )}

            {mode === "ious" && (
              <span className="text-[11px] font-mono text-white/30 mt-0.5">
                {formatDateShort(it.date)}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-[#050a14] text-white overflow-x-hidden selection:bg-sky-500/20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#050a14]/85 backdrop-blur-xl border-b border-white/5 pt-12 pb-4 px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={mode === "ious" ? "/menu?item=iou" : "/menu?item=borrowed"}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 active:bg-white/10 transition-colors"
          >
            <IconChevronLeft size={20} className="text-white/70" />
          </Link>
          <h1 className="text-[20px] font-medium tracking-tight">{title}</h1>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-sky-400 text-[#050a14] active:scale-95 transition-transform"
          title={`Add to ${title}`}
        >
          <IconPlus size={18} stroke={2.5} />
        </button>
      </header>

      {/* Main Content */}
      <main className="px-5 pt-6 pb-24">
        {activeCount === 0 && resolvedItems.length === 0 ? (
          <div className="mt-16 text-center text-[15px] text-white/30">Nothing here yet.</div>
        ) : (
          <div className="relative">
            {/* Continuous Vertical Spine Line */}
            <div className="absolute top-2 bottom-6 left-[7px] w-[1px] bg-white/10 z-0" />

            <div className="flex flex-col gap-8 relative z-10">
              {/* Group 1: Outgoing (You lent / You're owed) */}
              {outgoingItems.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 pl-8">
                    <IconArrowUpRight size={13} className="text-sky-400" />
                    <h2 className="text-[11px] font-semibold tracking-widest uppercase text-sky-400">
                      {outgoingTitle}
                    </h2>
                    <span className="text-[11px] font-mono text-sky-400/60">
                      ({outgoingItems.length})
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <AnimatePresence>
                      {outgoingItems.map((it) =>
                        renderRow(it, "border-sky-400/80 bg-[#050a14]")
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Group 2: Incoming (You borrowed / You owe) */}
              {incomingItems.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 pl-8">
                    <IconArrowDownLeft size={13} className="text-white/50" />
                    <h2 className="text-[11px] font-semibold tracking-widest uppercase text-white/50">
                      {incomingTitle}
                    </h2>
                    <span className="text-[11px] font-mono text-white/30">
                      ({incomingItems.length})
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <AnimatePresence>
                      {incomingItems.map((it) =>
                        renderRow(it, "border-white/40 bg-[#050a14]")
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Group 3: Resolved (Returned / Settled) - Collapsed by default */}
              {resolvedItems.length > 0 && (
                <div className="flex flex-col gap-3 mt-4">
                  <div className="pl-6 relative">
                    <div className="absolute top-0 bottom-0 left-[-24px] w-[30px] bg-[#050a14] z-0" />

                    <button
                      onClick={() => setIsResolvedExpanded(!isResolvedExpanded)}
                      className="relative z-10 flex items-center gap-2 group py-1"
                    >
                      <IconChevronDown
                        size={14}
                        className={`text-white/30 transition-transform duration-200 ${
                          isResolvedExpanded ? "rotate-180" : ""
                        }`}
                      />
                      <h2 className="text-[11px] font-semibold tracking-widest uppercase text-white/30 group-hover:text-white/50 transition-colors">
                        {resolvedTitle} ({resolvedItems.length})
                      </h2>
                    </button>
                  </div>

                  <AnimatePresence>
                    {isResolvedExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-1 pt-1 pb-4">
                          {resolvedItems.map((it) =>
                            renderRow(it, "border-white/20 bg-white/10", true)
                          )}
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

      {/* ── Add Form Bottom Sheet Modal ──────────────────────────── */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md bg-[#1c160f] border-t border-white/10 rounded-t-3xl p-6 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[18px] font-medium tracking-tight text-white">
                  Add to {title}
                </h3>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60"
                >
                  <IconX size={16} />
                </button>
              </div>

              <form onSubmit={handleAddItem} className="flex flex-col gap-4">
                {/* Direction Toggle */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                    Direction
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setFormDirection("outgoing")}
                      className={`py-2 text-[13px] font-medium rounded-lg transition-all ${
                        formDirection === "outgoing"
                          ? "bg-sky-400 text-[#050a14] font-semibold"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      {mode === "borrowed" ? "I lent" : "Owed to me"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormDirection("incoming")}
                      className={`py-2 text-[13px] font-medium rounded-lg transition-all ${
                        formDirection === "incoming"
                          ? "bg-sky-400 text-[#050a14] font-semibold"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      {mode === "borrowed" ? "I borrowed" : "I owe"}
                    </button>
                  </div>
                </div>

                {/* Field 1: Primary Text (Item Name for Borrowed, Person Name for IOUs) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                    {mode === "borrowed" ? "Item name" : "Person name"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      mode === "borrowed"
                        ? "e.g. Camping tent or DSLR lens"
                        : "e.g. Alex Henderson"
                    }
                    value={formPrimary}
                    onChange={(e) => setFormPrimary(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-[15px] text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                {/* Field 2: Secondary / Amount Field */}
                {mode === "borrowed" ? (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                      Person name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        formDirection === "outgoing"
                          ? "Who did you lend it to?"
                          : "Who did you borrow it from?"
                      }
                      value={formSecondary}
                      onChange={(e) => setFormSecondary(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-[15px] text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                        Amount ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-[15px] font-mono text-white focus:outline-none focus:border-sky-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                        Context (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dinner split"
                        value={formSecondary}
                        onChange={(e) => setFormSecondary(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-[15px] text-white focus:outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>
                )}

                {/* Field 3: Date (defaults to today) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-[14px] font-mono text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-3 py-3 rounded-xl bg-sky-400 text-[#050a14] font-medium text-[15px] active:scale-[0.99] transition-transform"
                >
                  Save to {title}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
