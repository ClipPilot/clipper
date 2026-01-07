"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, Input, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { authAPI } from "@/api/auth";

interface UserProfile {
  email: string;
  firstName: string;
  lastName: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await authAPI.getProfile();
      setProfile({
        email: data.email,
        firstName: data.first_name || "",
        lastName: data.last_name || "",
      });
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setIsSaving(true);
    setMessage(null);

    try {
      await authAPI.updateProfile({
        first_name: profile.firstName,
        last_name: profile.lastName,
      });
      setMessage({ type: "success", text: "Profile updated successfully" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update profile",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-emerald border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">
          Manage your account settings
        </p>
      </div>

      {/* Profile Settings */}
      <Card className="bg-surface border border-border">
        <CardBody className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald/20 flex items-center justify-center">
              <Icon icon="solar:user-bold" className="text-xl text-emerald" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Profile Information
              </h2>
              <p className="text-text-secondary text-sm">
                Update your personal details
              </p>
            </div>
          </div>

          <div className="space-y-4 max-w-md">
            <Input
              label="Email"
              type="email"
              value={profile?.email || ""}
              isReadOnly
              classNames={{
                input: "bg-surface-elevated",
                inputWrapper: "bg-surface-elevated border-border",
              }}
              description="Email cannot be changed"
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={profile?.firstName || ""}
                onValueChange={(v) =>
                  setProfile((p) => (p ? { ...p, firstName: v } : null))
                }
                classNames={{
                  input: "bg-surface-elevated",
                  inputWrapper: "bg-surface-elevated border-border",
                }}
              />
              <Input
                label="Last Name"
                value={profile?.lastName || ""}
                onValueChange={(v) =>
                  setProfile((p) => (p ? { ...p, lastName: v } : null))
                }
                classNames={{
                  input: "bg-surface-elevated",
                  inputWrapper: "bg-surface-elevated border-border",
                }}
              />
            </div>

            {message && (
              <p
                className={`text-sm ${
                  message.type === "success" ? "text-emerald" : "text-red-500"
                }`}
              >
                {message.text}
              </p>
            )}

            <Button
              className="bg-emerald text-black font-medium"
              isLoading={isSaving}
              onPress={handleSave}
            >
              Save Changes
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Account Security */}
      <Card className="bg-surface border border-border">
        <CardBody className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Icon icon="solar:shield-bold" className="text-xl text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Account Security
              </h2>
              <p className="text-text-secondary text-sm">
                Manage your password and security settings
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-surface-elevated">
            <div>
              <p className="font-medium text-text-primary">Password</p>
              <p className="text-text-secondary text-sm">
                Last changed: Unknown
              </p>
            </div>
            <Button
              variant="bordered"
              className="border-border text-text-primary"
              isDisabled
            >
              Change Password
            </Button>
          </div>
          <p className="text-text-secondary text-sm mt-3">
            Password changes coming soon. Contact support if you need to reset
            your password.
          </p>
        </CardBody>
      </Card>

      {/* Danger Zone */}
      <Card className="bg-surface border border-red-500/30">
        <CardBody className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <Icon
                icon="solar:danger-triangle-bold"
                className="text-xl text-red-500"
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Danger Zone
              </h2>
              <p className="text-text-secondary text-sm">
                Irreversible account actions
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/5 border border-red-500/20">
            <div>
              <p className="font-medium text-text-primary">Delete Account</p>
              <p className="text-text-secondary text-sm">
                Permanently delete your affiliate account
              </p>
            </div>
            <Button color="danger" variant="flat" isDisabled>
              Delete Account
            </Button>
          </div>
          <p className="text-text-secondary text-sm mt-3">
            Contact support@cuttr.com to delete your account.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
