"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconCheckbox,
  IconBell,
  IconRepeat,
  IconMapPin,
  IconShoppingCart,
  IconPackage,
  IconArrowsLeftRight,
  IconCoin,
  IconBulb,
  IconLink,
  IconHelpCircle,
  IconBook,
  IconStar,
  IconUsers,
  IconFileText,
  IconHeartHandshake,
  IconPlane,
  IconDeviceTv,
  IconBookmark,
  IconX,
  IconPlus,
  IconCheck,
  IconBolt,
  IconBrain,
  IconSparkles,
  IconChevronLeft,
  IconChevronRight,
  IconTarget,
  IconShieldLock,
  IconMoodSmile,
  IconHeartbeat,
} from "@tabler/icons-react";
import { useAuthContext } from "@/context/AuthContext";
import { useCapture } from "@/components/CaptureProvider";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "@/lib/tron/firestore";
import { db } from "@/lib/local-db";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MenuItem {
  id: string;
  label: string;
  subtitle: string;
  collectionName: string;
  typeFilter?: string;
  icon: (props: { size?: number; stroke?: number; color?: string }) => React.ReactNode;
}

export interface MenuSection {
  id: string;
  name: string;
  badge: string;
  icon: (props: { size?: number; stroke?: number; color?: string }) => React.ReactNode;
  items: MenuItem[];
}

const SECTIONS: MenuSection[] = [
  {
    id: "action",
    name: "Action",
    badge: "01",
    icon: (p) => <IconBolt {...p} />,
    items: [
      { id: "todos", label: "Todos", subtitle: "One-off tasks", collectionName: "todos", icon: (p) => <IconCheckbox {...p} /> },
      { id: "reminders", label: "Reminders", subtitle: "Time-bound items", collectionName: "reminders", icon: (p) => <IconBell {...p} /> },
      { id: "routines", label: "Routines", subtitle: "Recurring habits", collectionName: "routines", icon: (p) => <IconRepeat {...p} /> },
      { id: "goals", label: "Goals & targets", subtitle: "Milestones & progress", collectionName: "goals", icon: (p) => <IconTarget {...p} /> },
      { id: "errands", label: "Location errands", subtitle: "Triggered by place", collectionName: "errands", icon: (p) => <IconMapPin {...p} /> },
    ],
  },
  {
    id: "money",
    name: "Money & things",
    badge: "02",
    icon: (p) => <IconCoin {...p} />,
    items: [
      { id: "shopping", label: "Shopping list", subtitle: "Things to buy", collectionName: "shopping", icon: (p) => <IconShoppingCart {...p} /> },
      { id: "stock", label: "Stock tracking", subtitle: "Running low on...", collectionName: "stock", icon: (p) => <IconPackage {...p} /> },
      { id: "borrowed", label: "Borrowed & lent", subtitle: "Who has your stuff", collectionName: "ledger", icon: (p) => <IconArrowsLeftRight {...p} /> },
      { id: "iou", label: "IOUs", subtitle: "Money owed", collectionName: "ledger", icon: (p) => <IconCoin {...p} /> },
    ],
  },
  {
    id: "thoughts",
    name: "Thoughts & knowledge",
    badge: "03",
    icon: (p) => <IconBrain {...p} />,
    items: [
      { id: "ideas", label: "Ideas", subtitle: "Fleeting thoughts", collectionName: "notes", typeFilter: "idea", icon: (p) => <IconBulb {...p} /> },
      { id: "links", label: "Reading list", subtitle: "Links & articles", collectionName: "links", icon: (p) => <IconLink {...p} /> },
      { id: "questions", label: "Questions", subtitle: "Look up later", collectionName: "notes", typeFilter: "question", icon: (p) => <IconHelpCircle {...p} /> },
      { id: "journal", label: "Journal", subtitle: "Reflections", collectionName: "journal", icon: (p) => <IconBook {...p} /> },
      { id: "gratitude", label: "Gratitude", subtitle: "Daily log", collectionName: "gratitude", icon: (p) => <IconStar {...p} /> },
    ],
  },
  {
    id: "people",
    name: "People",
    badge: "04",
    icon: (p) => <IconUsers {...p} />,
    items: [
      { id: "people_notes", label: "People & contacts", subtitle: "Profiles, gifts, notes", collectionName: "people_notes", icon: (p) => <IconUsers {...p} /> },
      { id: "meeting_notes", label: "Meeting notes", subtitle: "Work/call context", collectionName: "people_notes", typeFilter: "meeting", icon: (p) => <IconFileText {...p} /> },
      { id: "followup", label: "Follow up", subtitle: "Stay in touch", collectionName: "people_notes", typeFilter: "followup", icon: (p) => <IconHeartHandshake {...p} /> },
    ],
  },
  {
    id: "leisure",
    name: "Life admin & leisure",
    badge: "05",
    icon: (p) => <IconPlane {...p} />,
    items: [
      { id: "travel", label: "Travel plans", subtitle: "Trip ideas & packing", collectionName: "travel", icon: (p) => <IconPlane {...p} /> },
      { id: "watchlist", label: "Watchlist", subtitle: "Movies, books, podcasts", collectionName: "wishlist", icon: (p) => <IconDeviceTv {...p} /> },
      { id: "personal_links", label: "Personal links", subtitle: "Reference bookmarks", collectionName: "links", typeFilter: "personal_ref", icon: (p) => <IconBookmark {...p} /> },
    ],
  },
  {
    id: "wellness",
    name: "Wellness & Security",
    badge: "06",
    icon: (p) => <IconHeartbeat {...p} />,
    items: [
      { id: "mood", label: "Mood tracker", subtitle: "Daily reflection & energy", collectionName: "moods", icon: (p) => <IconMoodSmile {...p} /> },
      { id: "health", label: "Health & cycle", subtitle: "Periods, flow & symptoms", collectionName: "health", icon: (p) => <IconHeartbeat {...p} /> },
      { id: "vault", label: "Private vault", subtitle: "PIN-encrypted secrets", collectionName: "vault", icon: (p) => <IconShieldLock {...p} /> },
    ],
  },
];

