SET QUOTED_IDENTIFIER ON;
GO
-- DB Migration: Add index for per-domain routing memory adaptive ranking
-- Milestone: Sprint 2 – Routing Intelligence

CREATE TABLE IF NOT EXISTS provider_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    domain TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    latency_ms INTEGER NOT NULL,
    quality_score REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_provider_attempts_domain
ON provider_attempts(provider, domain);
