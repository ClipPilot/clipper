import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";

import { Providers } from "./providers";

import { fontSans } from "@/config/fonts";

export const metadata: Metadata = {
  title: {
    default: "Clipster",
    template: `%s - Clipster`,
  },
  description: "The future of content management",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a0a14" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a14" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en" className="dark">
      <head />
      <body
        className={clsx(
          "min-h-screen text-foreground bg-background font-sans antialiased",
          fontSans.variable,
        )}
        style={{ backgroundColor: "#0a0a14", color: "#ffffff" }}
      >
        <Providers themeProps={{
          attribute: "class",
          defaultTheme: "dark",
          enableSystem: false,
          forcedTheme: "dark"
        }}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
