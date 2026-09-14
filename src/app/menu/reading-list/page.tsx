"use client";

import SimpleFeed, { FeedItem } from "@/components/SimpleFeed";

const initialReadingList: FeedItem[] = [];

export default function ReadingListPage() {
  return (
    <SimpleFeed
      title="Reading list"
      nounSingular="link"
      nounPlural="links"
      initialItems={initialReadingList}
      showDomain={true}
      emptyMessage="No links saved yet. Pasting any URL into the capture bar saves it here."
      backHref="/menu?item=links"
    />
  );
}
