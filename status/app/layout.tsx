import "./globals.css";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cuttr Status",
  description: "Real-time system status for Cuttr services",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
