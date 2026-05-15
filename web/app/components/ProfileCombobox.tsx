"use client";

import { useState, useRef, useEffect } from "react";

interface Option {
  id: string;
  label: string;
  description?: string;
}

interface ProfileComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}

export default function ProfileCombobox({ value, onChange, options }: ProfileComboboxProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-[#141414] border-2 border-border-muted px-3 py-2 text-left flex items-center justify-between text-[12px] min-h-[44px] hover:border-border-strong focus:border-accent"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change search profile"
      >
        <span>{selectedOption?.label || "Select profile..."}</span>
        <span className="text-[10px] text-text-dim">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          className="absolute z-10 w-full mt-1 bg-[#141414] border-2 border-border-muted shadow-xl"
          role="listbox"
        >
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
              className={`w-full px-3 py-2 text-left hover:bg-accent hover:text-background transition-colors flex flex-col ${
                option.id === value ? "bg-[#222] text-accent" : "text-foreground"
              }`}
              role="option"
              aria-selected={option.id === value}
            >
              <span className="text-[12px] font-bold">{option.label}</span>
              {option.description && <div className="text-[10px] text-text-muted">{option.description}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
