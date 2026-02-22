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
import type { ViralityCompetitor } from "@/api/virality";

type Platform = "tiktok" | "instagram" | "x";
type AccountType = "profile" | "hashtag" | "keyword";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitors?: ViralityCompetitor[];
  onSubmit: (platform: Platform, profileUrl: string, options: {
    enableAlerts: boolean;
    competitorId?: number;
    newCompetitorName?: string;
    accountType: AccountType;
  }) => Promise<void>;
}

const accountTypes: { value: AccountType; label: string; icon: string }[] = [
  { value: "profile", label: "Profile", icon: "solar:user-bold" },
  { value: "hashtag", label: "Hashtag", icon: "solar:hashtag-bold" },
  { value: "keyword", label: "Keyword", icon: "solar:magnifer-bold" },
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

  const handleSubmit = async () => {
    if (!profileUrl.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const competitorId = competitorSelection !== "new"
        ? parseInt(competitorSelection)
        : undefined;

      await onSubmit(selectedPlatform, profileUrl, {
        enableAlerts,
        competitorId,
        newCompetitorName: competitorSelection === "new" ? newCompetitorName.trim() : undefined,
        accountType,
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
            <h2 className="text-xl font-semibold text-white">Add New Account</h2>
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

          {/* Account Type Toggle */}
          <div className="space-y-3">
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
          </div>

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
            <Input
              placeholder={
                accountType === "hashtag"
                  ? "e.g. #fashion or fashion"
                  : accountType === "keyword"
                    ? "e.g. trending coffee"
                    : selectedPlatform === "tiktok"
                      ? "e.g. @kotasyaps or tiktok.com/@kotasyaps"
                      : selectedPlatform === "x"
                        ? "e.g. @elonmusk or x.com/elonmusk"
                        : "e.g. instagram.com/creatorscale"
              }
              value={profileUrl}
              onValueChange={setProfileUrl}
              startContent={
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
                  onClick={() => platform.enabled && setSelectedPlatform(platform.value)}
                  className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
                    !platform.enabled
                      ? "bg-[#0d0f1a] border-[#2a2d3e] opacity-50 cursor-not-allowed"
                      : selectedPlatform === platform.value
                        ? "bg-[#1e2140] border-accent-400"
                        : "bg-[#0d0f1a] border-[#2a2d3e] hover:border-[#3a3d4e]"
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
                </button>
              ))}
            </div>
          </div>

          {/* Competitor Group */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Competitor Group</label>
            <Select
              items={[
                { key: "new", label: "Create New Competitor" },
                ...competitors.map((c) => ({ key: String(c.id), label: c.name })),
              ]}
              selectedKeys={[competitorSelection]}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string;
                if (val) setCompetitorSelection(val);
              }}
              classNames={{
                trigger: "bg-[#0d0f1a] border border-[#2a2d3e] hover:border-[#3a3d4e] rounded-xl h-12",
                value: "text-white",
              }}
            >
              {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
            </Select>
            {competitorSelection === "new" && (
              <Input
                placeholder="e.g. Nike, Adidas"
                value={newCompetitorName}
                onValueChange={setNewCompetitorName}
                classNames={{
                  inputWrapper:
                    "bg-[#0d0f1a] border border-[#2a2d3e] hover:border-[#3a3d4e] rounded-xl h-12",
                  input: "text-white placeholder:text-gray-500",
                }}
              />
            )}
          </div>

          {/* Enable Instant Alerts
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
          </div> */}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <Icon icon="solar:danger-triangle-bold" className="text-red-500" width={18} />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Start Tracking Button */}
          <p className="text-xs text-text-tertiary text-center">
            1 credit per account per week
          </p>
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
