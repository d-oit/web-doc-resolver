export interface UiState {
  sidebarOpen: boolean;
  apiKeysOpen: boolean;
  showAdvanced: boolean;
  profile: string;
  selectedProviders: string[];
  maxChars: number;
  skipCache: boolean;
  deepResearch: boolean;
}

const STORAGE_KEY = "web-resolver-ui-state";

const DEFAULTS: UiState = {
  sidebarOpen: true,
  apiKeysOpen: false,
  showAdvanced: false,
  profile: "free",
  selectedProviders: [],
  maxChars: 8000,
  skipCache: false,
  deepResearch: false,
};

export function loadUiState(): UiState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULTS;
    const parsed = JSON.parse(stored);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function saveUiState(state: Partial<UiState>): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadUiState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...state }));
  } catch {
    // Ignore storage errors
  }
}

export async function saveStateToServer(state: Partial<UiState>): Promise<void> {
  try {
    await fetch("/api/ui-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch {
    // Server unavailable — localStorage is the fallback
  }
}

export async function loadStateFromServer(): Promise<UiState | null> {
  try {
    const res = await fetch("/api/ui-state");
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== "object") return null;
    return { ...DEFAULTS, ...data };
  } catch {
    return null;
  }
}
