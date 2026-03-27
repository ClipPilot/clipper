"use client";

interface ChipOption {
  value: string;
  label: string;
  color?: string;
}

interface ChipSelectorProps {
  label: string;
  options: readonly ChipOption[] | ChipOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiSelect?: boolean;
  showColorPreview?: boolean;
  columns?: 2 | 3 | 4 | 5 | 6;
}

export function ChipSelector({
  label,
  options,
  value,
  onChange,
  multiSelect = false,
  showColorPreview = false,
  columns = 3,
}: ChipSelectorProps) {
  const selectedValues = Array.isArray(value) ? value : [value];

  const handleSelect = (optionValue: string) => {
    if (multiSelect) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter((v) => v !== optionValue)
        : [...currentValues, optionValue];
      onChange(newValues);
    } else {
      onChange(optionValue);
    }
  };

  const isSelected = (optionValue: string) => selectedValues.includes(optionValue);

  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-3 sm:grid-cols-5",
    6: "grid-cols-3 sm:grid-cols-6",
  }[columns];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-text-secondary">{label}</label>
      <div className={`grid ${gridCols} gap-2`}>
        {options.map((option) => (
          <div
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all border ${
              isSelected(option.value)
                ? "bg-accent-400 text-white border-accent-400"
                : "bg-surface-elevated border-border-base text-text-secondary hover:border-accent-400/50 hover:text-text-primary"
            }`}
          >
            {showColorPreview && option.color && (
              <span
                className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/20"
                style={{ backgroundColor: option.color }}
              />
            )}
            <span className="truncate">{option.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
