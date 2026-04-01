"use client";

import { useState, useCallback } from "react";
import type { Key } from "@heroui/react";
import {
  Modal,
  Button,
  Input,
  Switch,
  Select,
  ListBox,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import type { ViralityCompetitor } from "@/api/virality";
import { MY_PERFORMANCE_NAME } from "@/lib/viralityConstants";
import { detectPlatformFromUrl } from "@/lib/platformUtils";

type Platform = "tiktok" | "instagram" | "x";
type AccountType = "profile" | "hashtag" | "keyword";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitors?: ViralityCompetitor[];
  hideCompetitorSelect?: boolean;
  onSubmit: (platform: Platform, profileUrl: string, options: {
    enableAlerts: boolean;
    competitorId?: number;
    newCompetitorName?: string;
    accountType: AccountType;
    isMyPerformance?: boolean;
  }) => Promise<void>;
}

const platforms: { value: Platform; label: string; icon: string; enabled: boolean }[] = [
  { value: "instagram", label: "Instagram", icon: "ri:instagram-fill", enabled: true },
  { value: "tiktok", label: "TikTok", icon: "ri:tiktok-fill", enabled: true },
  { value: "x", label: "X", icon: "ri:twitter-x-fill", enabled: true },
];

export function AddAccountModal({
  isOpen,
  onClose,
  competitors = [],
  hideCompetitorSelect = false,
  onSubmit,
}: AddAccountModalProps) {
  const [profileUrl, setProfileUrl] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("instagram");
  const [accountType] = useState<AccountType>("profile");
  const [enableAlerts, setEnableAlerts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [competitorSelection, setCompetitorSelection] = useState<Key | null>("new");
  const [newCompetitorName, setNewCompetitorName] = useState("");

  const handleUrlChange = useCallback((value: string) => {
    setProfileUrl(value);
    const detected = detectPlatformFromUrl(value);
    if (detected) setSelectedPlatform(detected as Platform);
  }, []);

  const handleSubmit = async () => {
    if (!profileUrl.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const sel = String(competitorSelection);
      const isMyPerf = sel === "my-performance";
      const competitorId = sel !== "new" && !isMyPerf
        ? parseInt(sel)
        : undefined;

      await onSubmit(selectedPlatform, profileUrl, {
        enableAlerts,
        competitorId,
        newCompetitorName: sel === "new" ? newCompetitorName.trim() : undefined,
        accountType,
        isMyPerformance: isMyPerf || undefined,
      });
      setProfileUrl("");
      setSelectedPlatform("instagram");
      setEnableAlerts(true);
      setCompetitorSelection("new");
      setNewCompetitorName("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setProfileUrl("");
    setError(null);
    setCompetitorSelection("new");
    setNewCompetitorName("");
    onClose();
  };

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={handleClose}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.Body className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Add New Account</h2>
                <Button
                  isIconOnly
                  variant="tertiary"
                  size="sm"
                  onPress={handleClose}
                  className="text-red-400 hover:text-red-300"
                >
                  <Icon icon="solar:close-circle-linear" width={24} />
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">
                  {selectedPlatform === "instagram"
                    ? "Profile URL"
                    : "Username or Profile URL"}
                </label>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#0d0f1a] border border-[#2a2d3e] focus-within:border-accent-400 transition-colors">
                  <Icon
                    icon={
                      selectedPlatform === "instagram"
                        ? "solar:link-linear"
                        : "solar:at-linear"
                    }
                    width={18}
                    className="text-gray-500 flex-shrink-0"
                  />
                  <input
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder={
                      selectedPlatform === "tiktok"
                        ? "e.g. @selenagomez or tiktok.com/@selenagomez"
                        : selectedPlatform === "x"
                          ? "e.g. @elonmusk or x.com/elonmusk"
                          : "e.g. instagram.com/creatorscale"
                    }
                    value={profileUrl}
                    className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-600 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && profileUrl.trim()) {
                        handleSubmit();
                      }
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm text-gray-400">Platform</label>
                <div className="grid grid-cols-3 gap-3">
                  {platforms.map((platform) => (
                    <div
                      key={platform.value}
                      onClick={() => platform.enabled && setSelectedPlatform(platform.value)}
                      className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
                        !platform.enabled
                          ? "bg-[#0d0f1a] border-[#2a2d3e] opacity-50 cursor-not-allowed"
                          : selectedPlatform === platform.value
                            ? "bg-[#1e2140] border-accent-400 cursor-pointer"
                            : "bg-[#0d0f1a] border-[#2a2d3e] hover:border-[#3a3d4e] cursor-pointer"
                      }`}
                    >
                      <Icon
                        icon={platform.icon}
                        width={24}
                        className={
                          selectedPlatform === platform.value && platform.enabled
                            ? "text-white"
                            : "text-gray-400"
                        }
                      />
                      <span
                        className={`text-sm ${
                          selectedPlatform === platform.value && platform.enabled
                            ? "text-white"
                            : "text-gray-400"
                        }`}
                      >
                        {platform.label}
                      </span>
                      {!platform.enabled && (
                        <span className="absolute top-1 right-1 text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">
                          Soon
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {!hideCompetitorSelect && (
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Competitor Group</label>
                  <Select
                    value={competitorSelection}
                    onChange={(val: Key | null) => {
                      if (val) setCompetitorSelection(val);
                    }}
                  >
                    <Select.Trigger className="w-full px-3 py-2.5 rounded-xl bg-[#0d0f1a] border border-[#2a2d3e] text-white text-sm hover:border-[#3a3d4e] transition-colors">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="my-performance" textValue={MY_PERFORMANCE_NAME}>
                          {MY_PERFORMANCE_NAME}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="new" textValue="Create New Competitor">
                          Create New Competitor
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        {competitors.map((c) => (
                          <ListBox.Item key={String(c.id)} id={String(c.id)} textValue={c.name}>
                            {c.name}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  {String(competitorSelection) === "new" && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#0d0f1a] border border-[#2a2d3e] focus-within:border-accent-400 transition-colors">
                      <Icon icon="solar:users-group-rounded-bold" width={18} className="text-gray-500 flex-shrink-0" />
                      <input
                        onChange={(e) => setNewCompetitorName(e.target.value)}
                        placeholder="e.g. Nike, Adidas"
                        value={newCompetitorName}
                        className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-600 outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-[#0d0f1a] rounded-xl border border-[#2a2d3e]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Icon icon="solar:bell-bold" width={20} className="text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Enable Instant Alerts</p>
                    <p className="text-xs text-gray-500">
                      Get notified the moment they go viral
                    </p>
                  </div>
                </div>
                <Switch
                  isSelected={enableAlerts}
                  onChange={setEnableAlerts}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <Icon icon="solar:danger-triangle-bold" className="text-red-500" width={18} />
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              )}

              <Button
                className="w-full h-12 bg-accent-400 text-white font-semibold rounded-xl"
                onPress={handleSubmit}
                isPending={isSubmitting}
                isDisabled={!profileUrl.trim()}
              >
                {!isSubmitting && <Icon icon="solar:bolt-bold" width={20} />}
                Start Tracking
              </Button>
              <p className="text-xs text-text-tertiary text-center underline">
                1 credit/account/week
              </p>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
