"use client";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`flex items-center rounded-full bg-white/[0.06] border border-white/[0.08] p-0.5 backdrop-blur-xl ${className}`}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-all ${
            value === opt.value
              ? "bg-white/[0.12] text-text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]"
              : "text-text-tertiary hover:text-text-secondary"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
