"use client";

import TimelineDiary, { DiaryEntry } from "@/components/TimelineDiary";

const initialJournalEntries: DiaryEntry[] = [];

export default function JournalPage() {
  return (
    <TimelineDiary
      title="Journal"
      tag="journal"
      composerPlaceholder="Write what's on your mind."
      initialEntries={initialJournalEntries}
    />
  );
}
