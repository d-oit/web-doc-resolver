# Known Issues

## Provider Alert: DuckDuckGo unstable

- **Date**: 2026-04-20
- **Issue**: DuckDuckGo provider is consistently returning empty results or failing connectivity checks in the current environment.
- **Action Taken**: Deprioritized DuckDuckGo in the routing logic.
- **Status**: Monitoring for stability.

## Provider Regression: Firecrawl missing in Web UI

- **Date**: 2026-05-05
- **Issue**: Firecrawl provider was functional in backend runtimes but omitted from `web/app/constants.ts`, causing it to be hidden from the Sidebar and Settings.
- **Action Taken**: Restored 'firecrawl' to `PROVIDERS` list and `PROFILES` in `web/app/constants.ts`. Added `web/tests/e2e/firecrawl-visibility.spec.ts` to verify UI visibility.
- **Status**: Resolved.
- **Prevention**: Any new provider added to the backend MUST also be registered in `web/app/constants.ts` to be visible in the Web UI.

# Provider Alert: firecrawl unstable

- **Date**: 2026-05-31
- **Issue**: HTTPSConnectionPool(host='api.firecrawl.dev', port=443): Read timed out. (read timeout=20)
- **Action Taken**: Deprioritized firecrawl in the routing logic.
- **Status**: Monitoring for stability.
