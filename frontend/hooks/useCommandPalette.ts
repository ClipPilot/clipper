"use client";

import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { commandPaletteOpenAtom, commandPaletteSearchAtom } from "@/store/commandPalette";

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useAtom(commandPaletteOpenAtom);
  const setSearch = useSetAtom(commandPaletteSearchAtom);

  const open = useCallback(() => {
    setIsOpen(true);
  }, [setIsOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearch("");
  }, [setIsOpen, setSearch]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    if (isOpen) {
      setSearch("");
    }
  }, [setIsOpen, setSearch, isOpen]);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}
