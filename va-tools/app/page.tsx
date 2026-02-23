"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Card, CardBody, Input, Button, Chip, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  platformIcon,
  platformIconColor,
  platformDisplayName,
  Platform,
} from "@/lib/platformUtils";

// ─── Platform detection ─────────────────────────────────────────────

const PLATFORM_HOSTS: [string, Platform][] = [
  ["tiktok.com", "tiktok"],
  ["instagram.com", "instagram"],
  ["facebook.com", "facebook"],
  ["fb.watch", "facebook"],
  ["x.com", "x"],
  ["twitter.com", "x"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
];

function detectPlatform(url: string): Platform | null {
  try {
    const { hostname } = new URL(url);
    const host = hostname.replace(/^www\./, "");
    const match = PLATFORM_HOSTS.find(
      ([domain]) => host === domain || host.endsWith(`.${domain}`)
    );
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ─── Types ──────────────────────────────────────────────────────────

type RowStatus = "queued" | "processing" | "success" | "error";

interface QueueEntry {
  key: string;
  postId: number;
  postUrl: string;
  platform: Platform;
  status: RowStatus;
  error?: string;
}

// ─── API call ───────────────────────────────────────────────────────

async function submitOne(postId: number, postUrl: string) {
  const res = await fetch("/api/mark-posted", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId, postUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
  return data;
}

// ─── Status icon ────────────────────────────────────────────────────

function StatusIcon({ status }: { status: RowStatus }) {
  switch (status) {
    case "queued":
      return <Icon icon="solar:clock-circle-bold" className="text-text-tertiary text-base" />;
    case "processing":
      return <Icon icon="solar:loading-circle-bold" className="text-accent-400 text-base animate-spin" />;
    case "success":
      return <Icon icon="solar:check-circle-bold" className="text-green-500 text-base" />;
    case "error":
      return <Icon icon="solar:close-circle-bold" className="text-red-500 text-base" />;
  }
}

// ─── Page ───────────────────────────────────────────────────────────

let nextKey = 0;

export default function MarkPostedPage() {
  const [postId, setPostId] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [queue, setQueue] = useState<QueueEntry[]>([]);

  const processingRef = useRef(false);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const platform = useMemo(() => {
    if (!postUrl.trim()) return null;
    return detectPlatform(postUrl.trim());
  }, [postUrl]);

  const postIdNum = Number(postId);
  const isValidPostId = postId !== "" && Number.isInteger(postIdNum) && postIdNum > 0;
  const isValidUrl = postUrl.trim().length > 0 && platform !== null;
  const canAdd = isValidPostId && isValidUrl;

  const successCount = queue.filter((r) => r.status === "success").length;
  const errorCount = queue.filter((r) => r.status === "error").length;
  const queuedCount = queue.filter((r) => r.status === "queued" || r.status === "processing").length;

  // Worker loop — processes one entry at a time, keeps going while there are queued items
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (true) {
      const current = queueRef.current;
      const nextIdx = current.findIndex((e) => e.status === "queued");
      if (nextIdx === -1) break;

      const entry = current[nextIdx];

      // Mark as processing
      setQueue((prev) =>
        prev.map((r) => (r.key === entry.key ? { ...r, status: "processing" } : r))
      );

      try {
        await submitOne(entry.postId, entry.postUrl);
        setQueue((prev) =>
          prev.map((r) => (r.key === entry.key ? { ...r, status: "success" } : r))
        );
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((r) =>
            r.key === entry.key ? { ...r, status: "error", error: err.message } : r
          )
        );
      }
    }

    processingRef.current = false;
  }, []);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdd || !platform) return;

    const entry: QueueEntry = {
      key: String(++nextKey),
      postId: postIdNum,
      postUrl: postUrl.trim(),
      platform,
      status: "queued",
    };

    setQueue((prev) => [entry, ...prev]);
    setPostId("");
    // Keep postUrl so VAs can quickly add many IDs for the same URL
  }

  // Kick off the worker whenever queue changes
  useEffect(() => {
    const hasQueued = queue.some((e) => e.status === "queued");
    if (hasQueued && !processingRef.current) {
      processQueue();
    }
  }, [queue, processQueue]);

  function handleClear() {
    setQueue((prev) => prev.filter((r) => r.status === "queued" || r.status === "processing"));
  }

  function handleRetry(key: string) {
    setQueue((prev) =>
      prev.map((r) => (r.key === key ? { ...r, status: "queued", error: undefined } : r))
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-2xl flex flex-col gap-4">
        {/* Input card */}
        <Card className="bg-surface-base border border-border-base">
          <CardBody className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold text-text-primary">
                Mark Posts as Published
              </h1>
              <p className="text-sm text-text-secondary">
                Add posts below — they&apos;ll be submitted automatically. You can keep adding while
                previous ones process.
              </p>
            </div>

            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              <div className="flex gap-3 items-end">
                <Input
                  label="Post ID"
                  placeholder="1234"
                  type="number"
                  value={postId}
                  onValueChange={setPostId}
                  isInvalid={postId !== "" && !isValidPostId}
                  errorMessage={
                    postId !== "" && !isValidPostId ? "Must be a positive number" : undefined
                  }
                  className="w-32 shrink-0"
                  startContent={
                    <Icon icon="solar:hashtag-bold" className="text-text-tertiary" />
                  }
                />

                <Input
                  label="Post URL"
                  placeholder="https://www.tiktok.com/@user/video/..."
                  type="url"
                  value={postUrl}
                  onValueChange={setPostUrl}
                  isInvalid={postUrl.trim().length > 0 && !platform}
                  errorMessage={
                    postUrl.trim().length > 0 && !platform
                      ? "Unsupported platform"
                      : undefined
                  }
                  className="flex-1"
                  startContent={
                    <Icon icon="solar:link-bold" className="text-text-tertiary" />
                  }
                />

                <Button
                  type="submit"
                  color="primary"
                  isDisabled={!canAdd}
                  className="shrink-0"
                  startContent={<Icon icon="solar:add-circle-bold" className="text-lg" />}
                >
                  Add
                </Button>
              </div>

              {platform && (
                <Chip
                  variant="flat"
                  startContent={
                    <Icon
                      icon={platformIcon(platform)}
                      className={`text-base ${platformIconColor(platform)}`}
                    />
                  }
                  size="sm"
                >
                  {platformDisplayName(platform)}
                </Chip>
              )}
            </form>
          </CardBody>
        </Card>

        {/* Queue table */}
        {queue.length > 0 && (
          <Card className="bg-surface-base border border-border-base">
            <CardBody className="p-0">
              {/* Summary bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-base">
                <div className="flex items-center gap-3 text-sm text-text-secondary">
                  {queuedCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Icon icon="solar:loading-circle-bold" className="text-accent-400 animate-spin text-sm" />
                      {queuedCount} in queue
                    </span>
                  )}
                  {successCount > 0 && (
                    <span className="flex items-center gap-1 text-green-500">
                      <Icon icon="solar:check-circle-bold" className="text-sm" />
                      {successCount}
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="flex items-center gap-1 text-red-500">
                      <Icon icon="solar:close-circle-bold" className="text-sm" />
                      {errorCount}
                    </span>
                  )}
                </div>
                {(successCount > 0 || errorCount > 0) && queuedCount === 0 && (
                  <Button size="sm" variant="light" color="default" onPress={handleClear}>
                    Clear done
                  </Button>
                )}
              </div>

              {/* Table */}
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-tertiary text-xs uppercase tracking-wider border-b border-border-base">
                      <th className="text-left px-4 py-2 w-10"></th>
                      <th className="text-left px-4 py-2">ID</th>
                      <th className="text-left px-4 py-2">Platform</th>
                      <th className="text-left px-4 py-2">URL</th>
                      <th className="text-right px-4 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((entry) => (
                      <tr key={entry.key} className="border-b border-border-base last:border-b-0 hover:bg-surface-elevated/50">
                        <td className="px-4 py-2.5">
                          <StatusIcon status={entry.status} />
                        </td>
                        <td className="px-4 py-2.5 font-mono text-text-primary">
                          #{entry.postId}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Icon
                              icon={platformIcon(entry.platform)}
                              className={`text-sm ${platformIconColor(entry.platform)}`}
                            />
                            <span className="text-text-secondary">
                              {platformDisplayName(entry.platform)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {entry.status === "error" ? (
                            <span className="text-red-400 text-xs">{entry.error}</span>
                          ) : (
                            <span className="text-text-tertiary text-xs truncate block max-w-48">
                              {entry.postUrl}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {entry.status === "error" && (
                            <Button
                              size="sm"
                              variant="light"
                              color="primary"
                              isIconOnly
                              onPress={() => handleRetry(entry.key)}
                            >
                              <Icon icon="solar:restart-bold" className="text-sm" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
