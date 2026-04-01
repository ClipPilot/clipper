"use client";

import type { ThemeProviderProps } from "next-themes";

import * as React from "react";
import { HeroUIProvider } from "@heroui/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Provider as JotaiProvider } from "jotai";
import { AuthProvider } from "@/components/auth-provider";
import { CommandPaletteProvider } from "@/components/command-palette";
import { registerVideoServiceWorker } from "@/lib/videoProxy";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

export function Providers({ children, themeProps }: ProvidersProps) {
  React.useEffect(() => {
    registerVideoServiceWorker();
  }, []);

  return (
    <JotaiProvider>
      <AuthProvider>
        <NextThemesProvider {...themeProps}>
          <CommandPaletteProvider>{children}</CommandPaletteProvider>
        </NextThemesProvider>
      </AuthProvider>
    </JotaiProvider>
  );
}
