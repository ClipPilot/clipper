import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";

import { Providers } from "./providers";

import {
  fontLuckiestGuy,
  fontMontserrat,
  fontSans,
  fontEverlasting,
  fontKomika,
  fontBurbank,
  fontBebasNeue,
  fontAnton,
  fontProximaNova,
} from "@/config/fonts";

export const metadata: Metadata = {
  title: {
    default: "Cuttr",
    template: `%s -   Cuttr`,
  },
  description: "The future of content management",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a14" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      suppressHydrationWarning
      lang="en"
      className={`${fontMontserrat.variable} ${fontLuckiestGuy.variable} ${fontEverlasting.variable} ${fontKomika.variable} ${fontBurbank.variable} ${fontBebasNeue.variable} ${fontAnton.variable} ${fontProximaNova.variable}`}
    >
      <head />
      <body
        className={clsx(
          "min-h-screen text-foreground bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <Providers
          themeProps={{
            attribute: "class",
            defaultTheme: "dark",
            enableSystem: true,
          }}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
