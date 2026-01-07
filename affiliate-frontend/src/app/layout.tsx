import "@/styles/globals.css";
import { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Cuttr Affiliate Portal",
  description: "Manage your affiliate partnership with Cuttr",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
