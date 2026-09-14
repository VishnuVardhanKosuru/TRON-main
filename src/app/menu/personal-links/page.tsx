"use client";

import SimpleFeed, { FeedItem } from "@/components/SimpleFeed";

const initialPersonalLinks: FeedItem[] = [];

export default function PersonalLinksPage() {
  return (
    <SimpleFeed
      title="Personal reference links"
      nounSingular="link"
      nounPlural="links"
      initialItems={initialPersonalLinks}
      showDomain={true}
      emptyMessage="No reference links pinned yet. Open any link note and tap 'Mark as ref' to pin it here."
      backHref="/menu?item=personal_links"
    />
  );
}
