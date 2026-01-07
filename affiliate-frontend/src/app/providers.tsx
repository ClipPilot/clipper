"use client";

import { HeroUIProvider } from "@heroui/react";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Provider as JotaiProvider } from "jotai";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <JotaiProvider>
      <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
        <HeroUIProvider navigate={router.push}>{children}</HeroUIProvider>
      </NextThemesProvider>
    </JotaiProvider>
  );
}
