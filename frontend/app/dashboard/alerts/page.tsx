"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "@/lib/toast";
import { PageLoader } from "@/components/ui/PageLoader";
import {
  AlertConfigPanel,
  AlertFeedTable,
  AlertDetailModal,
  type AlertLogWithSnapshot,
} from "@clipper/shared-ui";
import { useTeams } from "@/hooks/useTeams";
import { viralityAPI, notifyAlert } from "@/api/virality";
import type { ViralSettings } from "@clipper/shared-types";

const PAGE_SIZE = 20;

export default function AlertsPage() {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const [settings, setSettings] = useState<ViralSettings | null>(null);
  const [alerts, setAlerts] = useState<AlertLogWithSnapshot[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedAlert, setSelectedAlert] = useState<AlertLogWithSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!selectedTeam?.id) return;
    setIsLoading(true);
    Promise.all([
      viralityAPI.getSettings(selectedTeam.id),
      viralityAPI.getAlertLogs(selectedTeam.id, PAGE_SIZE, 0),
    ])
      .then(([s, { logs, total: t }]) => {
        setSettings(s);
        setAlerts(logs);
        setTotal(t);
      })
      .catch((err: any) =>
        toast({ title: "Failed to load alerts", description: err.message, color: "danger" })
      )
      .finally(() => setIsLoading(false));
  }, [selectedTeam?.id]);

  async function handlePageChange(newPage: number) {
    if (!selectedTeam?.id) return;
    setPage(newPage);
    try {
      const { logs, total: t } = await viralityAPI.getAlertLogs(
        selectedTeam.id,
        PAGE_SIZE,
        (newPage - 1) * PAGE_SIZE
      );
      setAlerts(logs);
      setTotal(t);
    } catch (err: any) {
      toast({ title: "Failed to load alerts", description: err.message, color: "danger" });
    }
  }

  async function handleSave(payload: Parameters<React.ComponentProps<typeof AlertConfigPanel>["onSave"]>[0]) {
    if (!selectedTeam?.id || !settings) return;
    try {
      const updated = await viralityAPI.saveSettings(selectedTeam.id, { ...settings, ...payload });
      setSettings(updated);
      toast({ title: "Settings saved", color: "success" });
    } catch (err: any) {
      toast({ title: "Failed to save settings", description: err.message, color: "danger" });
    }
  }

  async function handleNotify(alertId: number) {
    if (!selectedTeam?.id) return;
    try {
      await notifyAlert(selectedTeam.id, alertId);
      toast({ title: "Team notified", color: "success" });
    } catch (err: any) {
      toast({ title: "Failed to notify", description: err.message, color: "danger" });
    }
  }

  const handleShare = useCallback((postUrl: string) => {
    navigator.clipboard.writeText(postUrl)
      .then(() => toast({ title: "Post URL copied to clipboard", color: "success" }))
      .catch(() => toast({ title: "Failed to copy URL", color: "danger" }));
  }, []);

  const handleClone = useCallback((postUrl: string) => {
    router.push(`/dashboard/ad-clone?postUrl=${encodeURIComponent(postUrl)}`);
  }, [router]);

  if (isLoading || !settings) return <PageLoader />;

  const settingsForPanel = {
    owned_percent_threshold: settings.ownedPercentThreshold ?? settings.percentThreshold ?? 50,
    owned_absolute_threshold: settings.ownedAbsoluteThreshold ?? settings.absoluteThreshold ?? 10000,
    owned_threshold_mode: settings.ownedThresholdMode ?? settings.thresholdMode,
    owned_alerts_enabled: settings.ownedAlertsEnabled ?? true,
    competitor_percent_threshold: settings.competitorPercentThreshold ?? settings.percentThreshold ?? 50,
    competitor_absolute_threshold: settings.competitorAbsoluteThreshold ?? settings.absoluteThreshold ?? 10000,
    competitor_threshold_mode: settings.competitorThresholdMode ?? settings.thresholdMode,
    competitor_alerts_enabled: settings.competitorAlertsEnabled ?? true,
    time_frame_hours: settings.timeFrameHours,
    additional_emails: settings.additionalEmails,
  };

  const settingsForSeverity = {
    owned_percent_threshold: settings.ownedPercentThreshold ?? settings.percentThreshold ?? 50,
    owned_absolute_threshold: settings.ownedAbsoluteThreshold ?? settings.absoluteThreshold ?? 10000,
    competitor_percent_threshold: settings.competitorPercentThreshold ?? settings.percentThreshold ?? 50,
    competitor_absolute_threshold: settings.competitorAbsoluteThreshold ?? settings.absoluteThreshold ?? 10000,
  };

  const settingsForModal = {
    ...settingsForSeverity,
    time_frame_hours: settings.timeFrameHours,
  };

  return (
    <div className="relative max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-full w-full overflow-hidden blur-3xl"
      >
        <div
          className="mx-auto aspect-[1155/678] w-[72rem] bg-gradient-to-tr from-accent-400/30 to-purple-500/20 opacity-30"
          style={{
            clipPath: "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative z-10"
      >
        <p className="text-xl font-semibold text-text-primary">Alerts</p>
        <p className="text-xs text-text-tertiary mt-0.5">Alert history and notification configuration</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }} className="relative z-10">
        <AlertConfigPanel settings={settingsForPanel} onSave={handleSave} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }} className="relative z-10">
        <AlertFeedTable
          alerts={alerts}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          onAlertClick={setSelectedAlert}
          settings={settingsForSeverity}
          onNotify={handleNotify}
          onShare={handleShare}
          onClone={handleClone}
        />
      </motion.div>

      <AlertDetailModal
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        settings={settingsForModal}
        onNotify={handleNotify}
        onShare={handleShare}
        onClone={handleClone}
      />
    </div>
  );
}
