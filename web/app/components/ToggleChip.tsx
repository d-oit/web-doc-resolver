"use client";

interface ToggleChipProps {
  label: string;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  ariaLabel?: string;
}

export default function ToggleChip({ label, pressed, onPressedChange, ariaLabel }: ToggleChipProps) {
  return (
    <button
      type="button"
      className={`px-3 py-2 border-2 text-[11px] min-h-[36px] rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${
        pressed
          ? "bg-accent text-background border-accent"
          : "bg-transparent text-text-muted border-border-muted hover:border-accent"
      }`}
      aria-pressed={pressed}
      aria-label={ariaLabel || label}
      onClick={() => onPressedChange(!pressed)}
    >
      {label}
    </button>
  );
}
