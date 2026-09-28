"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

interface MobileNavState {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const MobileNavContext = createContext<MobileNavState | null>(null);

// Sidebar and Header are siblings under the shared app shell, both need to
// react to the same "is the mobile drawer open" flag - a tiny context is
// simpler and more robust here than a CSS-only checkbox hack across two
// components that don't share a direct DOM ancestor path.
export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer automatically on navigation, so tapping a link doesn't
  // leave the overlay sitting open over the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <MobileNavContext.Provider value={{ open, toggle: () => setOpen((o) => !o), close: () => setOpen(false) }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useMobileNav must be used within a MobileNavProvider");
  return ctx;
}
