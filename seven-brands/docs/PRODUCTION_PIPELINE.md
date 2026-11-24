# Production pipeline

Status: **design** (implementation is Phase 2). Nothing here runs yet.

## Canonical Asset Definition (AD)

Every product is a versioned JSON document (`asset_version.definition`), validated by Zod. All formats are compiled from it. Example and field list: `PHASE_0_REPORT.md` §4.

## Stages

| # | Stage | Actor | Output | Gate |
|---|---|---|---|---|
| 1 | Brief | Human or Creative Director agent | `ProductionBrief` (brand, theme, count, style refs) | — |
| 2 | Concept | Creative Director agent | Concepts + AD skeletons | Schema valid |
| 3 | Artwork | Rig generator (deterministic) or SVG agent | Layers | svg-engine: sanitize, optimize, validate |
| 4 | Motion | Animation agent / rig presets | Timeline | Renders in Chromium without errors; loop seam check |
| 5 | Sound | Synth presets, licensed library, (later) AI SFX | `sound_asset` + license record | Peak ≤ −1 dBFS, −16 LUFS, duration ≤ animation |
| 6 | Sync | Sync agent / rules | Cue points | Cues align with timeline events ±1 frame |
| 7 | QA | Automated checks | `quality_review` (score + checks) | Score ≥ threshold |
| 8 | Catalog | Catalog agent | Title, description, tags, alt text | Schema + length + banned-claims check |
| 9 | Export | export-engine (worker) | Artifacts + ZIP with LICENSE.txt + README | Each file decodes; size budgets |
| 10 | **Human review** | Reviewer / brand manager | Approve / reject with notes | **Required** |
| 11 | Publish | Publishing job | Product live on storefront | `asset.publish` permission + audit |

## Export matrix

| Format | Animation | Interactivity | Sound |
|---|---|---|---|
| Animated SVG (CSS) | ✅ | hover only | ❌ |
| Web Component | ✅ | ✅ | ✅ (after user gesture) |
| React component | ✅ | ✅ | ✅ |
| Lottie JSON | ✅ | host app | ❌ — companion audio + cue sheet |
| GIF | ✅ (256 colors) | ❌ | ❌ |
| PNG / sprite | static/frames | ❌ | ❌ |
| MP4 (H.264 + AAC) | ✅, no transparency | ❌ | ✅ baked |
| WebM (VP9 + alpha) | ✅ with transparency | ❌ | ✅ |
| ZIP | all of the above + license | | |

Product pages show this table so no format is oversold.

## Batch & collection runs

A collection brief fans out into N asset jobs via pg-boss. LLM steps use the Batch API (50% cheaper) and cached brand style guides. Each job records cost; the run stops when the daily AI budget is reached.

## Versioning

`asset_version` rows are immutable. Edits create a new version; published products pin a version. Customers get updates within the same major version.
