"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronLeft,
  IconPlus,
  IconCheck,
  IconX,
  IconMapPin,
  IconChevronDown,
  IconBuildingStore,
} from "@tabler/icons-react";
import Link from "next/link";

// --- Types ---
export type LocationErrand = {
  id: string;
  place: string; // e.g. "Pharmacy", "Supermarket"
  text: string; // e.g. "Pick up allergy eye drops"
  completedAt: Date | null;
  createdAt: Date;
};

const initialErrands: LocationErrand[] = [];

export default function LocationErrandsPage() {
  const [errands, setErrands] = useState<LocationErrand[]>(initialErrands);
  const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set());
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);

  // Modal form state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formText, setFormText] = useState("");
  const [formPlace, setFormPlace] = useState("");

  // Existing unique places for autocomplete suggestion
  const existingPlaces = useMemo(() => {
    const set = new Set<string>();
    errands.forEach((e) => set.add(e.place));
    // Defaults if empty
    set.add("Pharmacy");
    set.add("Supermarket");
    set.add("Hardware Store");
    set.add("Post Office");
    set.add("Dry Cleaner");
    return Array.from(set);
  }, [errands]);

  // Autocomplete filtered options
  const placeSuggestions = useMemo(() => {
    if (!formPlace.trim()) return existingPlaces;
    const q = formPlace.toLowerCase();
    return existingPlaces.filter((p) => p.toLowerCase().includes(q));
  }, [existingPlaces, formPlace]);

  // Active items count
  const activeCount = useMemo(() => {
    return errands.filter((e) => !e.completedAt && !justCompletedIds.has(e.id)).length;
  }, [errands, justCompletedIds]);

  // Grouping by place name
  const { placeGroups, completedErrands } = useMemo(() => {
    const map = new Map<string, LocationErrand[]>();
    const completed: LocationErrand[] = [];

    errands.forEach((errand) => {
      const isActuallyCompleted = errand.completedAt && !justCompletedIds.has(errand.id);

      if (isActuallyCompleted) {
        completed.push(errand);
        return;
      }

      if (!map.has(errand.place)) {
        map.set(errand.place, []);
      }
      map.get(errand.place)!.push(errand);
    });

    return {
      placeGroups: Array.from(map.entries()).map(([place, items]) => ({
        place,
        items,
      })),
      completedErrands: completed,
    };
  }, [errands, justCompletedIds]);

  // Toggle completion
  const handleToggle = (id: string) => {
    const errand = errands.find((item) => item.id === id);
    if (!errand) return;

    if (errand.completedAt) {
      // Revert instantly
      setErrands((prev) =>
        prev.map((item) => (item.id === id ? { ...item, completedAt: null } : item))
      );
    } else {
      // Animate check, strikethrough, settle, then shift
      setJustCompletedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      setErrands((prev) =>
        prev.map((item) => (item.id === id ? { ...item, completedAt: new Date() } : item))
      );

      setTimeout(() => {
        setJustCompletedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 550);
    }
  };

  // Add Errand
  const handleAddErrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim() || !formPlace.trim()) return;

    const newErrand: LocationErrand = {
      id: `err_${Date.now()}`,
      place: formPlace.trim(),
      text: formText.trim(),
      completedAt: null,
      createdAt: new Date(),
    };

    setErrands((prev) => [newErrand, ...prev]);
    setIsAddOpen(false);
    setFormText("");
    setFormPlace("");
  };

  return (
    <div className="min-h-screen bg-[#050a14] text-white overflow-x-hidden selection:bg-sky-500/20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#050a14]/85 backdrop-blur-xl border-b border-white/5 pt-12 pb-4 px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/menu?item=errands"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 active:bg-white/10 transition-colors"
          >
            <IconChevronLeft size={20} className="text-white/70" />
          </Link>
          <h1 className="text-[20px] font-medium tracking-tight">Location errands</h1>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-sky-400 text-[#050a14] active:scale-95 transition-transform"
          title="Add location errand"
        >
          <IconPlus size={18} stroke={2.5} />
        </button>
      </header>

      {/* Main Content */}
      <main className="px-5 pt-6 pb-24">
        {activeCount === 0 && completedErrands.length === 0 ? (
          <div className="mt-16 text-center text-[15px] text-white/30">
            No location errands pending.
          </div>
        ) : (
          <div className="relative">
            {/* Continuous Vertical Spine Line */}
            <div className="absolute top-2 bottom-6 left-[7px] w-[1px] bg-white/10 z-0" />

            <div className="flex flex-col gap-8 relative z-10">
              {/* Places Groups */}
              {placeGroups.map(({ place, items }) => (
                <div key={place} className="flex flex-col gap-3">
                  {/* Place Section Header */}
                  <div className="flex items-center gap-2 pl-8 text-sky-400">
                    <IconMapPin size={13} stroke={2} className="text-sky-400/80" />
                    <h2 className="text-[12px] font-mono font-semibold uppercase tracking-[0.14em]">
                      {place}
                    </h2>
                    <span className="text-[11px] font-mono text-white/35">({items.length})</span>
                  </div>

                  {/* Errands at this place */}
                  <div className="flex flex-col gap-1">
                    <AnimatePresence>
                      {items.map((errand) => {
                        const isJustCompleted = justCompletedIds.has(errand.id);

                        return (
                          <motion.div
                            key={errand.id}
                            layout="position"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{
                              opacity: isJustCompleted ? 0.55 : 1,
                              y: 0,
                            }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className="flex items-start gap-4 py-2 group cursor-pointer"
                          >
                            {/* Checkbox Dot on Spine */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggle(errand.id);
                              }}
                              className="relative mt-[3px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] border-sky-400/80 bg-[#050a14] flex items-center justify-center transition-all duration-300 z-10"
                            >
                              <AnimatePresence>
                                {isJustCompleted && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0 }}
                                  >
                                    <IconCheck size={10} stroke={3} className="text-white/80" />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Content */}
                            <div className="flex-1 flex justify-between items-start gap-3 pr-2">
                              <span
                                className={`text-[15.5px] font-medium leading-snug transition-all ${
                                  isJustCompleted ? "line-through text-white/40" : "text-white/95"
                                }`}
                              >
                                {errand.text}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              ))}

              {/* Completed Section (Collapsible) */}
              {completedErrands.length > 0 && (
                <div className="flex flex-col gap-3 mt-4">
                  <div className="pl-6 relative">
                    <div className="absolute top-0 bottom-0 left-[-24px] w-[30px] bg-[#050a14] z-0" />

                    <button
                      onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                      className="relative z-10 flex items-center gap-2 group py-1"
                    >
                      <IconChevronDown
                        size={14}
                        className={`text-white/30 transition-transform duration-300 ${
                          isCompletedExpanded ? "rotate-180" : ""
                        }`}
                      />
                      <h2 className="text-[11px] font-semibold tracking-widest uppercase text-white/30 group-hover:text-white/50 transition-colors">
                        Completed ({completedErrands.length})
                      </h2>
                    </button>
                  </div>

                  <AnimatePresence>
                    {isCompletedExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-1 pt-1 pb-4">
                          {completedErrands.map((errand) => (
                            <div
                              key={errand.id}
                              className="flex items-start gap-4 py-2 opacity-40 hover:opacity-75 transition-opacity"
                            >
                              <div
                                onClick={() => handleToggle(errand.id)}
                                className="relative mt-[3px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] border-white/20 bg-white/10 flex items-center justify-center cursor-pointer"
                              >
                                <IconCheck size={10} stroke={3} className="text-white/70" />
                              </div>
                              <div className="flex-1 flex justify-between items-start gap-3 pr-2">
                                <span className="text-[15.5px] font-medium leading-snug line-through text-white/40">
                                  {errand.text}
                                </span>
                                <span className="text-[12px] font-mono text-white/30 shrink-0 mt-0.5">
                                  {errand.place}
                                </span>
                              </div>
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

      {/* ── Add Location Errand Bottom Sheet ─────────────────────── */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md bg-[#1c160f] border-t border-white/10 rounded-t-3xl p-6 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[18px] font-medium tracking-tight text-white">
                  New Location Errand
                </h3>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60"
                >
                  <IconX size={16} />
                </button>
              </div>

              <form onSubmit={handleAddErrand} className="flex flex-col gap-4">
                {/* Field 1: Errand text */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                    Errand text
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Return library books"
                    value={formText}
                    onChange={(e) => setFormText(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-[15px] text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                {/* Field 2: Place Picker with Autocomplete */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                    Place / Location
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Type or select a place..."
                      value={formPlace}
                      onChange={(e) => setFormPlace(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-[15px] text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  {/* Autocomplete Suggestions Chips */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {placeSuggestions.slice(0, 6).map((place) => (
                      <button
                        key={place}
                        type="button"
                        onClick={() => setFormPlace(place)}
                        className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition-all ${
                          formPlace === place
                            ? "bg-sky-400 text-[#050a14] font-semibold"
                            : "bg-white/5 text-white/60 border border-white/10 hover:border-white/20"
                        }`}
                      >
                        {place}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-3 py-3 rounded-xl bg-sky-400 text-[#050a14] font-medium text-[15px] active:scale-[0.99] transition-transform"
                >
                  Add errand
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
