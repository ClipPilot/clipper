import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ViralityProvider } from "@clipper/shared-ui";
import { ViralitySyncListener } from "@/components/ViralitySyncListener";

const fontSans = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const fontMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Virality Tracker - Cuttr",
    template: "%s - Cuttr",
  },
  description:
    "Track competitor performance and viral content across social media",
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
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning lang="en" className="dark h-full">
      <body
        className={`${fontSans.variable} ${fontMono.variable} min-h-screen text-foreground bg-background font-sans antialiased flex`}
      >
        <ViralityProvider>
          <ViralitySyncListener />
          <Sidebar />
          <main className="flex-1 ml-64 overflow-auto min-h-screen">
            {children}
          </main>
        </ViralityProvider>
      </body>
    </html>
  );
}
