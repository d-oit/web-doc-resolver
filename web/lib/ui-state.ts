import type { ApiKeys } from "./keys";

export interface UIState {
  sidebarCollapsed: boolean;
  showApiKeys: boolean;
  showAdvanced: boolean;
  activeProfile: string;
  theme: "light" | "dark";
  selectedProviders: string[];
  maxChars: number;
  skipCache: boolean;
  deepResearch: boolean;
  apiKeys: ApiKeys;
  lastUpdated: number;
}

const STORAGE_KEY = "wdr-ui-state";

// Default state values
const DEFAULTS: UIState = {
  sidebarCollapsed: false,
  showApiKeys: false,
  showAdvanced: false,
  activeProfile: "free",
  theme: "dark",
  selectedProviders: [],
  maxChars: 8000,
  skipCache: false,
  deepResearch: false,
  apiKeys: {},
  lastUpdated: 0,
};

// Normalize partial state to full UIState
function normalizeUIState(value: unknown): UIState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULTS;
  }

  const parsed = value as Partial<UIState>;

  // Normalize selectedProviders to string array
  const selectedProviders = Array.isArray(parsed.selectedProviders)
    ? parsed.selectedProviders.filter((p): p is string => typeof p === "string")
    : DEFAULTS.selectedProviders;

  // Normalize theme to valid values
  const theme = parsed.theme === "light" || parsed.theme === "dark" 
    ? parsed.theme 
    : DEFAULTS.theme;

  // Normalize activeProfile
  const activeProfile = typeof parsed.activeProfile === "string" 
    ? parsed.activeProfile 
    : DEFAULTS.activeProfile;

  return {
    sidebarCollapsed: typeof parsed.sidebarCollapsed === "boolean" 
      ? parsed.sidebarCollapsed 
      : DEFAULTS.sidebarCollapsed,
    showApiKeys: typeof parsed.showApiKeys === "boolean" 
      ? parsed.showApiKeys 
      : DEFAULTS.showApiKeys,
    showAdvanced: typeof parsed.showAdvanced === "boolean" 
      ? parsed.showAdvanced 
      : DEFAULTS.showAdvanced,
    activeProfile,
    theme,
    selectedProviders,
    maxChars: typeof parsed.maxChars === "number" ? parsed.maxChars : DEFAULTS.maxChars,
    skipCache: typeof parsed.skipCache === "boolean" ? parsed.skipCache : DEFAULTS.skipCache,
    deepResearch: typeof parsed.deepResearch === "boolean" ? parsed.deepResearch : DEFAULTS.deepResearch,
    apiKeys: parsed.apiKeys && typeof parsed.apiKeys === "object" && !Array.isArray(parsed.apiKeys)
      ? parsed.apiKeys as ApiKeys
      : DEFAULTS.apiKeys,
    lastUpdated: typeof parsed.lastUpdated === "number" ? parsed.lastUpdated : DEFAULTS.lastUpdated,
  };
}

// Merge server and local state (server wins on conflict)
export function resolveUIState(serverState: UIState | null, localState: UIState): UIState {
  if (!serverState) return localState;
  
  // Server wins for conflicts (newer timestamp takes precedence)
  if (serverState.lastUpdated >= localState.lastUpdated) {
    return serverState;
  }
  
  return localState;
}

// Load from localStorage (for server-side rendering safety)
function loadFromLocalStorage(): UIState {
  if (typeof window === "undefined") return DEFAULTS;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULTS;
    return normalizeUIState(JSON.parse(stored));
  } catch {
    return DEFAULTS;
  }
}

// Save to localStorage immediately (optimistic update)
function saveToLocalStorage(state: Partial<UIState>): void {
  if (typeof window === "undefined") return;
  
  try {
    const current = loadFromLocalStorage();
    const next: UIState = {
      ...current,
      ...state,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors (private mode, quota exceeded)
  }
}

// Load UI state from server with localStorage fallback
export async function loadUIState(): Promise<UIState> {
  // Always load local first for immediate feedback
  const localState = loadFromLocalStorage();
  
  try {
    const res = await fetch("/api/ui-state");
    if (!res.ok) return localState;
    
    const serverData = await res.json();
    const serverState = normalizeUIState(serverData);
    
    // Merge: server wins for conflicts
    const merged = resolveUIState(
      Object.keys(serverData).length > 0 ? serverState : null,
      localState
    );
    
    // Update localStorage with merged state
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }
    
    return merged;
  } catch {
    // Offline or server error: use localStorage
    return localState;
  }
}

// Save UI state to localStorage + background sync to server
export function saveUIState(state: Partial<UIState>): void {
  // Immediate localStorage update for responsiveness
  saveToLocalStorage(state);
  
  // Fire-and-forget background sync to server
  // Don't await - this shouldn't block the UI
  syncToServer(state).catch(() => {
    // Silently fail - localStorage is the source of truth
  });
}

// Background sync to server
async function syncToServer(state: Partial<UIState>): Promise<void> {
  try {
    const current = loadFromLocalStorage();
    const payload: UIState = {
      ...current,
      ...state,
      lastUpdated: Date.now(),
    };
    
    const res = await fetch("/api/ui-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }
  } catch {
    // Server unavailable - state is saved in localStorage
    // Will sync on next save or page load
  }
}

// Legacy exports for backward compatibility (deprecated)
export function loadUiState(): UIState {
  return loadFromLocalStorage();
}

export function saveUiState(state: Partial<UIState>): void {
  saveUIState(state);
}

export async function loadStateFromServer(): Promise<UIState | null> {
  try {
    const res = await fetch("/api/ui-state");
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeUIState(data);
  } catch {
    return null;
  }
}

export async function saveStateToServer(state: Partial<UIState>): Promise<void> {
  return syncToServer(state);
}

// Re-export types for convenience
export type { ApiKeys };
