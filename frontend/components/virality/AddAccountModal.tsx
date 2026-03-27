"use client";

import { useState, useCallback } from "react";
import type { Key } from "@heroui/react";
import { Modal,
  Button,
  Input,
  Switch,
  Select,
  Label,
  ListBox } from "@heroui/react";
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

const accountTypes: { value: AccountType; label: string; icon: string }[] = [
  { value: "profile", label: "Profile", icon: "solar:user-bold" },
  // { value: "hashtag", label: "Hashtag", icon: "solar:hashtag-bold" },
  // { value: "keyword", label: "Keyword", icon: "solar:magnifer-bold" },
];

const platforms: { value: Platform; label: string; icon: string; enabled: boolean }[] = [
  { value: "instagram", label: "Instagram", icon: "solar:camera-bold", enabled: true },
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
  const [accountType, setAccountType] = useState<AccountType>("profile");
  const [enableAlerts, setEnableAlerts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [competitorSelection, setCompetitorSelection] = useState<string>("new");
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
      const isMyPerf = competitorSelection === "my-performance";
      const competitorId = competitorSelection !== "new" && !isMyPerf
        ? parseInt(competitorSelection)
        : undefined;

      await onSubmit(selectedPlatform, profileUrl, {
        enableAlerts,
        competitorId,
        newCompetitorName: competitorSelection === "new" ? newCompetitorName.trim() : undefined,
        accountType,
        isMyPerformance: isMyPerf || undefined,
      });
      setProfileUrl("");
      setSelectedPlatform("instagram");
      setAccountType("profile");
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
    setAccountType("profile");
    setError(null);
    setCompetitorSelection("new");
    setNewCompetitorName("");
    onClose();
  };

  return (
    <Modal
 hideCloseButton>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={handleClose}><Modal.Container><Modal.Dialog className="sm:max-w-md">
        <Modal.Body className="gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Add New Account</h2>
            <Button
 isIconOnly
 variant="tertiary"
 size="sm"
 onPress={handleClose}
 className="text-gray-400 hover:text-white"
 >
              <Icon icon="solar:close-circle-linear" width={24} />
            </Button>
          </div>

          {/* Account Type Toggle */}
          {/* <div className="space-y-3">
            <label className="text-sm text-gray-400">Search Type</label>
            <div className="grid grid-cols-3 gap-3">
              {accountTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setAccountType(type.value)}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all ${
                    accountType === type.value
                      ? "bg-[#1e2140] border-accent-400"
                      : "bg-[#0d0f1a] border-[#2a2d3e] hover:border-[#3a3d4e]"
                  }`}
                >
                  <Icon
                    icon={type.icon}
                    width={20}
                    className={accountType === type.value ? "text-white" : "text-gray-400"}
                  />
                  <span className={`text-xs ${accountType === type.value ? "text-white" : "text-gray-400"}`}>
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div> */}

          {/* Profile URL / Username / Hashtag / Keyword Input */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">
              {accountType === "hashtag"
                ? "Hashtag"
                : accountType === "keyword"
                  ? "Keyword"
                  : selectedPlatform === "instagram"
                    ? "Profile URL"
                    : "Username or Profile URL"}
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <Icon
                  icon={
                    accountType === "hashtag"
                      ? "solar:hashtag-bold"
                      : accountType === "keyword"
                        ? "solar:magnifer-bold"
                        : selectedPlatform === "instagram"
                          ? "solar:link-linear"
                          : "solar:at-linear"
                  }
                  width={18}
                  className="text-gray-500"
                />
              </div>
              <Input
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder={
                  accountType === "hashtag"
                    ? "e.g. #fashion or fashion"
                    : accountType === "keyword"
                      ? "e.g. trending coffee"
                      : selectedPlatform === "tiktok"
                        ? "e.g. @selenagomez or tiktok.com/@selenagomez"
                        : selectedPlatform === "x"
                          ? "e.g. @elonmusk or x.com/elonmusk"
                          : "e.g. instagram.com/creatorscale"
                }
                value={profileUrl}
                className="pl-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && profileUrl.trim()) {
                    handleSubmit();
                  }
                }}
              />
            </div>
          </div>

          {/* Platform Selection */}
          <div className="space-y-3">
            <label className="text-sm text-gray-400">Platform Selection</label>
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

          {/* Competitor Group */}
          {!hideCompetitorSelect && (
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Competitor Group</label>
              <Select
 value={competitorSelection}
 onChange={(val: Key | null) => {
 if (val) setCompetitorSelection(val as string);
 }}
 >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="my-performance" textValue={MY_PERFORMANCE_NAME}>{MY_PERFORMANCE_NAME}<ListBox.ItemIndicator /></ListBox.Item>
                    <ListBox.Item id="new" textValue="Create New Competitor">Create New Competitor<ListBox.ItemIndicator /></ListBox.Item>
                    {competitors.map((c) => (
                      <ListBox.Item key={String(c.id)} id={String(c.id)} textValue={c.name}>{c.name}<ListBox.ItemIndicator /></ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              {competitorSelection === "new" && (
                <Input onChange={(e) => (setNewCompetitorName)(e.target.value)}
 placeholder="e.g. Nike, Adidas"
 value={newCompetitorName}
 />
              )}
            </div>
          )}

          {/* Enable Instant Alerts */}
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

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <Icon icon="solar:danger-triangle-bold" className="text-red-500" width={18} />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Start Tracking Button */}
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
      </Modal.Dialog></Modal.Container></Modal.Backdrop>
    </Modal>
  );
}
