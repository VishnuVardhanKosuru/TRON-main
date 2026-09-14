"use client";

import SimpleFeed, { FeedItem } from "@/components/SimpleFeed";

const initialQuestions: FeedItem[] = [];

export default function QuestionsPage() {
  return (
    <SimpleFeed
      title="Questions"
      nounSingular="inquiry"
      nounPlural="questions"
      initialItems={initialQuestions}
      showDomain={false}
      emptyMessage="No questions captured yet. Entering text ending in '?' routes it here automatically."
      backHref="/menu?item=questions"
    />
  );
}
