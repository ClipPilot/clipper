import "@/styles/globals.css";
import { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Cuttr — VA Tools",
  description: "Internal tools for virtual assistants",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <body className="min-h-screen text-foreground bg-background antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
