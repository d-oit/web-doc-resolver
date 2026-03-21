type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  provider: string | undefined;
  message: string;
  data: Record<string, unknown> | undefined;
}

export class Logger {
  private entries: LogEntry[] = [];
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = "info") {
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  private add(
    level: LogLevel,
    message: string,
    provider?: string,
    data?: Record<string, unknown>
  ) {
    if (!this.shouldLog(level)) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      provider,
      message,
      data,
    };
    this.entries.push(entry);
    const prefix = provider ? `[${provider}]` : "";
    const logMsg = `${entry.timestamp} ${level.toUpperCase()} ${prefix} ${message}`;
    if (level === "error") console.error(logMsg, data ?? "");
    else if (level === "warn") console.warn(logMsg, data ?? "");
    else console.log(logMsg, data ?? "");
  }

  debug(message: string, provider?: string, data?: Record<string, unknown>) {
    this.add("debug", message, provider, data);
  }
  info(message: string, provider?: string, data?: Record<string, unknown>) {
    this.add("info", message, provider, data);
  }
  warn(message: string, provider?: string, data?: Record<string, unknown>) {
    this.add("warn", message, provider, data);
  }
  error(message: string, provider?: string, data?: Record<string, unknown>) {
    this.add("error", message, provider, data);
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  getProviderSummary(): Record<string, { attempts: number; successes: number; failures: number; totalMs: number }> {
    const summary: Record<string, { attempts: number; successes: number; failures: number; totalMs: number }> = {};
    for (const e of this.entries) {
      if (!e.provider) continue;
      if (!summary[e.provider]) {
        summary[e.provider] = { attempts: 0, successes: 0, failures: 0, totalMs: 0 };
      }
      const s = summary[e.provider]!;
      if (e.message === "attempt") s.attempts++;
      if (e.message === "success") {
        s.successes++;
        if (e.data?.latencyMs) s.totalMs += e.data.latencyMs as number;
      }
      if (e.message === "failure") s.failures++;
    }
    return summary;
  }
}
