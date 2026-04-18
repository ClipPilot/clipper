import { ViralityProvider } from "@/contexts/ViralityContext";
import { ViralitySyncListener } from "@/components/virality/ViralitySyncListener";

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ViralityProvider>
      <ViralitySyncListener />
      {children}
    </ViralityProvider>
  );
}
