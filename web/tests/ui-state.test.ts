import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  loadUIState,
  saveUIState,
  saveStateToServer,
  loadStateFromServer,
  resolveUIState,
  type UIState,
} from "../lib/ui-state";

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  clear(): void {
    this.store.clear();
  }
}

describe("ui-state persistence", () => {
  const storage = new MemoryStorage();
  const originalFetch = global.fetch;

  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: {},
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      configurable: true,
    });
    storage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("prefers newer local state over stale server state", () => {
    const localState: UIState = {
      sidebarCollapsed: false,
      showApiKeys: false,
      showAdvanced: false,
      activeProfile: "custom",
      theme: "dark",
      selectedProviders: ["duckduckgo"],
      maxChars: 8000,
      skipCache: false,
      deepResearch: false,
      apiKeys: {},
      lastUpdated: 200,
    };
    const serverState: UIState = { 
      ...localState, 
      activeProfile: "free", 
      selectedProviders: [], 
      lastUpdated: 100 
    };

    const resolved = resolveUIState(serverState, localState);
    expect(resolved.activeProfile).toBe("custom");
    expect(resolved.selectedProviders).toEqual(["duckduckgo"]);
  });

  it("prefers server state when it is newer", () => {
    const localState: UIState = {
      sidebarCollapsed: false,
      showApiKeys: false,
      showAdvanced: false,
      activeProfile: "local-profile",
      theme: "dark",
      selectedProviders: ["exa"],
      maxChars: 8000,
      skipCache: false,
      deepResearch: false,
      apiKeys: {},
      lastUpdated: 100,
    };
    const serverState: UIState = { 
      ...localState, 
      activeProfile: "server-profile", 
      selectedProviders: ["tavily"], 
      lastUpdated: 200 
    };

    const resolved = resolveUIState(serverState, localState);
    expect(resolved.activeProfile).toBe("server-profile");
    expect(resolved.selectedProviders).toEqual(["tavily"]);
  });

  it("uses local state when server state is null", () => {
    const localState: UIState = {
      sidebarCollapsed: true,
      showApiKeys: true,
      showAdvanced: true,
      activeProfile: "custom",
      theme: "light",
      selectedProviders: ["exa_mcp"],
      maxChars: 5000,
      skipCache: true,
      deepResearch: true,
      apiKeys: {},
      lastUpdated: 100,
    };

    const resolved = resolveUIState(null, localState);
    expect(resolved).toEqual(localState);
  });

  it("stamps lastUpdated when saving locally", async () => {
    vi.spyOn(Date, "now").mockReturnValue(123456);

    saveUIState({ activeProfile: "custom", selectedProviders: ["duckduckgo"] });
    const loaded = await loadUIState();

    expect(loaded.activeProfile).toBe("custom");
    expect(loaded.selectedProviders).toEqual(["duckduckgo"]);
    expect(loaded.lastUpdated).toBe(123456);
  });

  it("normalizes server selectedProviders to string array", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activeProfile: "custom",
        selectedProviders: ["exa_mcp", 42, null],
        lastUpdated: 500,
      }),
    } as Response);

    const state = await loadStateFromServer();
    expect(state?.activeProfile).toBe("custom");
    expect(state?.selectedProviders).toEqual(["exa_mcp"]);
  });

  it("normalizes theme to valid values", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activeProfile: "custom",
        theme: "invalid",
        lastUpdated: 500,
      }),
    } as Response);

    const state = await loadStateFromServer();
    expect(state?.theme).toBe("dark"); // defaults to dark
  });

  it("includes lastUpdated in server save payload", async () => {
    vi.spyOn(Date, "now").mockReturnValue(888);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchSpy as typeof fetch;

    await saveStateToServer({ activeProfile: "custom", selectedProviders: ["duckduckgo"] });

    expect(fetchSpy).toHaveBeenCalledWith("/api/ui-state", expect.any(Object));
    const call = fetchSpy.mock.calls.at(0);
    expect(call).toBeDefined();
    const options = call?.[1] as RequestInit;
    expect(options.body).toContain('"lastUpdated":888');
    expect(options.body).toContain('"activeProfile":"custom"');
  });

  it("gracefully handles server errors and returns local state", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    // Set up local state
    storage.setItem("wdr-ui-state", JSON.stringify({
      activeProfile: "local-only",
      lastUpdated: 100,
    }));

    const state = await loadUIState();
    expect(state.activeProfile).toBe("local-only");
  });

  it("falls back to defaults when localStorage is empty", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    
    const state = await loadUIState();
    expect(state.activeProfile).toBe("free");
    expect(state.theme).toBe("dark");
    expect(state.sidebarCollapsed).toBe(false);
  });

  it("merges server state with localStorage on load", async () => {
    // Set up local state
    storage.setItem("wdr-ui-state", JSON.stringify({
      activeProfile: "local-profile",
      theme: "light",
      lastUpdated: 100,
    }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activeProfile: "server-profile",
        showAdvanced: true,
        lastUpdated: 200, // newer
      }),
    } as Response);

    const state = await loadUIState();
    
    // Server wins because it's newer
    expect(state.activeProfile).toBe("server-profile");
    expect(state.showAdvanced).toBe(true);
    // Local value preserved for fields not in server state
    expect(state.theme).toBe("dark"); // server didn't have theme, so defaults applied
  });
});
