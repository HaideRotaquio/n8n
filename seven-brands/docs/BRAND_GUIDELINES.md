# Brand guidelines

Source of truth: `brands/src/index.ts` (validated and contrast-tested in CI). Colors below are the current defaults; admins can adjust color tokens in the dashboard, and contrast is re-checked live.

| Brand | Personality | Layout family | Primary / accent | Background | Heading / body font | Radius | Motion |
|---|---|---|---|---|---|---|---|
| **Moodicons** | Warm, playful, expressive | playful-grid | `#C81E5B` / `#FFC83D` | `#FFF8EC` cream | Baloo 2 / Nunito | full | bouncy |
| **SonicGlyphs** | Studio, electric, nocturnal | studio-dark | `#7CF0C5` / `#8A5CFF` | `#0B0B14` | Space Grotesk / Inter | md | snappy |
| **LearnIcons** | Friendly, clear, trustworthy | classroom | `#1565C0` / `#FFB300` | `#F4FBFF` | Fredoka / Atkinson Hyperlegible | lg | smooth |
| **ShopMotion** | Confident, conversion-minded | merchant | `#0B7A4B` / `#FF6B35` | `#FFFFFF` | Manrope / Manrope | md | snappy |
| **CineGlyphs** | Cinematic, premium, dramatic | cinema | `#E5B95C` / `#C0392B` | `#0A0A0A` | Bebas Neue / Inter | sm | cinematic |
| **AtmosIcons** | Calm, natural, immersive | ambient | `#2F6F68` / `#8FB8DE` | `#EEF3F1` | Fraunces / Inter | lg | calm |
| **AliveUI** | Precise, technical, crisp | docs | `#4F46E5` / `#06B6D4` | `#FFFFFF` | Geist / Geist | md | precise |

## Rules

1. **Distinct, not reskinned.** Each brand gets its own layout family (page composition, navigation pattern, product-card design), not just a color swap. CI asserts unique primaries and layouts.
2. **Accessible by default.** Body text, muted text and text-on-primary must meet WCAG AA (4.5:1). CI fails otherwise.
3. **Open-licensed fonts only** (SIL OFL), self-hosted from Fontsource packages so visitors' browsers never contact Google.
4. **Motion personality** sets default easing and spring parameters in previews and storefront micro-interactions; it always yields to `prefers-reduced-motion`.
5. **Sound is opt-in** in every brand: muted until the visitor turns it on.
6. **LearnIcons is child-safe:** marketed to parents/teachers; no child accounts; no tracking on previews.
7. **Logos** are pending (Phase 4). Until then, brand names render as wordmarks in the heading font. Logos must be original work with recorded authorship.
8. **Voice:** plain, specific, no exaggerated claims; never claim a format does something it doesn't (see the export matrix).
