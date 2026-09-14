"use client";

import SimpleFeed, { FeedItem } from "@/components/SimpleFeed";

const initialMeetingNotes: FeedItem[] = [];

export default function MeetingNotesPage() {
  return (
    <SimpleFeed
      title="Meeting notes"
      nounSingular="note"
      nounPlural="notes"
      initialItems={initialMeetingNotes}
      showDomain={false}
      emptyMessage="No meeting notes captured yet. Mentions of [[Name]] are indexed automatically."
      backHref="/menu?item=meeting_notes"
    />
  );
}
