import { create } from "zustand";

import { useAuthStore } from "../store/authStore";
import type { Child } from "../types/safetrack";

/**
 * The child a guardian is looking at. Shared by Home, Location, Safety,
 * Notifications, AI notices, Safe Zones and History, so switching child on one
 * screen switches all of them. Falls back to the first child when the chosen
 * one is gone (deleted, or another account signed in).
 */
const useSelectedChildStore = create<{ childId: string | null; select: (childId: string) => void }>((set) => ({
  childId: null,
  select: (childId) => set({ childId }),
}));

export function selectChild(childId: string) {
  useSelectedChildStore.getState().select(childId);
}

export function useSelectedChild(): { child: Child | null; children: Child[]; select: (childId: string) => void } {
  const children = useAuthStore((state) => state.linkedChildren);
  const childId = useSelectedChildStore((state) => state.childId);
  const select = useSelectedChildStore((state) => state.select);
  const child = children.find((item) => item.id === childId) ?? children[0] ?? null;
  return { child, children, select };
}
