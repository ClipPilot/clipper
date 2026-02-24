import * as Sentry from "@sentry/node";
import { Response } from "express";

export function parseId(value: string): number | null {
  const n = parseInt(value);
  return isNaN(n) ? null : n;
}

export function parseDateQuery(value: unknown): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? undefined : d;
}

export function handleControllerError(
  res: Response,
  label: string,
  error: any,
  fallbackMessage: string
) {
  console.error(`${label}:`, error);
  Sentry.captureException(error);

  if (error.message?.includes("not found")) {
    return res.status(404).json({ error: error.message });
  }
  if (error.message?.includes("already being tracked")) {
    return res.status(409).json({ error: error.message });
  }
  return res.status(500).json({ error: fallbackMessage });
}
