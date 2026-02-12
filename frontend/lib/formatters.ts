export function formatNumber(num: number | null | undefined): string {
  if (!num) return "0";
  const abs = Math.abs(num);
  if (abs >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatDate(iso: string | null): string {
  if (!iso) return "Unknown date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatChartValue(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(0) + "K";
  return value.toLocaleString();
}
