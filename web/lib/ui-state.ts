import type { ApiKeys } from "./keys";

export interface UiState {
  sidebarOpen: boolean;
  apiKeysOpen: boolean;
  showAdvanced: boolean;
  profile: string;
  selectedProviders: string[];
  maxChars: number;
  skipCache: boolean;
  deepResearch: boolean;
  apiKeys: ApiKeys;
  updatedAt: number;
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
  apiKeys: {},
  updatedAt: 0,
};

function normalizeUiState(value: unknown): UiState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULTS;
  }

  const parsed = value as Partial<UiState>;
  const selectedProviders = Array.isArray(parsed.selectedProviders)
    ? parsed.selectedProviders.filter((provider): provider is string => typeof provider === "string")
    : DEFAULTS.selectedProviders;

  return {
    ...DEFAULTS,
    ...parsed,
    selectedProviders,
    updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : DEFAULTS.updatedAt,
  };
}

export function resolveUiState(serverState: UiState | null, localState: UiState): UiState {
  if (!serverState) return localState;
  return serverState.updatedAt >= localState.updatedAt ? serverState : localState;
}

export function loadUiState(): UiState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULTS;
    return normalizeUiState(JSON.parse(stored));
  } catch {
    return DEFAULTS;
  }
}

export function saveUiState(state: Partial<UiState>): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadUiState();
    const next = {
      ...current,
      ...state,
      updatedAt: typeof state.updatedAt === "number" ? state.updatedAt : Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
}

export async function saveStateToServer(state: Partial<UiState>): Promise<void> {
  try {
    const payload = {
      ...state,
      updatedAt: typeof state.updatedAt === "number" ? state.updatedAt : Date.now(),
    };
    await fetch("/api/ui-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    return normalizeUiState(data);
  } catch {
    return null;
  }
}
