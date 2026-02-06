"use client";

import { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalBody,
  Button,
  Input,
  Switch,
  Select,
  SelectItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";

type Platform = "tiktok" | "instagram" | "x";

interface AddTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (platform: Platform, profileUrl: string, options: {
    enableAlerts: boolean;
    minViews: string;
    minEngagement: string;
  }) => Promise<void>;
}

const platforms: { value: Platform; label: string; icon: string }[] = [
  { value: "tiktok", label: "TikTok", icon: "ri:tiktok-fill" },
  { value: "instagram", label: "Instagram", icon: "solar:camera-bold" },
  { value: "x", label: "X", icon: "ri:twitter-x-fill" },
];

const viewOptions = [
  { value: "1k", label: "1k+ views" },
  { value: "5k", label: "5k+ views" },
  { value: "10k", label: "10k+ views" },
  { value: "50k", label: "50k+ views" },
  { value: "100k", label: "100k+ views" },
];

const engagementOptions = [
  { value: "1", label: "1%+" },
  { value: "3", label: "3%+" },
  { value: "5", label: "5%+" },
  { value: "10", label: "10%+" },
];

export function AddTargetModal({
  isOpen,
  onClose,
  onSubmit,
}: AddTargetModalProps) {
  const [profileUrl, setProfileUrl] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("tiktok");
  const [enableAlerts, setEnableAlerts] = useState(true);
  const [minViews, setMinViews] = useState("10k");
  const [minEngagement, setMinEngagement] = useState("3");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!profileUrl.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(selectedPlatform, profileUrl, {
        enableAlerts,
        minViews,
        minEngagement,
      });
      setProfileUrl("");
      setSelectedPlatform("tiktok");
      setEnableAlerts(true);
      setMinViews("10k");
      setMinEngagement("3");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add target");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setProfileUrl("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      hideCloseButton
      classNames={{
        base: "bg-[#1a1d2e] border border-[#2a2d3e] rounded-2xl",
        body: "p-6",
      }}
    >
      <ModalContent>
        <ModalBody className="gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Add New Target</h2>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={handleClose}
              className="text-gray-400 hover:text-white"
            >
              <Icon icon="solar:close-circle-linear" width={24} />
            </Button>
          </div>

          {/* Profile URL Input */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Profile URL or Handle</label>
            <Input
              placeholder="e.g. @creatorscale or tiktok.com/@user"
              value={profileUrl}
              onValueChange={setProfileUrl}
              startContent={
                <Icon icon="solar:at-linear" width={18} className="text-gray-500" />
              }
              classNames={{
                inputWrapper:
                  "bg-[#0d0f1a] border border-[#2a2d3e] hover:border-[#3a3d4e] rounded-xl h-12",
                input: "text-white placeholder:text-gray-500",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && profileUrl.trim()) {
                  handleSubmit();
                }
              }}
            />
          </div>

          {/* Platform Selection */}
          <div className="space-y-3">
            <label className="text-sm text-gray-400">Platform Selection</label>
            <div className="grid grid-cols-3 gap-3">
              {platforms.map((platform) => (
                <button
                  key={platform.value}
                  onClick={() => setSelectedPlatform(platform.value)}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
                    selectedPlatform === platform.value
                      ? "bg-[#1e2140] border-accent-400"
                      : "bg-[#0d0f1a] border-[#2a2d3e] hover:border-[#3a3d4e]"
                  }`}
                >
                  <Icon
                    icon={platform.icon}
                    width={24}
                    className={
                      selectedPlatform === platform.value
                        ? "text-white"
                        : "text-gray-400"
                    }
                  />
                  <span
                    className={`text-sm ${
                      selectedPlatform === platform.value
                        ? "text-white"
                        : "text-gray-400"
                    }`}
                  >
                    {platform.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

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
              onValueChange={setEnableAlerts}
              classNames={{
                wrapper: enableAlerts ? "bg-accent-400" : "bg-gray-600",
              }}
            />
          </div>

          {/* Advanced Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon icon="solar:tuning-2-linear" width={16} className="text-gray-400" />
              <span className="text-sm text-gray-400">Advanced Filters</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs text-gray-500 uppercase tracking-wider">
                  Min Views
                </label>
                <Select
                  selectedKeys={[minViews]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;
                    if (value) setMinViews(value);
                  }}
                  classNames={{
                    trigger:
                      "bg-[#0d0f1a] border border-[#2a2d3e] hover:border-[#3a3d4e] rounded-xl h-11 data-[hover=true]:bg-[#0d0f1a]",
                    value: "text-white",
                    popoverContent: "bg-[#1a1d2e] border border-[#2a2d3e]",
                  }}
                >
                  {viewOptions.map((option) => (
                    <SelectItem key={option.value} className="text-white">
                      {option.label}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500 uppercase tracking-wider">
                  Min Engagement Rate
                </label>
                <Select
                  selectedKeys={[minEngagement]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;
                    if (value) setMinEngagement(value);
                  }}
                  classNames={{
                    trigger:
                      "bg-[#0d0f1a] border border-[#2a2d3e] hover:border-[#3a3d4e] rounded-xl h-11 data-[hover=true]:bg-[#0d0f1a]",
                    value: "text-white",
                    popoverContent: "bg-[#1a1d2e] border border-[#2a2d3e]",
                  }}
                >
                  {engagementOptions.map((option) => (
                    <SelectItem key={option.value} className="text-white">
                      {option.label}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </div>
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
            isLoading={isSubmitting}
            isDisabled={!profileUrl.trim()}
            startContent={
              !isSubmitting && <Icon icon="solar:bolt-bold" width={20} />
            }
          >
            Start Tracking
          </Button>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
