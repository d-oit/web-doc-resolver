CREATE TABLE IF NOT EXISTS provider_quota_usage (
    provider    TEXT NOT NULL,
    year_month  TEXT NOT NULL,  -- 'YYYY-MM'
    call_count  INTEGER NOT NULL DEFAULT 0,
    updated_at  INTEGER NOT NULL,
    PRIMARY KEY (provider, year_month)
);
