import { ViralityProvider } from "@/contexts/ViralityContext";

export default function ExecutiveDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ViralityProvider>
      {children}
    </ViralityProvider>
  );
}