// Real-time telemetry stats per category (updates dynamically as you scroll through items)
const CATEGORY_STATS: Record<string, { stat: string; detail: string }> = {
  // Action
  todos:          { stat: "0 tasks pending",            detail: "Inbox clear" },
  reminders:      { stat: "0 alerts scheduled",         detail: "No upcoming alerts" },
  routines:       { stat: "0 active routines",          detail: "No routines set" },
  goals:          { stat: "0 active objectives",        detail: "Set your first objective" },
  errands:        { stat: "0 location triggers",        detail: "No errands saved" },
  // Money & things
  shopping:       { stat: "0 items on list",            detail: "Shopping list empty" },
  stock:          { stat: "All stocked",                detail: "No items running low" },
  borrowed:       { stat: "0 items lent",               detail: "Nothing lent or borrowed" },
  iou:            { stat: "$0.00 net balance",          detail: "All transactions settled" },
  // Thoughts & knowledge
  ideas:          { stat: "0 captured",                 detail: "Capture fleeting thoughts" },
  links:          { stat: "0 articles queued",          detail: "Reading list is empty" },
  questions:      { stat: "0 open inquiries",           detail: "No open questions" },
  journal:        { stat: "No entries yet",             detail: "Start writing anytime" },
  gratitude:      { stat: "0 reflections logged",       detail: "Log your first gratitude" },
  // People
  people_notes:   { stat: "0 contacts",                 detail: "No people logged" },
  meeting_notes:  { stat: "0 meeting syncs",            detail: "No meeting notes recorded" },
  followup:       { stat: "0 follow-ups due",           detail: "All caught up" },
  // Life admin & leisure
  travel:         { stat: "0 destinations saved",       detail: "No upcoming trips" },
  watchlist:      { stat: "0 items queued",             detail: "Watchlist is empty" },
  personal_links: { stat: "0 reference bookmarks",      detail: "No pinned links" },
  // Wellness & Security
  mood:           { stat: "Not logged today",           detail: "Check in with your mood" },
  health:         { stat: "0 health logs",              detail: "Cycle & symptom tracking" },
  vault:          { stat: "0 secrets protected",        detail: "AES encrypted · Master PIN locked" },
};

function findSectionAndItemIndex(targetId: string | null): { sectionIdx: number; itemIdx: number } | null {
  if (!targetId) return null;
  for (let sIdx = 0; sIdx < SECTIONS.length; sIdx++) {
    const itIdx = SECTIONS[sIdx].items.findIndex((it) => it.id === targetId);
    if (itIdx !== -1) {
      return { sectionIdx: sIdx, itemIdx: itIdx };
    }
  }
  return null;
}

function MenuContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryItem = searchParams.get("item");
  const { user } = useAuthContext();
  const { open: openCapture } = useCapture();

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 380, height: 640 });

  // Calculate initial section & item synchronously from query or sessionStorage
  const initialTarget = useMemo(() => {
    const target = queryItem || (typeof window !== "undefined" ? sessionStorage.getItem("lastMenuItem") : null);
    return findSectionAndItemIndex(target);
  }, [queryItem]);

  // Current active section (0..4) - initialized directly to targeted section
  const [sectionIndex, setSectionIndex] = useState(() => initialTarget?.sectionIdx ?? 0);

  // Current focused item index inside the active section - initialized directly to targeted item
  const [itemIndex, setItemIndex] = useState(() => initialTarget?.itemIdx ?? 0);

  // Smooth scroll offset (lerped towards scrollTarget each frame)
  const [scrollOffset, setScrollOffset] = useState(() => initialTarget?.itemIdx ?? 0);
  const scrollTarget = useRef(initialTarget?.itemIdx ?? 0);
  const animFrameId  = useRef<number | null>(null);

  // Switch section manually from UI controls
  const handleSwitchSection = (newIndex: number) => {
    setSectionIndex(newIndex);
    setItemIndex(0);
    scrollTarget.current = 0;
    setScrollOffset(0);
  };

  // Passive alerts
  const [hasStockAlert, setHasStockAlert] = useState(false);
  const [hasIouAlert, setHasIouAlert]     = useState(false);

  // Detail drawer
  const [selectedCategory, setSelectedCategory] = useState<MenuItem | null>(null);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 380,
          height: containerRef.current.clientHeight || 640,
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  // Sync when queryItem changes dynamically
  useEffect(() => {
    if (!queryItem) return;
    const found = findSectionAndItemIndex(queryItem);
    if (found) {
      setSectionIndex(found.sectionIdx);
      setItemIndex(found.itemIdx);
      scrollTarget.current = found.itemIdx;
      setScrollOffset(found.itemIdx);
    }
  }, [queryItem]);

  // Passive alert listeners on the local store
  useEffect(() => {
    if (!user) return;
    const qStock = query(collection(db, "users", user.uid, "stock"), where("threshold", "in", ["low", "out"]));
    const unsubStock = onSnapshot(qStock, (snap) => setHasStockAlert(!snap.empty));

    const qLedger = query(collection(db, "users", user.uid, "ledger"), where("settled", "==", false));
    const unsubLedger = onSnapshot(qLedger, (snap) => setHasIouAlert(!snap.empty));

    return () => {
      unsubStock();
      unsubLedger();
    };
  }, [user]);

  const activeSection = SECTIONS[sectionIndex];
  const items = activeSection.items;

  // Wave center vertical point
  const centerY = dimensions.height * 0.48;

  // Active focused item tracking (dynamically updates telemetry as user scrolls)
  const focusedIndex = Math.max(0, Math.min(items.length - 1, Math.round(scrollOffset)));
  const focusedItem = items[focusedIndex];
  const activeStat = focusedItem
    ? (CATEGORY_STATS[focusedItem.id] ?? { stat: focusedItem.label, detail: focusedItem.subtitle })
    : { stat: "", detail: "" };

  // Track focused item in sessionStorage for back navigation retention
  useEffect(() => {
    if (focusedItem && typeof window !== "undefined") {
      sessionStorage.setItem("lastMenuItem", focusedItem.id);
    }
  }, [focusedItem]);

  // Elastic bow spring physics simulation (tangible physical recoil & wobble)
  const springRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    isDragging: false,
    dragDy: 0,
  });
  const [elasticOffset, setElasticOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let lastTime = performance.now();
    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      // Smooth scroll target lerp
      setScrollOffset((prev) => {
        const diff = scrollTarget.current - prev;
        if (Math.abs(diff) < 0.001) return scrollTarget.current;
        return prev + diff * (1 - Math.exp(-14 * dt));
      });

      // Spring physics (damped harmonic oscillator for elastic bow tension)
      const s = springRef.current;
      if (s.isDragging) {
        // While dragging: pull the bow physically under your cursor/finger
        const targetY = s.dragDy * 0.45;
        const targetX = -Math.min(75, Math.abs(s.dragDy) * 0.4);
        s.x += (targetX - s.x) * (1 - Math.exp(-22 * dt));
        s.y += (targetY - s.y) * (1 - Math.exp(-22 * dt));
        s.vx = 0;
        s.vy = 0;
      } else {
        // Released / wheel: spring oscillates and snaps back to rest with palpable twang
        const k = 220; // spring stiffness
        const c = 18;  // damping coefficient
        const ax = -k * s.x - c * s.vx;
        const ay = -k * s.y - c * s.vy;
        s.vx += ax * dt;
        s.vy += ay * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        if (Math.abs(s.x) < 0.05 && Math.abs(s.vx) < 0.1) { s.x = 0; s.vx = 0; }
        if (Math.abs(s.y) < 0.05 && Math.abs(s.vy) < 0.1) { s.y = 0; s.vy = 0; }
      }
      setElasticOffset({ x: s.x, y: s.y });

      animFrameId.current = requestAnimationFrame(loop);
    };
    animFrameId.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, []);

  // Sync scrollTarget whenever itemIndex changes externally
  useEffect(() => {
    scrollTarget.current = itemIndex;
  }, [itemIndex]);

  // Dynamic quadratic bow geometry:
  // Mathematical guarantee: apex passes precisely through (baseApexX + elasticOffset.x, centerY + elasticOffset.y)
  const currentApexX = dimensions.width * 0.58 + elasticOffset.x;
  const currentApexY = centerY + elasticOffset.y;

  // Arc X for a given Y via binary search along the live quadratic bezier
  const getArcX = (targetY: number): number => {
    const { width, height } = dimensions;
    const r = width;
    const cx = 2 * (width * 0.58 + elasticOffset.x) - r;
    const cy = 2 * (centerY + elasticOffset.y - 0.25 * height);

    const bezierPt = (t: number) => {
      const mt = 1 - t;
      const x = mt * mt * r + 2 * mt * t * cx + t * t * r;
      const y = 2 * mt * t * cy + t * t * height;
      return { x, y };
    };

    let lo = 0, hi = 1;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (bezierPt(mid).y < targetY) lo = mid;
      else hi = mid;
    }
    return bezierPt((lo + hi) / 2).x;
  };

  // Live SVG bezier path that physically flexes and wobbles
  const wavePathD = useMemo(() => {
    const { width, height } = dimensions;
    if (!width || !height) return "";
    const r = width;
    const cx = 2 * (width * 0.58 + elasticOffset.x) - r;
    const cy = 2 * (centerY + elasticOffset.y - 0.25 * height);
    return `M ${r.toFixed(1)} 0 Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${r.toFixed(1)} ${height}`;
  }, [dimensions, centerY, elasticOffset]);

  // Pointer drag handling: unified mouse + touch drag
  const dragStartY = useRef(0);
  const dragStartX = useRef(0);
  const dragStartScroll = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    springRef.current.isDragging = true;
    springRef.current.dragDy = 0;
    dragStartY.current = e.clientY;
    dragStartX.current = e.clientX;
    dragStartScroll.current = scrollTarget.current;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!springRef.current.isDragging) return;
    const dy = e.clientY - dragStartY.current;
    springRef.current.dragDy = dy;

    const itemSpacing = 68;
    const newTarget = dragStartScroll.current - dy / itemSpacing;
    const clamped = Math.max(-0.4, Math.min(items.length - 1 + 0.4, newTarget));
    scrollTarget.current = clamped;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!springRef.current.isDragging) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const dy = e.clientY - dragStartY.current;
    const dx = e.clientX - dragStartX.current;

    springRef.current.isDragging = false;
    // Release kick: bowstring springs back with momentum!
    springRef.current.vy = -dy * 7;
    springRef.current.vx = Math.abs(dy) * 5;

    // Horizontal swipe switches section with loop
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) {
        handleSwitchSection((sectionIndex + 1) % SECTIONS.length);
      } else if (dx > 0) {
        handleSwitchSection((sectionIndex - 1 + SECTIONS.length) % SECTIONS.length);
      }
      return;
    }

    // Snap to nearest item (or loop section if dragged past boundaries)
    let nearest = Math.round(scrollTarget.current);
    if (nearest < 0) {
      handleSwitchSection((sectionIndex - 1 + SECTIONS.length) % SECTIONS.length);
      return;
    } else if (nearest > items.length - 1) {
      handleSwitchSection((sectionIndex + 1) % SECTIONS.length);
      return;
    }
    setItemIndex(nearest);
    scrollTarget.current = nearest;
  };

  // Wheel scrolling: plucks the bowstring with tactile recoil & loops sections
  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 1 : -1;
    // Pluck the bowstring!
    springRef.current.vy += delta * 150;
    springRef.current.vx -= 35;

    const newIdx = Math.round(scrollTarget.current + delta);
    if (newIdx >= 0 && newIdx < items.length) {
      setItemIndex(newIdx);
      scrollTarget.current = newIdx;
    } else if (newIdx >= items.length) {
      handleSwitchSection((sectionIndex + 1) % SECTIONS.length);
    } else if (newIdx < 0) {
      handleSwitchSection((sectionIndex - 1 + SECTIONS.length) % SECTIONS.length);
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      className="relative w-[calc(100%+2rem)] -mx-4 -mt-5 -mb-[calc(84px+env(safe-area-inset-bottom,0px))] h-[100dvh] min-h-[100dvh] select-none overflow-hidden touch-none cursor-grab active:cursor-grabbing"
      style={{
        background: "radial-gradient(circle at 40% 35%, #18120a 0%, #0d0a07 100%)",
      }}
    >
      {/* ── Futuristic Ambient Moving Glass Orange Lights ──────── */}
      <motion.div
        className="absolute pointer-events-none rounded-full blur-[80px] z-0"
        style={{
          width: 300,
          height: 300,
          background: "radial-gradient(circle, rgba(56,189,248, 0.22) 0%, rgba(14,165,233, 0.10) 60%, transparent 80%)",
        }}
        animate={{
          x: [20, 70, -20, 20],
          y: [centerY - 90, centerY + 30, centerY - 50, centerY - 90],
          scale: [1, 1.15, 0.95, 1],
        }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* ── Header: Title & Dynamic Telemetry ─────────────────── */}
      <div className="relative z-20 pt-6 px-6 max-w-[320px] pointer-events-none">
        <h1 className="text-[26px] font-medium text-white tracking-tight m-0 drop-shadow-sm">
          Core
        </h1>

        {/* Section & Telemetry HUD */}
        <div className="mt-2.5 flex flex-col gap-1">
          {/* Active Section Name (Heading) */}
          <div className="flex items-center gap-2.5">
            <h2 className="text-[20px] font-semibold uppercase tracking-tight text-sky-400 leading-none m-0 drop-shadow-[0_1px_8px_rgba(56,189,248,0.25)]">
              {activeSection.name}
            </h2>
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400/50 shrink-0" />
            <span className="text-[12px] font-mono text-white/40 tracking-wider shrink-0">
              {String(focusedIndex + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
            </span>
          </div>

          {/* Real-time Telemetry Stats per Item */}
          <div className="relative min-h-[46px] pt-0.5">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeSection.id}-${focusedItem?.id || "none"}`}
                initial={{ opacity: 0, y: 5, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -5, filter: "blur(3px)" }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="flex flex-col"
              >
                <span className="text-[15px] font-medium text-white/95 tracking-tight leading-snug">
                  {activeStat.stat}
                </span>
                <span className="text-[11.5px] font-normal text-white/45 tracking-tight mt-0.5 leading-snug">
                  {activeStat.detail}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Futuristic Cyber-Glass Laser Arc ────────────────────── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: "visible" }}>
        <defs>
          <filter id="neonBeamGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur1" />
            <feGaussianBlur stdDeviation="1.5" result="blur2" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Smooth Vertical Holographic Beam Gradient */}
          <linearGradient id="laserBeamGrad" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="rgba(56,189,248, 0.0)" />
            <stop offset="22%"  stopColor="rgba(56,189,248, 0.15)" />
            <stop offset="42%"  stopColor="rgba(125,211,252, 0.65)" />
            <stop offset="50%"  stopColor="#fde68a" />
            <stop offset="58%"  stopColor="rgba(125,211,252, 0.65)" />
            <stop offset="78%"  stopColor="rgba(56,189,248, 0.15)" />
            <stop offset="100%" stopColor="rgba(56,189,248, 0.0)" />
          </linearGradient>
        </defs>

        {/* Ambient Neon Diffusion Aura */}
        <path
          d={wavePathD}
          fill="none"
          stroke="url(#laserBeamGrad)"
          strokeWidth="3.5"
          opacity="0.35"
          filter="url(#neonBeamGlow)"
        />

        {/* Ultra-Crisp Laser Filament Core */}
        <path
          d={wavePathD}
          fill="none"
          stroke="url(#laserBeamGrad)"
          strokeWidth="1.25"
          opacity="0.9"
        />
      </svg>


      {/* ── Active Section Items Riding Along the Wave ──────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="absolute inset-0 z-10 pointer-events-none"
        >
          {items.map((it, idx) => {
            // Continuous fractional delta — scrollOffset lerps smoothly between integers
            const delta = idx - scrollOffset;
            const absDelta = Math.abs(delta);

            const itemSpacing = 68;
            const itemY = centerY + delta * itemSpacing;

            // Items ride the arc on the right — getArcX now closes over arcApexX
            const arcX = getArcX(itemY);

            // Focused item slides left to ~left edge; off-focus stays on the arc
            const focusWeight = Math.max(0, 1 - absDelta);
            const isFocused = absDelta < 0.45;
            const focusedX = 20;   // left dock for focused item
            const posX = arcX * (1 - focusWeight) + focusedX * focusWeight;

            const opacity = Math.max(0.18, 1 - absDelta * 0.30);
            const scale = 0.76 + focusWeight * 0.24;

            const commonProps = {
              onPointerDown: (e: React.PointerEvent) => {
                e.stopPropagation();
              },
              className: "absolute pointer-events-auto cursor-pointer flex items-center transition-opacity duration-75 select-none no-underline",
              style: {
                top: itemY - (isFocused ? 24 : 16),
                left: posX,
                transform: `scale(${scale})`,
                transformOrigin: "left center" as const,
                opacity,
                zIndex: Math.round(30 - absDelta * 5),
              },
            };

            const itemContent = isFocused ? (
              /* ── Focused: Glassmorphic Button + Outside Text ── */
              <div className="flex items-center gap-3.5">
                {/* Glass Icon Box (ONLY logo inside) */}
                <div
                  className="relative w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 overflow-hidden transition-all duration-300"
                  style={{
                    background: "linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(14,165,233, 0.34) 100%)",
                    backdropFilter: "blur(24px) saturate(2.0)",
                    WebkitBackdropFilter: "blur(24px) saturate(2.0)",
                    border: "1px solid rgba(56,189,248, 0.45)",
                    boxShadow: "0 0 24px rgba(14,165,233, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.4)",
                  }}
                >
                  {/* Animated Specular Light Sheen */}
                  <motion.div
                    className="absolute -inset-full bg-gradient-to-r from-transparent via-sky-300/30 to-transparent pointer-events-none"
                    style={{ transform: "rotate(35deg)" }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut", repeatDelay: 1.8 }}
                  />

                  <span className="relative z-10 text-white drop-shadow-[0_2px_10px_rgba(56,189,248,0.6)]">
                    {it.icon({ size: 22, stroke: 1.8, color: "#ffffff" })}
                  </span>
                </div>

                {/* Text Label OUTSIDE the button */}
                <div className="flex flex-col">
                  <span className="text-[19px] font-medium text-white tracking-tight leading-tight whitespace-nowrap drop-shadow-sm">
                    {it.label}
                  </span>
                  <span className="text-[11.5px] font-normal leading-none mt-1 whitespace-nowrap text-sky-400/90">
                    {it.subtitle}
                  </span>
                </div>
              </div>
            ) : (
              /* ── Unfocused Item Along the Wave Curve ── */
              <div className="flex items-center gap-2.5 py-1 whitespace-nowrap">
                <div
                  className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "0.5px solid rgba(56,189,248, 0.2)",
                  }}
                >
                  <span style={{ color: "rgba(56,189,248, 0.75)" }}>
                    {it.icon({ size: 16, stroke: 1.6, color: "rgba(56,189,248, 0.75)" })}
                  </span>
                </div>
                <span className="text-[14px] font-normal leading-none tracking-tight text-sky-200/80">
                  {it.label}
                </span>
              </div>
            );

            const ITEM_ROUTES: Record<string, string> = {
              // Action
              todos: "/menu/todos",
              reminders: "/menu/reminders",
              routines: "/menu/routines",
              goals: "/menu/goals",
              errands: "/menu/location-errands",
              // Money & things
              shopping: "/menu/shopping",
              stock: "/menu/stock",
              borrowed: "/menu/borrowed",
              iou: "/menu/ious",
              // Thoughts & knowledge
              ideas: "/menu/ideas",
              links: "/menu/reading-list",
              questions: "/menu/questions",
              journal: "/menu/journal",
              gratitude: "/menu/gratitude",
              // People
              people_notes: "/menu/people",
              meeting_notes: "/menu/meeting-notes",
              followup: "/menu/follow-up",
              // Life admin & leisure
              travel: "/menu/travel",
              watchlist: "/menu/watchlist",
              personal_links: "/menu/personal-links",
              // Wellness & Security
              mood: "/menu/mood",
              health: "/menu/health",
              vault: "/menu/vault",
            };
            const directRoute = ITEM_ROUTES[it.id];

            if (directRoute) {
              return (
                <Link
                  key={it.id}
                  href={directRoute}
                  {...commonProps}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof window !== "undefined") {
                      sessionStorage.setItem("lastMenuItem", it.id);
                    }
                  }}
                >
                  {itemContent}
                </Link>
              );
            }

            return (
              <div
                key={it.id}
                {...commonProps}
                onClick={(e) => {
                  e.stopPropagation();
                  setItemIndex(idx);
                  scrollTarget.current = idx;
                  setSelectedCategory(it);
                }}
              >
                {itemContent}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* ── Section Quick Pagination Navigation at Bottom ──────── */}
      <div
        className="absolute inset-x-6 z-20 flex items-center justify-between pointer-events-auto"
        style={{
          bottom: "calc(76px + env(safe-area-inset-bottom, 0px) + 14px)",
        }}
      >
        <button
          onClick={() => handleSwitchSection((sectionIndex - 1 + SECTIONS.length) % SECTIONS.length)}
          className="flex items-center gap-1 text-[12px] font-medium text-white/60 hover:text-white transition-colors focus:outline-none"
        >
          <IconChevronLeft size={16} />
          <span>{SECTIONS[(sectionIndex - 1 + SECTIONS.length) % SECTIONS.length].name}</span>
        </button>

        {/* Section Dots */}
        <div className="flex items-center gap-1.5">
          {SECTIONS.map((sec, i) => (
            <button
              key={sec.id}
              onClick={() => handleSwitchSection(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === sectionIndex ? "w-6 bg-sky-400 shadow-[0_0_8px_#38bdf8]" : "w-1.5 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => handleSwitchSection((sectionIndex + 1) % SECTIONS.length)}
          className="flex items-center gap-1 text-[12px] font-medium text-white/60 hover:text-white transition-colors focus:outline-none"
        >
          <span>{SECTIONS[(sectionIndex + 1) % SECTIONS.length].name}</span>
          <IconChevronRight size={16} />
        </button>
      </div>

      {/* ── Category Detail Sheet Drawer ────────────────────────── */}
      <AnimatePresence>
        {selectedCategory && (
          <CategoryDetailDrawer
            category={selectedCategory}
            onClose={() => setSelectedCategory(null)}
            onOpenCapture={openCapture}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Detail Drawer Component ───────────────────────────────────────────────────
interface CategoryDetailDrawerProps {
  category: MenuItem;
  onClose: () => void;
  onOpenCapture: () => void;
}

function CategoryDetailDrawer({
  category,
  onClose,
  onOpenCapture,
}: CategoryDetailDrawerProps) {
  const { user } = useAuthContext();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !category.collectionName) {
      setLoading(false);
      return;
    }

    const colRef = collection(db, "users", user.uid, category.collectionName);
    const unsub = onSnapshot(colRef, (snap) => {
      let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (category.typeFilter) {
        docs = docs.filter((d: any) => d.kind === category.typeFilter);
      }

      setItems(docs);
      setLoading(false);
    });

    return () => unsub();
  }, [user, category]);

  const handleToggleItem = async (item: any) => {
    if (!user || !category.collectionName) return;
    const docRef = doc(db, "users", user.uid, category.collectionName, item.id);

    if (category.collectionName === "todos" || category.collectionName === "reminders") {
      const isDone = item.status === "done";
      await updateDoc(docRef, {
        status: isDone ? "pending" : "done",
        completedAt: isDone ? null : serverTimestamp(),
      });
    } else if (category.collectionName === "shopping") {
      await updateDoc(docRef, { checked: !item.checked });
    } else if (category.collectionName === "ledger") {
      await updateDoc(docRef, { settled: !item.settled, settledAt: item.settled ? null : serverTimestamp() });
    } else if (category.collectionName === "links") {
      await updateDoc(docRef, { read: !item.read });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[82vh] flex flex-col rounded-t-[28px] overflow-hidden border-t"
        style={{
          background: "rgba(18, 14, 10, 0.88)",
          backdropFilter: "blur(32px) saturate(1.8)",
          WebkitBackdropFilter: "blur(32px) saturate(1.8)",
          borderColor: "rgba(56,189,248, 0.25)",
          boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: "rgba(56,189,248, 0.15)",
                border: "1px solid rgba(56,189,248, 0.35)",
                boxShadow: "0 0 12px rgba(56,189,248, 0.2)",
              }}
            >
              {category.icon && category.icon({ size: 20, stroke: 1.8, color: "#38bdf8" })}
            </div>
            <div>
              <h2 className="text-[17px] font-medium text-white tracking-tight m-0 leading-tight">
                {category.label}
              </h2>
              {category.subtitle && (
                <p className="text-[11.5px] text-[var(--text-muted)] m-0 leading-none mt-0.5">
                  {category.subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenCapture();
              }}
              className="p-1.5 rounded-full text-white/80 hover:text-white transition-colors"
              style={{ backgroundColor: "rgba(56,189,248, 0.2)" }}
              title="Add new"
            >
              <IconPlus size={18} stroke={2} style={{ color: "#38bdf8" }} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-white/50 hover:text-white transition-colors"
            >
              <IconX size={19} stroke={1.8} />
            </button>
          </div>
        </div>

        {/* Drawer Items List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-[13px] text-[var(--text-muted)]">
              Loading {category.label.toLowerCase()}...
            </div>
          ) : items.length === 0 ? (
            <div className="py-14 text-center flex flex-col items-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: "rgba(56,189,248, 0.14)" }}
              >
                {category.icon && category.icon({ size: 24, stroke: 1.5, color: "#38bdf8" })}
              </div>
              <p className="text-[14px] text-[var(--text-secondary)] font-medium m-0 mb-1">
                No items in {category.label}
              </p>
              <p className="text-[12px] text-[var(--text-muted)] m-0 max-w-[240px]">
                Capture a thought, task, or note to file it directly here.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenCapture();
                }}
                className="mt-4 px-4 py-2 rounded-full text-[13px] font-medium text-white transition-all active:scale-95 shadow-[0_0_16px_rgba(56,189,248,0.35)]"
                style={{ backgroundColor: "#0ea5e9" }}
              >
                Add {category.label}
              </button>
            </div>
          ) : (
            items.map((it) => {
              const isChecked =
                it.status === "done" || it.checked === true || it.settled === true || it.read === true;

              return (
                <div
                  key={it.id}
                  onClick={() => handleToggleItem(it)}
                  className="flex items-center justify-between p-3.5 rounded-[16px] cursor-pointer transition-all active:scale-[0.99]"
                  style={{
                    background: "rgba(255, 255, 255, 0.04)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    border: "0.5px solid rgba(255, 255, 255, 0.08)",
                    opacity: isChecked ? 0.45 : 1,
                  }}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p
                      className={`text-[13.5px] font-medium m-0 leading-snug truncate ${
                        isChecked ? "line-through text-white/40" : "text-white/90"
                      }`}
                    >
                      {it.title || it.name || it.content || it.destination || "Untitled"}
                    </p>
                    {it.notes && (
                      <p className="text-[11px] text-[var(--text-muted)] m-0 truncate mt-0.5">
                        {it.notes}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      border: isChecked ? "none" : "1.5px solid rgba(255, 255, 255, 0.2)",
                      backgroundColor: isChecked ? "#38bdf8" : "transparent",
                    }}
                  >
                    {isChecked && <IconCheck size={14} stroke={2.5} className="text-black font-bold" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={null}>
      <MenuContent />
    </Suspense>
  );
}
