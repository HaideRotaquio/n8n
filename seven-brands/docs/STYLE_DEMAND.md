# Flat vs clay 3D: deciding from demand

Moodicons faces and every chibi character exist in two styles: **flat** and **clay 3D** (gradient lighting from a
top-left light, glossy highlights, soft contact shadows). Rather than guessing how to price 3D, every pack includes
both styles at the same price, and the store measures which one customers actually download.

## Where to look

Admin → **Revenue** → *Style demand: flat vs 3D, last 30 days*. It counts downloads (website and CLI/MCP) of icons
that come in both styles, from **live purchases only**, plus how many customers chose 3D at least once.

## The rule (`styleVerdict` in `packages/core/src/style-demand.ts`)

| Condition (last 30 days) | Verdict | What to do |
|---|---|---|
| Fewer than 200 downloads or 30 customers | Collecting | Nothing yet. |
| 3D ≥ 65% of downloads | 3D leads | Show 3D first in previews and marketing; test a premium 3D tier (about +30%) on new packs only. Existing buyers keep what they bought. |
| 3D between 35% and 65% | Both valued | Keep shipping both styles in every pack. |
| 3D ≤ 35% | Flat leads | Keep 3D as a free bonus; show flat first; don't build 3D for new rigs unless asked. |

Re-check monthly. A pricing change is a business decision: the panel recommends, a person decides.
