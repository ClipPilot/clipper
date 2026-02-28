import { ViralityProvider } from "@/contexts/ViralityContext";

export default function YourPerformanceLayout({ children }: { children: React.ReactNode }) {
  return <ViralityProvider>{children}</ViralityProvider>;
}
