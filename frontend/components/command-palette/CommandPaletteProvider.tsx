"use client";

import { ReactNode } from "react";
import { CommandPalette } from "./CommandPalette";

interface CommandPaletteProviderProps {
  children: ReactNode;
}

export function CommandPaletteProvider({ children }: CommandPaletteProviderProps) {
  return (
    <>
      {children}
      <CommandPalette />
    </>
  );
}
