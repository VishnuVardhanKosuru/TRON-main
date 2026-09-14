"use client";

import DirectionalLedger, { LedgerItem } from "@/components/DirectionalLedger";

const initialIouItems: LedgerItem[] = [];

export default function IousPage() {
  return (
    <DirectionalLedger
      title="IOUs"
      outgoingTitle="You're owed"
      incomingTitle="You owe"
      resolvedTitle="Settled"
      resolveVerb="Settled"
      mode="ious"
      initialItems={initialIouItems}
    />
  );
}
