"use client";

interface KeyboardShortcutsModalProps {
  showShortcuts: boolean;
  setShowShortcuts: (show: boolean) => void;
}

export default function KeyboardShortcutsModal({ showShortcuts, setShowShortcuts }: KeyboardShortcutsModalProps) {
  if (!showShortcuts) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
      onClick={() => setShowShortcuts(false)}
    >
      <div
        className="bg-background border-2 border-border-muted p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between mb-4">
          <h2 className="text-[13px] font-bold text-foreground">Keyboard Shortcuts</h2>
          <button
            onClick={() => setShowShortcuts(false)}
            className="text-text-muted hover:text-foreground text-[18px] leading-none"
            aria-label="Close shortcuts"
          >
            ×
          </button>
        </div>
        <div className="space-y-2">
          {[
            { key: "Ctrl/Cmd + K", action: "Focus input" },
            { key: "Ctrl/Cmd + /", action: "Show/hide shortcuts" },
            { key: "Enter", action: "Submit query" },
            { key: "Escape", action: "Clear input or close modal" },
          ].map(({ key, action }) => (
            <div key={key} className="flex justify-between text-[11px]">
              <span className="text-text-muted">{action}</span>
              <kbd className="bg-[#222] px-2 py-1 text-foreground border border-border-muted">{key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}