import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  loadUiState,
  saveUiState,
  saveStateToServer,
  loadStateFromServer,
  resolveUiState,
  type UiState,
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
    const localState: UiState = {
      sidebarOpen: true,
      apiKeysOpen: false,
      showAdvanced: false,
      profile: "custom",
      selectedProviders: ["duckduckgo"],
      maxChars: 8000,
      skipCache: false,
      deepResearch: false,
      apiKeys: {},
      updatedAt: 200,
    };
    const serverState: UiState = { ...localState, profile: "free", selectedProviders: [], updatedAt: 100 };

    const resolved = resolveUiState(serverState, localState);
    expect(resolved.profile).toBe("custom");
    expect(resolved.selectedProviders).toEqual(["duckduckgo"]);
  });

  it("stamps updatedAt when saving locally", () => {
    vi.spyOn(Date, "now").mockReturnValue(123456);

    saveUiState({ profile: "custom", selectedProviders: ["duckduckgo"] });
    const loaded = loadUiState();

    expect(loaded.profile).toBe("custom");
    expect(loaded.selectedProviders).toEqual(["duckduckgo"]);
    expect(loaded.updatedAt).toBe(123456);
  });

  it("normalizes server selectedProviders to string array", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: "custom",
        selectedProviders: ["exa_mcp", 42, null],
        updatedAt: 500,
      }),
    } as Response);

    const state = await loadStateFromServer();
    expect(state?.profile).toBe("custom");
    expect(state?.selectedProviders).toEqual(["exa_mcp"]);
  });

  it("includes updatedAt in server save payload", async () => {
    vi.spyOn(Date, "now").mockReturnValue(888);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchSpy as typeof fetch;

    await saveStateToServer({ profile: "custom", selectedProviders: ["duckduckgo"] });

    expect(fetchSpy).toHaveBeenCalledWith("/api/ui-state", expect.any(Object));
    const call = fetchSpy.mock.calls.at(0);
    expect(call).toBeDefined();
    const options = call?.[1] as RequestInit;
    expect(options.body).toContain('"updatedAt":888');
    expect(options.body).toContain('"profile":"custom"');
  });
});
