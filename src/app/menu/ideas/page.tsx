"use client";

import { useEffect, useState } from "react";
import SimpleFeed, { FeedItem } from "@/components/SimpleFeed";
import { useAuthContext } from "@/context/AuthContext";
import { collection, query, where, onSnapshot } from "@/lib/tron/firestore";
import { db } from "@/lib/local-db";

export default function IdeasPage() {
  const { user } = useAuthContext();
  const [ideas, setIdeas] = useState<FeedItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "notes"), where("kind", "==", "idea"));
    const unsub = onSnapshot(q, (snap) => {
      const loaded: FeedItem[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          text: data.content || "",
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });
      // Sort newest first
      loaded.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setIdeas(loaded);
    });
    return () => unsub();
  }, [user]);

  return (
    <SimpleFeed
      title="Ideas"
      nounSingular="idea"
      nounPlural="ideas"
      initialItems={ideas}
      showDomain={false}
      emptyMessage="No ideas captured yet. Use the capture bar to record fleeting thoughts."
      backHref="/menu?item=ideas"
    />
  );
}
