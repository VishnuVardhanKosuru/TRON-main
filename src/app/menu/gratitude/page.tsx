"use client";

import TimelineDiary, { DiaryEntry } from "@/components/TimelineDiary";

const initialGratitudeEntries: DiaryEntry[] = [];

export default function GratitudePage() {
  return (
    <TimelineDiary
      title="Gratitude"
      tag="gratitude"
      composerPlaceholder="What are you grateful for today."
      initialEntries={initialGratitudeEntries}
    />
  );
}
