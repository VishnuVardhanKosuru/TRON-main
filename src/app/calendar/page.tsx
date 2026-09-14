"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  startOfDay,
  isToday,
  isBefore,
  isSameDay,
  isSameWeek,
} from "date-fns";
import {
  IconRepeat,
  IconBell,
  IconChevronLeft,
  IconChevronRight,
  IconArrowsMaximize,
  IconArrowsMinimize,
} from "@tabler/icons-react";
import { useAuthContext } from "@/context/AuthContext";
import { Timestamp, collection, query, where, onSnapshot } from "@/lib/tron/firestore";
import { db } from "@/lib/local-db";

// ── Types ──────────────────────────────────────────────────────────────────────
type EventType = "routine" | "work" | "social" | "health" | "learning" | "errand";

interface CalEvent {
  id: string;
  title: string;
  startHour: number; // e.g. 20 = 8:00 PM, 20.5 = 8:30 PM
  durationH: number; // in hours, 0.5 = 30 min
  type: EventType;
  subtitle?: string;
  isBuffer?: boolean;
  icon?: React.ReactNode;
  isPast?: boolean;
}

// ── Flexible Hour Layout Computation ──────────────────────────────────────────
const DEFAULT_BASE_H  = 64;
const SPACIOUS_BASE_H = 100;
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0 to 23

// Left-rail widths
const LEFT_PAD  = 16;
const LABEL_W   = 46;
const WIRE_X    = LEFT_PAD + LABEL_W;       // 62px
const EVENT_X   = WIRE_X + 12;             // 74px
const RIGHT_PAD = 16;

// ── Per-type colours — warm amber-forward palette ─────────────────────────────
const TYPE_STYLE: Record<EventType, { bg: string; border: string; icon: string }> = {
  routine:  { bg: "rgba(28,20,10,0.94)",  border: "rgba(14,165,233,0.75)",   icon: "#0ea5e9" },  // amber
  work:     { bg: "rgba(30,22,10,0.94)",  border: "rgba(194,148,56,0.70)",  icon: "#c29438" },  // golden amber
  social:   { bg: "rgba(32,16,12,0.94)",  border: "rgba(185,80,45,0.70)",   icon: "#b95030" },  // terracotta
  health:   { bg: "rgba(26,22,10,0.94)",  border: "rgba(162,142,52,0.65)",  icon: "#a28e34" },  // warm olive-gold
  learning: { bg: "rgba(28,24,10,0.94)",  border: "rgba(205,172,60,0.65)",  icon: "#cdac3c" },  // warm gold
  errand:   { bg: "rgba(30,18,8,0.94)",   border: "rgba(210,108,38,0.70)",  icon: "#d26c26" },  // burnt orange
};

function fmtHour(h: number) {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  const ampm = h < 12 ? "AM" : "PM";
  const h12  = h > 12 ? h - 12 : h;
  return `${h12} ${ampm}`;
}

function fmtTime(decimalHour: number): string {
  const totalMin = Math.round(decimalHour * 60);
  let h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const h12  = h % 12 === 0 ? 12 : h % 12;
  const mStr = `:${String(m).padStart(2, "0")}`;
  return `${h12}${mStr} ${ampm}`;
}

function computeHourLayout(
  events: CalEvent[],
  baseH: number,
  expandedHours: Set<number>
) {
  const hourHeights = new Array(24).fill(baseH);

  for (let h = 0; h < 24; h++) {
    if (expandedHours.has(h)) {
      hourHeights[h] = Math.max(baseH * 2.2, 180);
      continue;
    }

    const evs = events.filter((e) => Math.floor(e.startHour) === h);
    if (evs.length === 0) {
      hourHeights[h] = baseH;
    } else if (evs.length === 1) {
      const frac = evs[0].startHour - h;
      if (frac >= 0.65) {
        hourHeights[h] = Math.max(baseH, 130);
      } else {
        hourHeights[h] = Math.max(baseH, 84);
      }
    } else if (evs.length === 2) {
      hourHeights[h] = Math.max(baseH * 1.6, 130);
    } else {
      // 3 or more events: dynamically ensure room for all events without overlapping into next hour
      hourHeights[h] = Math.max(baseH * 2.3, evs.length * 52 + 24);
    }
  }

  const hourTops = new Array(24).fill(0);
  let currentTop = 0;
  for (let h = 0; h < 24; h++) {
    hourTops[h] = currentTop;
    currentTop += hourHeights[h];
  }

  const totalHeight = currentTop + 60;
  return { hourHeights, hourTops, totalHeight };
}

