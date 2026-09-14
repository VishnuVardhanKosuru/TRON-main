"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronLeft,
  IconSearch,
  IconLink,
  IconArrowUpRight,
  IconBookmark,
} from "@tabler/icons-react";
import Link from "next/link";

export type FeedItem = {
  id: string;
  text: string;
  url?: string; // Optional URL for reading list and reference links
  createdAt: Date;
  tags?: string[];
  is_reference?: boolean;
};

export type SimpleFeedProps = {
  title: string;
  nounSingular: string;
  nounPlural: string;
  initialItems: FeedItem[];
  showDomain?: boolean; // For reading list
  emptyMessage?: string;
  backHref?: string;
};

// Helper: client-side extract clean domain name from URL
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}

export default function SimpleFeed({
  title,
  nounSingular,
  nounPlural,
  initialItems,
  showDomain = false,
  emptyMessage = "Nothing captured yet.",
  backHref,
}: SimpleFeedProps) {
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const handleToggleReference = (id: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, is_reference: !it.is_reference } : it
      )
    );
    setSelectedItem((prev) =>
      prev && prev.id === id ? { ...prev, is_reference: !prev.is_reference } : prev
    );
  };

  // Filter items by search query & sort newest first
  const filteredItems = useMemo(() => {
    let list = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.text.toLowerCase().includes(q) ||
          (it.url && it.url.toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, searchQuery]);

  return (
    <div className="min-h-screen bg-[#18120a] text-white overflow-x-hidden selection:bg-sky-500/20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#18120a]/85 backdrop-blur-xl border-b border-white/5 pt-12 pb-4 px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={backHref || "/menu"}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 active:bg-white/10 transition-colors"
          >
            <IconChevronLeft size={20} className="text-white/70" />
          </Link>
          <h1 className="text-[20px] font-medium tracking-tight">{title}</h1>
        </div>
        <div className="text-[13px] text-white/40 font-mono">
          {items.length} {items.length === 1 ? nounSingular : nounPlural}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-5 pt-6 pb-24">
        {/* Search Field near top */}
        <div className="relative mb-8">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <IconSearch size={16} className="text-white/30" />
          </div>
          <input
            type="text"
            placeholder={`Search ${nounPlural}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-sky-400/60 transition-colors"
          />
        </div>

        {/* Flat Feed on Spine */}
        {filteredItems.length === 0 ? (
          <div className="mt-16 text-center text-[15px] text-white/30">
            {searchQuery ? "No matching entries found." : emptyMessage}
          </div>
        ) : (
          <div className="relative">
            {/* Continuous Vertical Spine Line */}
            <div className="absolute top-2 bottom-6 left-[7px] w-[1px] bg-white/10 z-0" />

            <div className="flex flex-col gap-1 relative z-10">
              <AnimatePresence>
                {filteredItems.map((item) => {
                  const domain = item.url ? extractDomain(item.url) : null;

                  return (
                    <motion.div
                      key={item.id}
                      layout="position"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      onClick={() => setSelectedItem(item)}
                      className="flex items-start gap-4 py-2.5 group cursor-pointer"
                    >
                      {/* Accent Dot on Spine */}
                      <div className="relative mt-[5px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] border-sky-400/60 bg-[#18120a] flex items-center justify-center z-10 group-hover:border-sky-400 transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400/70 group-hover:bg-sky-400 transition-colors" />
                      </div>

                      {/* Content Row */}
                      <div className="flex-1 flex flex-col pr-2">
                        {/* Text with Person chip rendering */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[15.5px] font-medium text-white/95 leading-snug group-hover:text-sky-200/90 transition-colors">
                            {item.text}
                          </span>
                        </div>

                        {/* Person chips extracted from [[Person]] links */}
                        {(() => {
                          const personMatches =
                            item.text.match(/\[\[(.*?)\]\]/g)?.map((m) => m.slice(2, -2)) ?? [];
                          if (personMatches.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {personMatches.map((person) => (
                                <span
                                  key={person}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/15 border border-sky-500/30 text-sky-400 font-mono"
                                >
                                  @{person}
                                </span>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Client-side Domain extraction for reading list */}
                        {showDomain && domain && (
                          <div className="flex items-center gap-1.5 mt-1 text-[12px] font-mono text-white/40 group-hover:text-sky-400/70 transition-colors">
                            <IconLink size={11} stroke={2} />
                            <span>{domain}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>

      {/* ── Detail View Modal (Link to Note Detail View) ─────────── */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md bg-[#1c160f] border-t border-white/10 rounded-t-3xl p-6 shadow-2xl z-10 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-mono uppercase tracking-widest text-sky-400">
                  {title}
                </span>
                <span className="text-[11.5px] font-mono text-white/40">
                  {selectedItem.createdAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              <h3 className="text-[18px] font-medium text-white leading-snug mb-3">
                {selectedItem.text}
              </h3>

              {selectedItem.url && (
                <div className="mb-4">
                  <a
                    href={selectedItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] font-mono text-sky-400 hover:underline break-all"
                  >
                    <span>{selectedItem.url}</span>
                    <IconArrowUpRight size={13} className="shrink-0" />
                  </a>
                </div>
              )}

              {/* Reference Bookmark Pin Toggle (Distinction from Reading list) */}
              {selectedItem.url && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <IconBookmark
                      size={15}
                      className={
                        selectedItem.is_reference
                          ? "text-sky-400 fill-sky-400"
                          : "text-white/40"
                      }
                    />
                    <span className="text-[12.5px] text-white/80">
                      {selectedItem.is_reference
                        ? "Saved as Personal reference"
                        : "Queued in Reading list"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleReference(selectedItem.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-all ${
                      selectedItem.is_reference
                        ? "bg-sky-400/20 text-sky-400 border border-sky-400/40"
                        : "bg-white/5 text-white/60 border border-white/10 hover:text-white"
                    }`}
                  >
                    {selectedItem.is_reference ? "Remove ref" : "Mark as ref"}
                  </button>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-[13px] text-white/60 mb-5">
                <p className="m-0 leading-relaxed">
                  Note detail view & backlinks panel connected to TRON graph.
                </p>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="w-full py-2.5 rounded-xl bg-white/10 border border-white/10 text-white/80 text-[14px] font-medium"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
