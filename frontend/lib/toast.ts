import { toast as heroToast } from "@heroui/react";
import type { ReactNode } from "react";

interface LegacyToastOptions {
  title: ReactNode;
  description?: ReactNode;
  color?: "success" | "danger" | "warning" | "default" | string;
}

function toastLegacy(options: LegacyToastOptions) {
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

export const toast = Object.assign(toastLegacy, {
  success: heroToast.success,
  danger: heroToast.danger,
  warning: heroToast.warning,
  info: heroToast.info,
  promise: heroToast.promise,
  close: heroToast.close,
});

export { heroToast as toastDirect };
