# Production pipeline

Status: **implemented (Phases 2–4)**. Packages: `@sb/asset`, `@sb/audio`, `@sb/svg-engine`, `@sb/player`, `@sb/export`, `@sb/rigs`, `@sb/agents`, `services/worker`.

## Asset Definition v1 (AD)

Every product is a versioned JSON document (`asset_version.definition`, immutable), validated by the Zod schema in `packages/asset/src/schema.ts`:

| Part | Contents |
|---|---|
| `viewBox`, `layers` | Tree of groups and shapes (path, circle, ellipse, rect, line, polygon, polyline). Path data and points are validated character-by-character. |
| `tokens` | Named `#RRGGBB` colors; layers reference them (`{ token: "primary" }`). Customers can change them. |
| `gradients` | Optional linear/radial gradients (2–8 stops; stop colours may be tokens; per-stop opacity) in the same coordinates as the shapes that use them. Fills reference them with `{ gradient: "id" }`; strokes stay solid. Rendered as SVG `<defs>` (ids prefixed per render/player), and as Lottie `gf` fills with opacity ramps — checked pixel-for-pixel against lottie-web. Used by the clay 3D style (`packages/rigs/src/soft3d.ts`). Definitions saved before gradients existed simply have none. |
| `timeline` | Duration, loop (forever / N / once), tracks (translate, rotate, scale, scaleX/Y, opacity) with keyframes and easing (linear, ease presets, cubic-bezier, physical springs), and named markers. |
| `sounds` | Cues at a time or marker, optionally placed in stereo (`pan` −1…1 or `panFrom: <layer>`): `synth:<preset>` (procedural, owned) or `snd_…` (stored sound from the library, with a license record). |
| `interactions` | load / hover / click / focus / inView → play, restart, toggle, playSound. |
| `a11y` | Label and the still frame shown under reduced motion. |
| `provenance` | `rig`, `ai-assisted`, `manual` or `fixture`. |

One motion evaluator (`packages/asset/src/motion.ts`) drives every output, so all formats move identically.

## Production methods

| Method | How | Cost | Where |
|---|---|---|---|
| **Rig** | Parametric generators: Moodicons face (15 expressions × 4 palettes), Moodicons reaction stickers (8 × 2), Moodicons Bawal signs (6, PH public rules), SonicGlyphs line glyphs (14 × 3) | $0 | `packages/rigs` |
| **AI brief** | Creative director → SVG artist → importer (sanitize, repair once) → animator → QA (repair once) | ~$0.05–0.20 per asset (est.) | `packages/agents` |
| **Import** | Untrusted SVG → allowlist importer → layers (UI upload planned) | $0 | `packages/svg-engine` |

## Job flow

```
Admin "Production factory" ──enqueue──▶ production_job (status queued) ──NOTIFY daos_jobs──▶ worker
worker: claim (FOR UPDATE SKIP LOCKED) → run → save version(s) + automated QA → succeeded / retry / failed
asset: draft (QA failed) | in_review (QA passed) ──human review──▶ approved / rejected ──(product published, `asset.publish`)──▶ published
```

- Retries with backoff for transient errors; permanent errors (bad brief, missing AI config, budget reached, refusals) fail immediately.
- Stale `running` jobs are re-queued after 15 minutes (worker crash).
- Every AI call is recorded in `agent_task` and booked as an `expense`, even when it fails.

## Automated QA (`runQa`)

Errors block approval: schema violations, unknown layers/tokens/markers/cues, duplicate tracks, keyframes after the end or out of order, opacity outside 0–1.
Warnings lower the score (5 each): visible loop seams (ignores full-turn rotations and seams while transparent), springs not settled by the next keyframe, invisible/empty layers, unused tokens, sound without a user-gesture interaction, complexity over budget. Pass = no errors and score ≥ 70. All rig outputs score 100.

## Exports (`@sb/export`)

| Format | Motion | Interactive | Sound | Notes |
|---|---|---|---|---|
| SVG (static) | — | — | — | reduced-motion frame |
| SVG (animated) | ✅ | hover variant | — | CSS keyframes sampled at 30 fps; springs baked |
| PNG 64/256/512 | — | — | — | resvg, transparent |
| GIF | ✅ | — | — | ffmpeg palette, 1-bit alpha, ~3 s of loops |
| MP4 | ✅ | — | ✅ | H.264 yuv420p + AAC, white background |
| WebM | ✅ | — | ✅ | VP9 with alpha + Opus |
| WAV + cue sheet | — | — | ✅ | mixed, −16 LUFS, peak ≤ −1 dBFS |
| Web Component | ✅ | ✅ | ✅ (after click) | `<daos-asset>`, 19 KB player |
| React | ✅ | ✅ | ✅ | typed wrapper around the Web Component |
| JSON | — | — | — | the definition itself |
| ZIP | all of the above + README (capability table) + LICENSE (“not licensed” until sold) | | | |

Export jobs store files under `brands/<brand>/assets/<asset>/v<n>/` and record `export_artifact` rows; downloads use 5-minute signed URLs.

## Not yet built

SVG upload UI, batch API for large AI collections.

Phase 4 added: **Lottie export** (paths and arcs converted to Béziers, motion baked per frame at 60 fps from the same motion engine, so springs match exactly; every rig asset is compared pixel by pixel with lottie-web in tests; Lottie carries no sound or interactions), the **sound library** (upload a 16-bit WAV ≤ 10 s → mono 48 kHz at −16 LUFS / −1 dBFS; each sound keeps its source and license; "Use a library sound" on an asset swaps one cue and creates a new version for review; exports mix stored sounds into WAV/MP4/WebM and ship them with the Web Component), and the **catalog writer** agent (suggestions only).

Publishing (Phase 3): an approved asset with an export package goes on sale as part of a product. A newer version stays out of buyers' hands until a reviewer approves it and it is exported; buyers then get it as a free update.
