"use client";

import { useEffect, useState } from "react";
import SimpleFeed, { FeedItem } from "@/components/SimpleFeed";
import { useAuthContext } from "@/context/AuthContext";
import { collection, query, onSnapshot } from "@/lib/tron/firestore";
import { db } from "@/lib/local-db";

export default function TravelPlansPage() {
  const { user } = useAuthContext();
  const [plans, setPlans] = useState<FeedItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "travel"));
    const unsub = onSnapshot(q, (snap) => {
      const loaded: FeedItem[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          text: data.destination || data.content || "Trip",
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });
      loaded.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setPlans(loaded);
    });
    return () => unsub();
  }, [user]);

  return (
    <SimpleFeed
      title="Travel plans"
      nounSingular="plan"
      nounPlural="plans"
      initialItems={plans}
      showDomain={false}
      emptyMessage="No travel plans captured yet. Trip notes connect automatically via [[Trip Name]]."
      backHref="/menu?item=travel"
    />
  );
}
