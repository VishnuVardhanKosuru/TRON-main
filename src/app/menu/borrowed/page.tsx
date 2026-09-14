"use client";

import DirectionalLedger, { LedgerItem } from "@/components/DirectionalLedger";

const initialBorrowedItems: LedgerItem[] = [];

export default function BorrowedPage() {
  return (
    <DirectionalLedger
      title="Borrowed and lent"
      outgoingTitle="You lent"
      incomingTitle="You borrowed"
      resolvedTitle="Returned"
      resolveVerb="Returned"
      mode="borrowed"
      initialItems={initialBorrowedItems}
    />
  );
}
