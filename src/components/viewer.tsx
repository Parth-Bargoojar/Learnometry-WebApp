"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ShellViewer } from "@/lib/viewer";

/*
  The signed-in person's shell data (name, plan, balance, unread count) for client components
  (BE-D12). Built on the server in `(app)/layout.tsx` from the session and the database; after a
  mutation the action revalidates the layout and this refreshes. Client code never imports
  sample data or the database.
*/
const ViewerContext = createContext<ShellViewer | null>(null);

export function ViewerProvider({ viewer, children }: { viewer: ShellViewer; children: ReactNode }) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useViewer(): ShellViewer {
  const viewer = useContext(ViewerContext);
  if (!viewer) throw new Error("useViewer must be used inside <ViewerProvider>");
  return viewer;
}

/** For components that also render outside the signed-in shell (previews, tests). */
export const useOptionalViewer = () => useContext(ViewerContext);
