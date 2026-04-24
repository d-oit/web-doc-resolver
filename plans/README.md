# Plans Folder Structure

## Active Plans (Post v0.3.2)

| File | Status | Purpose |
|------|--------|--------|
| PROJECT_STATUS_*.md | Current | Project health tracking |
| BUGS_AND_ISSUES.md | Current | Known bugs and issues |
| README.md | Current | Quick reference |

## Feature Plans (from v0.3.2 development)

| File | Priority | Status |
|------|---------|--------|
| 01-architecture-improvements.md | P0 | PyO3, async mutex — not started |
| 08-deep-research.md | P0 | Deep research framework — not started |
| 04-new-features.md | P2 | Structured JSON, batch API, SSE — not started |
| 05-ui-ux-improvements.md | P2 | Cascade stepper UI — not started |

## Archived (Stale/Superseded)

| File | Reason |
|------|-------|
| ADDITIONAL_IMPROVEMENTS_PLAN.md | Superseded by issue swarm |
| AI_AGENT_INSTRUCTIONS_ANALYSIS.md | Historical reference |
| IMPLEMENTATION_PLAN.md | Superseded by swarm |
| SWARM_ANALYSIS_SUMMARY.md | Historical reference |
| UI_ENHANCEMENTS_PLAN.md | Duplicate of 05-*.md |

## Archive Old Plans

Run periodically to compact plans folder:
```bash
# Archive plans older than 3 months (except active)
find plans/ -name "*.md" -mtime +90 ! -name "PROJECT_STATUS*" ! -name "BUGS_AND_ISSUES*" ! -name "README.md" -exec gzip {} \;
```