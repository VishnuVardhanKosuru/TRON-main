"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import CaptureSheet from "./CaptureSheet";

interface CaptureContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const CaptureContext = createContext<CaptureContextType | undefined>(undefined);

export function CaptureProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <CaptureContext.Provider value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}>
      {children}
      <CaptureSheet isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </CaptureContext.Provider>
  );
}

export function useCapture() {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error("useCapture must be used within CaptureProvider");
  return ctx;
}
