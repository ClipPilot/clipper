"use client";

import { useState, useCallback, useEffect } from "react";
import { useAtom } from "jotai";
import { toast } from "@heroui/react";
import { selectedTeamAtom } from "@/store/auth";
import { apiPlatformAPI, type ApiKey } from "@/api/apiPlatform";

export function useApiKeys() {
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const teamId = selectedTeam?.id;

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<number | null>(null);

  const [createdKeyModal, setCreatedKeyModal] = useState(false);
  const [createdKeyRaw, setCreatedKeyRaw] = useState("");
  const [createdKeyName, setCreatedKeyName] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    if (!teamId) return;
    try {
      const data = await apiPlatformAPI.listKeys(teamId);
      setKeys(data.keys);
    } catch {
      toast.danger("Error", { description: "Failed to load API keys" });
    } finally {
      setKeysLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreateKey = async () => {
    if (!teamId || !newKeyName.trim()) return;
    setIsCreatingKey(true);
    try {
      const created = await apiPlatformAPI.createKey(teamId, newKeyName.trim());
      setCreatedKeyRaw(created.key);
      setCreatedKeyName(created.name);
      setCreatedKeyModal(true);
      setNewKeyName("");
      fetchKeys();
    } catch (err) {
      toast.danger("Error", { description: err instanceof Error ? err.message : "Failed to create API key" });
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: number) => {
    if (!teamId) return;
    setRevokingKeyId(keyId);
    try {
      await apiPlatformAPI.revokeKey(teamId, keyId);
      toast.success("Key revoked", { description: "The API key has been permanently revoked." });
      fetchKeys();
    } catch (err) {
      toast.danger("Error", { description: err instanceof Error ? err.message : "Failed to revoke key" });
    } finally {
      setRevokingKeyId(null);
    }
  };

  const closeCreatedKeyModal = () => {
    setCreatedKeyModal(false);
    setCreatedKeyRaw("");
    setCopied(false);
  };

  const copyCreatedKey = () => {
    navigator.clipboard.writeText(createdKeyRaw);
    setCopied(true);
  };

  const activeKeys = keys.filter((k) => !k.revoked);
  const revokedKeys = keys.filter((k) => k.revoked);

  return {
    keys,
    keysLoading,
    newKeyName,
    setNewKeyName,
    isCreatingKey,
    revokingKeyId,
    handleCreateKey,
    handleRevokeKey,
    activeKeys,
    revokedKeys,
    createdKeyModal,
    createdKeyRaw,
    createdKeyName,
    copied,
    closeCreatedKeyModal,
    copyCreatedKey,
  };
}
