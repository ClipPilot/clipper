import { ViralityProvider } from "@/contexts/ViralityContext";

export default function ViralityLayout({ children }: { children: React.ReactNode }) {
  return <ViralityProvider>{children}</ViralityProvider>;
}
