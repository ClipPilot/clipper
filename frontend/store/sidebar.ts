import { atomWithStorage } from "jotai/utils";

export const sidebarCollapsedAtom = atomWithStorage<boolean>(
  "sidebarCollapsed",
  false,
  undefined,
  { getOnInit: false },
);
