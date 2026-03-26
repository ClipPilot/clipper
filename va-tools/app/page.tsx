"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Card, CardBody, Input, Button, Chip, Tabs, Tab, Select, SelectItem } from "@heroui/react";
import { Icon } from "@iconify/react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  platformIcon,
  platformIconColor,
  platformDisplayName,
  Platform,
} from "@/lib/platformUtils";

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

type RowStatus = "queued" | "processing" | "success" | "error";

interface QueueEntry {
  key: string;
  postId: number;
  postUrl: string;
  platform: Platform;
  status: RowStatus;
  error?: string;
}

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

interface ParsedSpreadsheet {
  headers: string[];
  rows: Record<string, string>[];
}

function validateSpreadsheetRow(
  row: Record<string, string>,
  idColumn: string,
  urlColumn: string
): { postId: number; postUrl: string; platform: Platform } | null {
  const rawId = row[idColumn]?.trim();
  const rawUrl = row[urlColumn]?.trim();
  if (!rawId || !rawUrl) return null;

  const postId = Number(rawId);
  if (!Number.isInteger(postId) || postId <= 0) return null;

  const platform = detectPlatform(rawUrl);
  if (!platform) return null;

  return { postId, postUrl: rawUrl, platform };
}

let nextKey = 0;

export default function MarkPostedPage() {
  const [postId, setPostId] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [queue, setQueue] = useState<QueueEntry[]>([]);

  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null);
  const [idColumn, setIdColumn] = useState("");
  const [urlColumn, setUrlColumn] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (true) {
      const current = queueRef.current;
      const nextIdx = current.findIndex((e) => e.status === "queued");
      if (nextIdx === -1) break;

      const entry = current[nextIdx];

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
  }

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

  function loadParsedData(headers: string[], rows: Record<string, string>[]) {
    setParsed({ headers, rows });
    setIdColumn("");
    setUrlColumn("");
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = /\.xlsx?$/i.test(file.name);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: "",
          raw: false,
        });
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        loadParsedData(headers, rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete(results) {
          const headers = results.meta.fields || [];
          const rows = results.data as Record<string, string>[];
          loadParsedData(headers, rows);
        },
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleResetUpload() {
    setParsed(null);
    setIdColumn("");
    setUrlColumn("");
  }

  const previewRows = useMemo(() => {
    if (!parsed || !idColumn || !urlColumn) return [];
    return parsed.rows.map((row) => validateSpreadsheetRow(row, idColumn, urlColumn));
  }, [parsed, idColumn, urlColumn]);

  const validCount = previewRows.filter(Boolean).length;
  const invalidCount = previewRows.length - validCount;

  function handleBulkSubmit() {
    const entries: QueueEntry[] = [];
    for (const result of previewRows) {
      if (!result) continue;
      entries.push({
        key: String(++nextKey),
        postId: result.postId,
        postUrl: result.postUrl,
        platform: result.platform,
        status: "queued",
      });
    }
    setQueue((prev) => [...entries, ...prev]);
    setParsed(null);
    setIdColumn("");
    setUrlColumn("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-2xl flex flex-col gap-4">
        <Card className="bg-surface-base border border-border-base">
          <CardBody className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold text-text-primary">
                Mark Posts as Published
              </h1>
              <p className="text-sm text-text-secondary">
                Add posts one at a time or upload a spreadsheet to bulk-submit.
              </p>
            </div>

            <Tabs aria-label="Input mode" variant="underlined" color="primary">
              <Tab key="manual" title={
                <div className="flex items-center gap-1.5">
                  <Icon icon="solar:pen-bold" className="text-sm" />
                  <span>Manual</span>
                </div>
              }>
                <form onSubmit={handleAdd} className="flex flex-col gap-3 pt-2">
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
              </Tab>

              <Tab key="spreadsheet" title={
                <div className="flex items-center gap-1.5">
                  <Icon icon="solar:file-bold" className="text-sm" />
                  <span>Spreadsheet</span>
                </div>
              }>
                <div className="flex flex-col gap-4 pt-2">
                  {!parsed ? (
                    <div
                      className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-base p-8 cursor-pointer hover:border-accent-400 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Icon icon="solar:upload-bold" className="text-3xl text-text-tertiary" />
                      <p className="text-sm text-text-secondary">
                        Click to upload a <span className="font-medium text-text-primary">.csv</span> or <span className="font-medium text-text-primary">.xlsx</span> file
                      </p>
                      <p className="text-xs text-text-tertiary">
                        Must have columns for Post ID and Post URL
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:file-check-bold" className="text-green-500 text-lg" />
                          <span className="text-sm text-text-primary font-medium">
                            {parsed.rows.length} rows found
                          </span>
                          <span className="text-xs text-text-tertiary">
                            ({parsed.headers.length} columns)
                          </span>
                        </div>
                        <Button size="sm" variant="light" color="danger" onPress={handleResetUpload}>
                          Remove
                        </Button>
                      </div>

                      <div className="flex gap-3">
                        <Select
                          label="Post ID column"
                          placeholder="Select column"
                          selectedKeys={idColumn ? [idColumn] : []}
                          onSelectionChange={(keys) => {
                            const val = Array.from(keys)[0] as string;
                            setIdColumn(val || "");
                          }}
                          className="flex-1"
                          startContent={<Icon icon="solar:hashtag-bold" className="text-text-tertiary" />}
                        >
                          {parsed.headers.map((h) => (
                            <SelectItem key={h}>{h}</SelectItem>
                          ))}
                        </Select>

                        <Select
                          label="Post URL column"
                          placeholder="Select column"
                          selectedKeys={urlColumn ? [urlColumn] : []}
                          onSelectionChange={(keys) => {
                            const val = Array.from(keys)[0] as string;
                            setUrlColumn(val || "");
                          }}
                          className="flex-1"
                          startContent={<Icon icon="solar:link-bold" className="text-text-tertiary" />}
                        >
                          {parsed.headers.map((h) => (
                            <SelectItem key={h}>{h}</SelectItem>
                          ))}
                        </Select>
                      </div>

                      {idColumn && urlColumn && (
                        <>
                          <div className="flex items-center gap-3 text-sm">
                            {validCount > 0 && (
                              <span className="flex items-center gap-1 text-green-500">
                                <Icon icon="solar:check-circle-bold" className="text-sm" />
                                {validCount} valid
                              </span>
                            )}
                            {invalidCount > 0 && (
                              <span className="flex items-center gap-1 text-amber-500">
                                <Icon icon="solar:danger-triangle-bold" className="text-sm" />
                                {invalidCount} skipped (missing ID, URL, or unsupported platform)
                              </span>
                            )}
                          </div>

                          {validCount > 0 && (
                            <div className="rounded-lg border border-border-base overflow-hidden">
                              <div className="max-h-48 overflow-y-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-text-tertiary text-xs uppercase tracking-wider border-b border-border-base bg-surface-elevated/50">
                                      <th className="text-left px-3 py-1.5">ID</th>
                                      <th className="text-left px-3 py-1.5">Platform</th>
                                      <th className="text-left px-3 py-1.5">URL</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {previewRows.map((result, i) => {
                                      if (!result) return null;
                                      return (
                                        <tr key={i} className="border-b border-border-base last:border-b-0">
                                          <td className="px-3 py-1.5 font-mono text-text-primary">#{result.postId}</td>
                                          <td className="px-3 py-1.5">
                                            <div className="flex items-center gap-1">
                                              <Icon
                                                icon={platformIcon(result.platform)}
                                                className={`text-sm ${platformIconColor(result.platform)}`}
                                              />
                                              <span className="text-text-secondary text-xs">
                                                {platformDisplayName(result.platform)}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="px-3 py-1.5 text-text-tertiary text-xs truncate max-w-48">
                                            {result.postUrl}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          <Button
                            color="primary"
                            isDisabled={validCount === 0}
                            onPress={handleBulkSubmit}
                            startContent={<Icon icon="solar:upload-bold" className="text-lg" />}
                          >
                            Submit {validCount} post{validCount !== 1 ? "s" : ""}
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </Tab>
            </Tabs>
          </CardBody>
        </Card>

        {queue.length > 0 && (
          <Card className="bg-surface-base border border-border-base">
            <CardBody className="p-0">
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
