import { toast as heroToast } from "@heroui/react";
import type { ReactNode } from "react";

interface LegacyToastOptions {
  title: ReactNode;
  description?: ReactNode;
  color?: "success" | "danger" | "warning" | "default" | string;
}

export function toast(options: LegacyToastOptions) {
  const { title, description, color } = options;
  const method = color === "success" ? heroToast.success
    : color === "danger" || color === "error" ? heroToast.danger
    : color === "warning" ? heroToast.warning
    : color === "info" ? heroToast.info
    : heroToast;

  if (description) {
    return method(title, { description });
  }
  return method(title);
}

export { heroToast as toastDirect };
