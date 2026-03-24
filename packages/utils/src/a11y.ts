export function srOnly(): Record<string, string> {
  return {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    borderWidth: "0",
  };
}

export function useId(prefix = "do-wdr"): string {
  const id = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${id}`;
}

export function ariaLabel(label: string): Record<string, string> {
  return { "aria-label": label };
}

export function focusRing(color = "#0ea5e9"): Record<string, string> {
  return {
    outline: `2px solid ${color}`,
    outlineOffset: "2px",
  };
}
