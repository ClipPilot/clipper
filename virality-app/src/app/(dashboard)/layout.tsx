import { Sidebar } from "@/components/Sidebar";
import { ViralitySyncListener } from "@/components/ViralitySyncListener";
import { AuthGuard } from "@/components/AuthGuard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ViralitySyncListener />
      <Sidebar />
      <main className="flex-1 ml-64 overflow-auto min-h-screen">
        {children}
      </main>
    </AuthGuard>
  );
}
