"use client";

import { useState, useRef, useEffect, useMemo, type KeyboardEvent } from "react";

export interface ProfileOption<T extends string = string> {
  id: T;
  label: string;
  description?: string;
}

interface ProfileComboboxProps<T extends string = string> {
  value: T;
  options: ProfileOption<T>[];
  onChange: (value: T) => void;
}

export default function ProfileCombobox<T extends string>({ value, options, onChange }: ProfileComboboxProps<T>) {
  // Compute active index from value during render (not in effect)
  const valueIndex = useMemo(() => Math.max(0, options.findIndex((opt) => opt.id === value)), [value, options]);
  const [open, setOpen] = useState(false);
  const [navigatedIndex, setNavigatedIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Use navigated index when actively navigating, otherwise use value-derived index
  const activeIndex = navigatedIndex !== null ? navigatedIndex : valueIndex;

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!listRef.current || listRef.current.contains(event.target as Node)) return;
      if (buttonRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setNavigatedIndex(null);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index='${activeIndex}']`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const move = (direction: 1 | -1) => {
    setNavigatedIndex((prev) => {
      const base = prev !== null ? prev : valueIndex;
      const next = (base + direction + options.length) % options.length;
      return next;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement | HTMLUListElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) {
          setOpen(true);
        } else {
          move(1);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          setOpen(true);
        } else {
          move(-1);
        }
        break;
      case "Home":
        event.preventDefault();
        setNavigatedIndex(0);
        break;
      case "End":
        event.preventDefault();
        setNavigatedIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (!open) {
          setOpen(true);
        } else {
          const option = options[activeIndex];
          if (option) {
            onChange(option.id);
            setNavigatedIndex(null);
            setOpen(false);
          }
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setNavigatedIndex(null);
          setOpen(false);
        }
        break;
    }
  };

  const selectedOption = options.find((opt) => opt.id === value) || options[0];

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        className="w-full bg-[#141414] border-2 border-[#333] px-2 py-2 text-[13px] text-[#e8e6e3] focus:border-[#00ff41] focus:outline-none min-h-[44px] flex items-center justify-between"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change search profile"
        onClick={() => {
          setNavigatedIndex(null);
          setOpen((prev) => !prev);
        }}
        onKeyDown={handleKeyDown}
      >
        <span>{selectedOption?.label}</span>
        <span className="text-[10px] text-[#555]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`profile-option-${options[activeIndex]?.id}`}
          className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto border-2 border-[#333] bg-[#0c0c0c] shadow-lg"
          onKeyDown={handleKeyDown}
        >
          {options.map((option, index) => {
            const active = index === activeIndex;
            const selected = option.id === value;
            return (
              <li
                id={`profile-option-${option.id}`}
                key={option.id}
                role="option"
                aria-selected={selected}
                data-index={index}
                className={`px-3 py-2 text-[12px] cursor-pointer ${
                  active ? "bg-[#1a3a1a] text-[#00ff41]" : "text-[#e8e6e3]"
                } ${selected ? "font-bold" : "font-normal"}`}
                onMouseEnter={() => setNavigatedIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option.id);
                  setNavigatedIndex(null);
                  setOpen(false);
                }}
              >
                <div>{option.label}</div>
                {option.description && <div className="text-[10px] text-[#777]">{option.description}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}