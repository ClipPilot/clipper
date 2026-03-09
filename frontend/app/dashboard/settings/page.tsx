"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Divider,
  Switch,
  Avatar,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { userAtom } from "@/store/auth";
import { authAPI } from "@/api/auth";

export default function SettingsPage() {
  const [user, setUser] = useAtom(userAtom);

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [email] = useState(user?.email || "");
  const [emailNotifications, setEmailNotifications] = useState(user?.emailNotificationsEnabled !== false);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const getInitials = (
    firstName?: string,
    lastName?: string,
    email?: string
  ) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const updatedUser = await authAPI.updateProfile({ firstName, lastName, emailNotificationsEnabled: emailNotifications });
      setUser(updatedUser);
      addToast({
        title: "Profile updated",
        description: "Your changes have been saved successfully.",
        color: "success",
      });
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        color: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-surface-dark p-6 lg:p-8"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          <p className="text-text-secondary mt-1">
            Manage your account and preferences
          </p>
        </motion.div>

        {/* Profile Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
        <Card className="bg-surface-base border border-border-base">
          <CardHeader className="flex flex-row items-center gap-3 pb-0">
            <Icon
              icon="solar:user-circle-bold-duotone"
              className="text-accent-400"
              width={24}
            />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Profile
              </h2>
              <p className="text-sm text-text-tertiary">
                Your personal information
              </p>
            </div>
          </CardHeader>
          <CardBody className="gap-6">
            <div className="flex items-center gap-4">
              <Avatar
                size="lg"
                name={getInitials(user?.firstName, user?.lastName, user?.email)}
                classNames={{
                  base: "bg-accent-400 text-white w-16 h-16",
                  name: "text-xl font-semibold",
                }}
              />
              <div>
                <p className="text-text-primary font-medium">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.email?.split("@")[0] || "User"}
                </p>
                <p className="text-sm text-text-tertiary">{user?.email}</p>
              </div>
            </div>

            <Divider className="bg-border-base" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="Enter your first name"
                value={firstName}
                onValueChange={setFirstName}
                classNames={{
                  input: "bg-surface-elevated text-text-primary",
                  inputWrapper:
                    "bg-surface-elevated border-border-base hover:border-border-light",
                  label: "text-text-secondary",
                }}
              />
              <Input
                label="Last Name"
                placeholder="Enter your last name"
                value={lastName}
                onValueChange={setLastName}
                classNames={{
                  input: "bg-surface-elevated text-text-primary",
                  inputWrapper:
                    "bg-surface-elevated border-border-base hover:border-border-light",
                  label: "text-text-secondary",
                }}
              />
            </div>

            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              isReadOnly
              description="Contact support to change your email"
              classNames={{
                input: "bg-surface-elevated text-text-primary",
                inputWrapper:
                  "bg-surface-elevated border-border-base opacity-60",
                label: "text-text-secondary",
                description: "text-text-tertiary",
              }}
            />

            <div className="flex justify-end">
              <Button
                className="bg-accent-400 text-white font-medium"
                startContent={
                  !isSaving && <Icon icon="solar:diskette-bold-duotone" width={18} />
                }
                isLoading={isSaving}
                onPress={handleSaveProfile}
              >
                Save Changes
              </Button>
            </div>
          </CardBody>
        </Card>
        </motion.div>

        {/* Notifications Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
        <Card className="bg-surface-base border border-border-base">
          <CardHeader className="flex flex-row items-center gap-3 pb-0">
            <Icon
              icon="solar:bell-bold-duotone"
              className="text-accent-400"
              width={24}
            />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Notifications
              </h2>
              <p className="text-sm text-text-tertiary">
                How you receive updates
              </p>
            </div>
          </CardHeader>
          <CardBody className="gap-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-surface-elevated">
              <div>
                <p className="text-text-primary font-medium">
                  Email Notifications
                </p>
                <p className="text-sm text-text-tertiary">
                  Receive updates about your clips and account
                </p>
              </div>
              <Switch
                isSelected={emailNotifications}
                onValueChange={setEmailNotifications}
                classNames={{
                  wrapper: "group-data-[selected=true]:bg-accent-400",
                }}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-surface-elevated">
              <div>
                <p className="text-text-primary font-medium">Marketing Emails</p>
                <p className="text-sm text-text-tertiary">
                  Tips, tutorials, and product updates
                </p>
              </div>
              <Switch
                isSelected={marketingEmails}
                onValueChange={setMarketingEmails}
                classNames={{
                  wrapper: "group-data-[selected=true]:bg-accent-400",
                }}
              />
            </div>
          </CardBody>
        </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
        <Card className="bg-surface-base border border-red-500/30">
          <CardHeader className="flex flex-row items-center gap-3 pb-0">
            <Icon
              icon="solar:danger-triangle-bold-duotone"
              className="text-red-500"
              width={24}
            />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Danger Zone
              </h2>
              <p className="text-sm text-text-tertiary">
                Irreversible actions
              </p>
            </div>
          </CardHeader>
          <CardBody className="gap-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/5 border border-red-500/20">
              <div>
                <p className="text-text-primary font-medium">Delete Account</p>
                <p className="text-sm text-text-tertiary">
                  Permanently delete your account and all data
                </p>
              </div>
              <Button
                variant="flat"
                className="bg-red-500/10 text-red-500 hover:bg-red-500/20"
              >
                Delete Account
              </Button>
            </div>
          </CardBody>
        </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
