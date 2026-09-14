"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronLeft,
  IconPlus,
  IconSearch,
  IconX,
  IconUser,
  IconArrowUpRight,
  IconGift,
  IconCoin,
  IconFileText,
  IconBook,
  IconBriefcase,
} from "@tabler/icons-react";
import Link from "next/link";

// --- Types ---
export type PersonCapture = {
  id: string;
  type: "gift" | "iou" | "meeting" | "journal" | "project";
  typeLabel: string;
  text: string;
  date: Date;
};

export type PersonProfile = {
  id: string;
  name: string;
  bio?: string;
  lastMentioned: Date;
  captures: PersonCapture[];
};

const initialPeople: PersonProfile[] = [];

export default function PeoplePage() {
  const [people, setPeople] = useState<PersonProfile[]>(initialPeople);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<PersonProfile | null>(null);

  // Add person modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonBio, setNewPersonBio] = useState("");

  // Search filter
  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return people;
    const q = searchQuery.toLowerCase();
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.bio && p.bio.toLowerCase().includes(q))
    );
  }, [people, searchQuery]);

  // Handle create person profile
  const handleAddPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;

    const newProfile: PersonProfile = {
      id: `p_${Date.now()}`,
      name: newPersonName.trim(),
      bio: newPersonBio.trim() || undefined,
      lastMentioned: new Date(),
      captures: [],
    };

    setPeople((prev) => [newProfile, ...prev]);
    setIsAddOpen(false);
    setNewPersonName("");
    setNewPersonBio("");
    setSelectedPerson(newProfile);
  };

  // Group captures by type for full profile screen
  const profileCapturesByType = useMemo(() => {
    if (!selectedPerson) return [];
    const map = new Map<string, PersonCapture[]>();

    selectedPerson.captures.forEach((c) => {
      if (!map.has(c.typeLabel)) {
        map.set(c.typeLabel, []);
      }
      map.get(c.typeLabel)!.push(c);
    });

    return Array.from(map.entries()).map(([typeLabel, items]) => ({
      typeLabel,
      items: items.sort((a, b) => b.date.getTime() - a.date.getTime()),
    }));
  }, [selectedPerson]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "gift":
        return <IconGift size={13} className="text-sky-400" />;
      case "iou":
        return <IconCoin size={13} className="text-sky-400" />;
      case "meeting":
        return <IconFileText size={13} className="text-sky-400" />;
      case "journal":
        return <IconBook size={13} className="text-sky-400" />;
      default:
        return <IconBriefcase size={13} className="text-sky-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#18120a] text-white overflow-x-hidden selection:bg-sky-500/20">
      {/* ── View 1: Main People Hub List ─────────────────────────── */}
      {!selectedPerson ? (
        <>
          {/* Header */}
          <header className="sticky top-0 z-40 bg-[#18120a]/85 backdrop-blur-xl border-b border-white/5 pt-12 pb-4 px-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/menu?item=people_notes"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 active:bg-white/10 transition-colors"
              >
                <IconChevronLeft size={20} className="text-white/70" />
              </Link>
              <h1 className="text-[20px] font-medium tracking-tight">People</h1>
            </div>

            {/* + Add Person Button */}
            <button
              onClick={() => setIsAddOpen(true)}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-sky-400 text-[#18120a] flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <IconPlus size={14} stroke={2.5} />
              <span>Add person</span>
            </button>
          </header>

          {/* Main Content */}
          <main className="px-5 pt-6 pb-24">
            {/* Search Input */}
            <div className="relative mb-8">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <IconSearch size={16} className="text-white/30" />
              </div>
              <input
                type="text"
                placeholder="Search people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-sky-400/60 transition-colors"
              />
            </div>

            {/* People List along Spine */}
            {filteredPeople.length === 0 ? (
              <div className="mt-16 text-center text-[15px] text-white/30">
                {searchQuery ? "No matching people found." : "No people profiles yet."}
              </div>
            ) : (
              <div className="relative">
                {/* Continuous Vertical Spine Line */}
                <div className="absolute top-2 bottom-6 left-[7px] w-[1px] bg-white/10 z-0" />

                <div className="flex flex-col gap-1 relative z-10">
                  <AnimatePresence>
                    {filteredPeople.map((person) => (
                      <motion.div
                        key={person.id}
                        layout="position"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={() => setSelectedPerson(person)}
                        className="flex items-start gap-4 py-2.5 group cursor-pointer"
                      >
                        {/* Dot on Spine */}
                        <div className="relative mt-[5px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] border-sky-400/70 bg-[#18120a] flex items-center justify-center z-10 group-hover:border-sky-400 transition-colors">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        </div>

                        {/* Person Row Content */}
                        <div className="flex-1 flex justify-between items-center pr-2">
                          <div className="flex flex-col">
                            <span className="text-[16px] font-medium text-white/95 leading-snug group-hover:text-sky-200/90 transition-colors">
                              {person.name}
                            </span>
                            {person.bio && (
                              <span className="text-[12px] text-white/40 mt-0.5 line-clamp-1">
                                {person.bio}
                              </span>
                            )}
                          </div>

                          {/* Live count of linked things */}
                          <div className="flex items-center gap-1 shrink-0 ml-3">
                            <span className="text-[12px] font-mono text-white/40 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full group-hover:border-sky-400/40 group-hover:text-sky-300/80 transition-colors">
                              {person.captures.length}{" "}
                              {person.captures.length === 1 ? "thing" : "things"}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </main>
        </>
      ) : (
        /* ── View 2: Full Person Profile Screen ─────────────────── */
        <div className="min-h-screen bg-[#18120a] text-white">
          {/* Profile Header */}
          <header className="sticky top-0 z-40 bg-[#18120a]/85 backdrop-blur-xl border-b border-white/5 pt-12 pb-4 px-5 flex items-center justify-between">
            <button
              onClick={() => setSelectedPerson(null)}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 active:bg-white/10">
                <IconChevronLeft size={20} />
              </div>
              <span className="text-[14px] font-mono uppercase tracking-wider text-white/50">
                All people
              </span>
            </button>

            <span className="text-[12px] font-mono text-sky-400/80">
              [[{selectedPerson.name}]]
            </span>
          </header>

          <main className="px-5 pt-6 pb-28">
            {/* Person Hero Info */}
            <div className="mb-8 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center gap-3.5 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-sky-400/20 border border-sky-400/40 flex items-center justify-center text-sky-400 font-bold text-[18px]">
                  {selectedPerson.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-[20px] font-semibold text-white tracking-tight m-0">
                    {selectedPerson.name}
                  </h2>
                  <p className="text-[12.5px] text-white/45 m-0 mt-0.5">
                    {selectedPerson.bio || "TRON contact"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-white/5 text-[11px] font-mono text-white/40">
                <span>Total linked captures:</span>
                <span className="text-sky-400 font-semibold">
                  {selectedPerson.captures.length}
                </span>
              </div>
            </div>

            {/* Linked Captures Grouped by Type */}
            {profileCapturesByType.length === 0 ? (
              <div className="mt-12 text-center text-[14px] text-white/30">
                No captures linking to [[{selectedPerson.name}]] yet.
              </div>
            ) : (
              <div className="relative">
                {/* Vertical Spine Line */}
                <div className="absolute top-2 bottom-6 left-[7px] w-[1px] bg-white/10 z-0" />

                <div className="flex flex-col gap-8 relative z-10">
                  {profileCapturesByType.map(({ typeLabel, items }) => (
                    <div key={typeLabel} className="flex flex-col gap-3">
                      {/* Section Header */}
                      <div className="flex items-center gap-2 pl-8">
                        {getTypeIcon(items[0]?.type)}
                        <h3 className="text-[11px] font-semibold tracking-widest uppercase text-sky-400 font-mono m-0">
                          {typeLabel}
                        </h3>
                        <span className="text-[11px] font-mono text-white/35">
                          ({items.length})
                        </span>
                      </div>

                      {/* Items under this type */}
                      <div className="flex flex-col gap-2">
                        {items.map((capture) => (
                          <div
                            key={capture.id}
                            className="flex items-start gap-4 py-1.5"
                          >
                            <div className="relative mt-[5px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] border-sky-400/60 bg-[#18120a] flex items-center justify-center z-10">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400/80" />
                            </div>

                            <div className="flex-1 pr-2">
                              <p className="text-[14.5px] font-normal text-white/90 leading-snug m-0">
                                {capture.text}
                              </p>
                              <span className="text-[11.5px] font-mono text-white/30 mt-1 block">
                                {capture.date.toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* ── Modal: Add Person ────────────────────────────────────── */}
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
                  Add New Person Profile
                </h3>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60"
                >
                  <IconX size={16} />
                </button>
              </div>

              <form onSubmit={handleAddPerson} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                    Full name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maya Lin"
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-[15px] text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                    Context / Bio (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Collaborator, Berkeley architecture lab"
                    value={newPersonBio}
                    onChange={(e) => setNewPersonBio(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-[15px] text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                <p className="text-[12px] text-white/40 m-0 leading-relaxed">
                  Creates an entry in the <span className="text-sky-400">[[links]]</span> index
                  for bi-directional backlinks across the TRON graph.
                </p>

                <button
                  type="submit"
                  className="w-full mt-2 py-3 rounded-xl bg-sky-400 text-[#18120a] font-medium text-[15px] active:scale-[0.99] transition-transform"
                >
                  Create person profile
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