// ── Overlap Resolution with Pixel Positions ───────────────────────────────────
interface PositionedEvent extends CalEvent {
  topPx: number;
  heightPx: number;
  colIndex: number;
  totalCols: number;
}

function layoutEvents(
  events: CalEvent[],
  hourHeights: number[],
  hourTops: number[]
): PositionedEvent[] {
  if (events.length === 0) return [];

  // Compute topPx and heightPx for each event
  const withPixels = events.map((ev) => {
    const h = Math.min(23, Math.max(0, Math.floor(ev.startHour)));
    const frac = ev.startHour - h;
    const topPx = hourTops[h] + frac * hourHeights[h];
    const heightPx = 38;
    return {
      ...ev,
      topPx,
      heightPx,
    };
  });

  // Sort by topPx ascending
  const sorted = [...withPixels].sort((a, b) => a.topPx - b.topPx);

  // Group events that overlap in vertical pixel space
  const clusters: (typeof withPixels)[] = [];
  let currentCluster: typeof withPixels = [];
  let clusterEnd = -1;

  for (const ev of sorted) {
    const evEnd = ev.topPx + ev.heightPx;
    if (currentCluster.length === 0) {
      currentCluster.push(ev);
      clusterEnd = evEnd;
    } else if (ev.topPx < clusterEnd - 2) {
      currentCluster.push(ev);
      clusterEnd = Math.max(clusterEnd, evEnd);
    } else {
      clusters.push(currentCluster);
      currentCluster = [ev];
      clusterEnd = evEnd;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const result: PositionedEvent[] = [];

  for (const cluster of clusters) {
    const colEnds: number[] = [];
    const assignments: { ev: (typeof withPixels)[0]; colIndex: number }[] = [];

    for (const ev of cluster) {
      let assignedCol = -1;
      for (let i = 0; i < colEnds.length; i++) {
        if (colEnds[i] <= ev.topPx + 2) {
          assignedCol = i;
          colEnds[i] = ev.topPx + ev.heightPx;
          break;
        }
      }
      if (assignedCol === -1) {
        assignedCol = colEnds.length;
        colEnds.push(ev.topPx + ev.heightPx);
      }
      assignments.push({ ev, colIndex: assignedCol });
    }

    const totalCols = Math.max(1, colEnds.length);
    for (const { ev, colIndex } of assignments) {
      result.push({
        ...ev,
        colIndex,
        totalCols,
      });
    }
  }

  return result;
}

export default function CalendarPage() {
  const { user } = useAuthContext();
  const today = useRef(new Date()).current;
  const startOfToday = startOfDay(today);

  // Rolling window logic: Default view window is today ± 7 days
  const [loadedStart, setLoadedStart] = useState(() => addDays(startOfToday, -7));
  const [loadedEnd, setLoadedEnd]     = useState(() => addDays(startOfToday, 14)); // +14 to cover next week fully

  // Week navigation (Starts on Monday)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const [selected, setSelected] = useState(today);
  const [mounted,  setMounted]  = useState(false);
  const [nowPx,    setNowPx]    = useState<number | null>(null);

  // Flexible expandable hour states
  const [isSpacious, setIsSpacious] = useState(false);
  const [expandedHours, setExpandedHours] = useState<Set<number>>(new Set());

  const toggleHourExpand = (h: number) => {
    setExpandedHours((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      return next;
    });
  };

  // Raw data from the local store
  const [rawRoutines, setRawRoutines]   = useState<any[]>([]);
  const [rawReminders, setRawReminders] = useState<any[]>([]);
  const [rawGoals, setRawGoals]         = useState<any[]>([]);
  const [rawFollowups, setRawFollowups] = useState<any[]>([]);
  const [rawTravel, setRawTravel]       = useState<any[]>([]);

  // Computed events for the selected day
  const [events, setEvents] = useState<CalEvent[]>([]);

  // Compute dynamic content-aware hour heights and offsets
  const baseH = isSpacious ? SPACIOUS_BASE_H : DEFAULT_BASE_H;
  const { hourHeights, hourTops, totalHeight } = useMemo(() => {
    return computeHourLayout(events, baseH, expandedHours);
  }, [events, baseH, expandedHours]);

  // 7 days of the currently viewed week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const handlePrevWeek = () => {
    const newWeek = subWeeks(currentWeekStart, 1);
    if (isBefore(newWeek, loadedStart)) {
      setLoadedStart(subDays(loadedStart, 7));
    }
    setCurrentWeekStart(newWeek);
    setSelected(newWeek);
  };

  const handleNextWeek = () => {
    const newWeek = addWeeks(currentWeekStart, 1);
    const newWeekEnd = addDays(newWeek, 7);
    if (isBefore(loadedEnd, newWeekEnd)) {
      setLoadedEnd(addDays(loadedEnd, 7));
    }
    setCurrentWeekStart(newWeek);
    setSelected(newWeek);
  };

  const scrollRef = useRef<HTMLDivElement>(null);

  // Current-time indicator + auto-scroll to current hour
  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();
      const hrs = now.getHours() + now.getMinutes() / 60;
      const curH = Math.min(23, Math.max(0, Math.floor(hrs)));
      const frac = hrs - curH;
      if (hourTops[curH] !== undefined && hourHeights[curH] !== undefined) {
        setNowPx(hourTops[curH] + frac * hourHeights[curH]);
      }
    };
    updateTime();
    const id = setInterval(updateTime, 60_000);

    // Smooth scroll down near the current time on mount
    const now = new Date();
    const curH = now.getHours();
    const targetY = Math.max(0, (hourTops[curH] || curH * 64) - 40);
    
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: targetY, behavior: "smooth" });
      } else {
        window.scrollTo({ top: targetY, behavior: "smooth" });
      }
    }, 100);

    return () => clearInterval(id);
  }, [hourTops, hourHeights]);

  // ── Live Subscription (Rolling Window) ──────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setRawRoutines([]);
      setRawReminders([]);
      setRawGoals([]);
      setRawFollowups([]);
      setRawTravel([]);
      return;
    }

    // 1. Routines (Fetch all active/archived to compute past completions)
    const qRoutines = query(collection(db, "users", user.uid, "routines"));
    const unsubRoutines = onSnapshot(qRoutines, (snap) => {
      setRawRoutines(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Reminders (Lazy loaded within window)
    const qReminders = query(
      collection(db, "users", user.uid, "reminders"),
      where("scheduledAt", ">=", Timestamp.fromDate(loadedStart)),
      where("scheduledAt", "<=", Timestamp.fromDate(loadedEnd))
    );
    const unsubReminders = onSnapshot(qReminders, (snap) => {
      setRawReminders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Goals (Active only)
    const qGoals = query(collection(db, "users", user.uid, "goals"), where("status", "==", "active"));
    const unsubGoals = onSnapshot(qGoals, (snap) => {
      setRawGoals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 4. Follow-ups (Pending only)
    const qFollowups = query(
      collection(db, "users", user.uid, "people_notes"), 
      where("kind", "==", "followup"),
      where("followupDone", "==", false)
    );
    const unsubFollowups = onSnapshot(qFollowups, (snap) => {
      setRawFollowups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 5. Travel (All relevant active trips)
    const qTravel = query(collection(db, "users", user.uid, "travel"), where("status", "!=", "done"));
    const unsubTravel = onSnapshot(qTravel, (snap) => {
      setRawTravel(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubRoutines();
      unsubReminders();
      unsubGoals();
      unsubFollowups();
      unsubTravel();
    };
  }, [user, loadedStart, loadedEnd]);

  // ── Compute Daily Events ────────────────────────────────────────────────────
  useEffect(() => {
    const list: CalEvent[] = [];
    const isPastDay = isBefore(selected, startOfToday);
    const selectedDateStr = format(selected, "yyyy-MM-dd");

    // Process Routines
    rawRoutines.forEach((r) => {
      // Past routines only show if they were completed that day
      const isCompleted = r.completionLog && r.completionLog[selectedDateStr];
      if (isPastDay && !isCompleted) return; 

      // Hide archived routines on future/today days
      if (!isPastDay && r.status === "archived") return;

      let timeStr = r.schedule?.time || "09:00";
      // Only check title regex if time was not already parsed or was default 09:00
      if (!r.schedule?.time || r.schedule.time === "09:00") {
        const titleMatch = (r.title || "").match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
        if (titleMatch) {
          let h = parseInt(titleMatch[1], 10);
          const m = titleMatch[2] ? parseInt(titleMatch[2], 10) : 0;
          const period = titleMatch[3].toLowerCase();
          if (period === "pm" && h < 12) h += 12;
          if (period === "am" && h === 12) h = 0;
          timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        }
      }

      const [hh, mm] = timeStr.split(":").map(Number);
      const startHour = hh + (mm || 0) / 60;
      if (isNaN(startHour)) return;

      // Format clean title without repetitive schedule text
      let cleanTitle = r.title || "Daily routine";
      cleanTitle = cleanTitle
        .replace(/\b(every\s+day|daily|every\s+morning|every\s+night)\s*/gi, "")
        .replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, "")
        .trim();
      cleanTitle = cleanTitle ? cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1) : (r.title || "Daily routine");

      list.push({
        id: r.id,
        title: cleanTitle,
        startHour,
        durationH: 0.5,
        type: "routine",
        subtitle: `Daily · ${fmtTime(startHour)}`,
        icon: <IconRepeat size={13} stroke={1.5} />,
        isPast: isPastDay,
      });
    });

    // Process Reminders
    rawReminders.forEach((rm) => {
      if (!rm.scheduledAt?.toDate) return;
      const dt = rm.scheduledAt.toDate();
      if (!isSameDay(dt, selected)) return;

      // Past reminders only show if they were completed/archived
      const isCompleted = rm.status === "done" || rm.status === "archived";
      if (isPastDay && !isCompleted) return;

      const startHour = dt.getHours() + dt.getMinutes() / 60;
      
      let cleanTitle = rm.title || "Reminder";
      cleanTitle = cleanTitle
        .replace(/\b(remind\s+me\s+to|remind\s+me|reminder:)\s*/gi, "")
        .replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, "")
        .trim();
      cleanTitle = cleanTitle ? cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1) : (rm.title || "Reminder");

      list.push({
        id: rm.id,
        title: cleanTitle,
        startHour,
        durationH: 0.5,
        type: "errand",
        subtitle: `Alert · ${fmtTime(startHour)}`,
        icon: <IconBell size={13} stroke={1.5} />,
        isPast: isPastDay,
      });
    });

    // Process Goals
    rawGoals.forEach((g) => {
      if (!g.targetDate?.toDate) return;
      const dt = g.targetDate.toDate();
      if (!isSameDay(dt, selected)) return;
      
      list.push({
        id: g.id,
        title: g.title || "Goal Milestone",
        startHour: 8, // Morning milestone
        durationH: 1,
        type: "work",
        subtitle: "Goal Target Date",
        icon: <IconBell size={13} stroke={1.5} />,
        isPast: isPastDay,
      });
    });

    // Process Follow-ups
    rawFollowups.forEach((f) => {
      if (!f.followupDate?.toDate && !f.date) return;
      
      let isTodayFollowup = false;
      if (f.followupDate?.toDate) {
        isTodayFollowup = isSameDay(f.followupDate.toDate(), selected);
      } else if (f.date) {
        // Fallback to YYYY-MM-DD
        isTodayFollowup = (f.date === selectedDateStr);
      }

      if (!isTodayFollowup) return;

      list.push({
        id: f.id,
        title: `Follow up: ${f.personName || 'Unknown'}`,
        startHour: 9, // Morning follow-up block
        durationH: 1,
        type: "social",
        subtitle: f.content || "Pending follow-up",
        icon: <IconBell size={13} stroke={1.5} />,
        isPast: isPastDay,
      });
    });

    // Process Travel
    rawTravel.forEach((t) => {
      if (!t.startDate) return;
      const startDt = new Date(t.startDate);
      const endDt = t.endDate ? new Date(t.endDate) : startDt;
      
      // Check if selected day falls inside travel window
      startDt.setHours(0,0,0,0);
      endDt.setHours(23,59,59,999);
      if (selected < startDt || selected > endDt) return;

      list.push({
        id: t.id,
        title: t.destination || "Trip",
        startHour: 10,
        durationH: 2,
        type: "errand",
        subtitle: t.status === "planning" ? "Planning Trip" : "Travel dates",
        icon: <IconBell size={13} stroke={1.5} />,
        isPast: isPastDay,
      });
    });

    setEvents(list);
  }, [selected, rawRoutines, rawReminders, rawGoals, rawFollowups, rawTravel]);

  if (!mounted) return null;

  return (
    <div className="flex flex-col -mx-4 -mt-5 h-[calc(100dvh-70px)]">

      {/* ── Fixed Header: Navigation & Dates ──────────────────── */}
      <div
        className="shrink-0 z-40 px-4 pt-4 pb-3"
        style={{
          background: "rgba(12, 10, 8, 1)",
          borderBottom: "0.5px solid rgba(255,255,255,0.08)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}
      >
        {/* Month, Year & < > Nav Controls */}
        <div className="flex items-center justify-between mb-3 px-0.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[17px] font-semibold text-[var(--text-primary)] tracking-wide">
              {format(selected, "MMMM")}
            </span>
            <span className="text-[13px] text-[var(--text-muted)] font-medium">
              {format(selected, "yyyy")}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsSpacious((s) => !s)}
              className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-white transition-all focus:outline-none"
              title={isSpacious ? "Switch to compact view" : "Expand timeline height"}
            >
              {isSpacious ? (
                <IconArrowsMinimize size={18} stroke={1.8} />
              ) : (
                <IconArrowsMaximize size={18} stroke={1.8} />
              )}
            </button>
            <button
              onClick={handlePrevWeek}
              className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-white transition-all focus:outline-none"
              title="Previous week"
            >
              <IconChevronLeft size={19} stroke={2} />
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-white transition-all focus:outline-none"
              title="Next week"
            >
              <IconChevronRight size={19} stroke={2} />
            </button>
          </div>
        </div>

        {/* 7-Day Week Strip */}
        <div className="flex justify-between gap-1">
          {weekDays.map((d) => {
            const isSel    = isSameDay(d, selected);
            const isToday_ = isToday(d);
            const isPast   = isBefore(d, startOfToday);

            return (
              <button
                key={d.toISOString()}
                onClick={() => {
                  if (!isPast) setSelected(d);
                }}
                disabled={isPast}
                className="flex flex-col items-center gap-1 flex-1 py-2 rounded-[14px] relative focus:outline-none transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: isSel ? "rgba(14,165,233,0.24)" : "transparent",
                  border: isSel ? "0.5px solid rgba(56,189,248,0.5)" : "0.5px solid transparent",
                }}
              >
                <span className={`text-[10px] font-medium tracking-wider uppercase leading-none ${
                  isSel ? "text-[var(--text-accent)]" : "text-[var(--text-muted)]"
                }`}>
                  {format(d, "EEE")[0]}
                </span>
                <span className={`text-[18px] leading-tight font-${isSel ? "semibold" : "normal"} ${
                  isSel
                    ? "text-[var(--text-accent)]"
                    : isToday_
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)]"
                }`}>
                  {format(d, "d")}
                </span>

                {/* Today dot indicator */}
                <span
                  className="w-1.5 h-1.5 rounded-full transition-all"
                  style={{
                    background: isToday_ && !isSel ? "var(--fill-accent)" : "transparent",
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 24-Hour Scrollable Timeline ────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <div className="relative" style={{ height: totalHeight }}>

          {/* Continuous Amber Glow Wire */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: WIRE_X,
              width: 2,
              background: "linear-gradient(to bottom, transparent 0%, rgba(14,165,233,0.6) 2%, rgba(56,189,248,0.45) 50%, rgba(14,165,233,0.6) 98%, transparent 100%)",
              boxShadow: "0 0 8px 3px rgba(14,165,233,0.2)",
            }}
          />

          {/* 24-Hour Grid Rules & Time Labels (Flexible dynamic heights) */}
          {HOURS.map((h) => {
            const isExpanded = expandedHours.has(h);
            const evCount = events.filter((e) => Math.floor(e.startHour) === h).length;

            return (
              <div
                key={h}
                className="absolute flex items-start"
                style={{ top: hourTops[h], left: LEFT_PAD, right: RIGHT_PAD }}
              >
                {/* Time label - click to expand/collapse this specific hour */}
                <button
                  type="button"
                  onClick={() => toggleHourExpand(h)}
                  className="shrink-0 flex items-center justify-end pr-3 cursor-pointer group focus:outline-none"
                  style={{ width: LABEL_W }}
                  title={isExpanded ? "Collapse this hour" : "Click to expand this hour"}
                >
                  <span className={`text-[10.5px] leading-none -translate-y-2 select-none font-mono transition-colors ${
                    isExpanded ? "text-sky-400 font-bold" : "text-[var(--text-muted)] group-hover:text-sky-400"
                  }`}>
                    {fmtHour(h)}
                  </span>
                  {evCount > 1 && !isExpanded && (
                    <span className="w-1 h-1 rounded-full bg-sky-500 ml-1 -translate-y-2" />
                  )}
                </button>
                {/* Horizontal rule across timeline */}
                <div
                  className="flex-1 h-px pointer-events-none"
                  style={{ background: "rgba(255,255,255,0.06)", marginLeft: 8 }}
                />
              </div>
            );
          })}

          {/* Live Red Current-Time Indicator (Only on today) */}
          {nowPx !== null && isToday(selected) && (
            <div
              className="absolute flex items-center z-20 pointer-events-none"
              style={{ top: nowPx, left: WIRE_X - 3, right: RIGHT_PAD }}
            >
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" style={{ boxShadow: "0 0 8px 3px rgba(239,68,68,0.7)" }} />
              <div className="flex-1 h-px bg-red-500" style={{ opacity: 0.7 }} />
            </div>
          )}

          {/* Real Event & Routine Blocks */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: EVENT_X, right: RIGHT_PAD }}
          >
            {layoutEvents(events, hourHeights, hourTops).map((ev) => {
              const top    = ev.topPx;
              const height = ev.heightPx;
              const s      = TYPE_STYLE[ev.type] || TYPE_STYLE.routine;

              const widthPercent = 100 / ev.totalCols;
              const leftPercent  = ev.colIndex * widthPercent;
              const gap = ev.totalCols > 1 ? 6 : 0;

              return (
                <div
                  key={ev.id}
                  className="absolute rounded-[12px] cursor-pointer overflow-hidden transition-all pointer-events-auto active:scale-[0.98]"
                  style={{
                    top,
                    height,
                    left: `calc(${leftPercent}% + ${ev.colIndex > 0 ? gap / 2 : 0}px)`,
                    width: `calc(${widthPercent}% - ${gap}px)`,
                    background: s.bg,
                    border: "0.5px solid rgba(255,255,255,0.08)",
                    borderLeft: `3px solid ${s.border}`,
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                    opacity: ev.isPast ? 0.45 : 1, // Dimmed if past
                    filter: ev.isPast ? "grayscale(80%)" : "none", // Muted colors if past
                  }}
                >
                  <div className="relative flex items-center justify-between h-full px-2.5 py-1">
                    <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                      <span className="text-[12px] font-medium leading-tight truncate text-[var(--text-primary)]">
                        {ev.title}
                      </span>
                      {ev.subtitle && (
                        <span className="text-[10px] text-[var(--text-muted)] leading-tight truncate mt-0.5">
                          {ev.subtitle}
                        </span>
                      )}
                    </div>
                    {ev.icon && (
                      <div className="shrink-0 ml-1.5" style={{ color: s.icon, opacity: ev.isPast ? 0.6 : 0.9 }}>
                        {ev.icon}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
