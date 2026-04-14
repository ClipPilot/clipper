"use client";

import { useState, useEffect } from "react";
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
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <p className="text-xl font-semibold text-white/90">Alerts</p>
        <p className="text-xs text-white/30 mt-0.5">Alert history and notification configuration</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}>
        <AlertConfigPanel settings={settingsForPanel} onSave={handleSave} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
        <AlertFeedTable
          alerts={alerts}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          onAlertClick={setSelectedAlert}
          settings={settingsForSeverity}
          onNotify={handleNotify}
        />
      </motion.div>

      <AlertDetailModal
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        settings={settingsForModal}
        onNotify={handleNotify}
      />
    </div>
  );
}
