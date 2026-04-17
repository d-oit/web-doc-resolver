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
      className={`px-3 py-2 border-2 text-[11px] min-h-[36px] rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-[#00ff41] focus-visible:outline-offset-2 focus:outline-none ${
        pressed
          ? "bg-[#00ff41] text-[#0c0c0c] border-[#00ff41]"
          : "bg-transparent text-[#888] border-[#333] hover:border-[#00ff41]"
      }`}
      aria-pressed={pressed}
      aria-label={ariaLabel || label}
      onClick={() => onPressedChange(!pressed)}
    >
      {label}
    </button>
  );
}
