"use client";

import SimpleFeed, { FeedItem } from "@/components/SimpleFeed";

const initialWatchlist: FeedItem[] = [];

export default function WatchlistPage() {
  return (
    <SimpleFeed
      title="Watchlist"
      nounSingular="item"
      nounPlural="items"
      initialItems={initialWatchlist}
      showDomain={false}
      emptyMessage="No watchlist items saved yet. Movies, books, and podcast recommendations captured anywhere appear here."
      backHref="/menu?item=watchlist"
    />
  );
}
