import { contrastRatio } from "@sb/core";
import { evaluateTrack, sortedKeyframes, springAt } from "./motion";
import { AssetDefinition, cueTime, walkLayers, type Paint, FillPaint } from "./schema";

/**
 * Automated quality checks for an Asset Definition. Errors block publishing;
 * warnings reduce the score and are shown to the human reviewer.
 */

export interface QaIssue {
  code: string;
  message: string;
  path?: string;
}

export interface QaResult {
  passed: boolean;
  score: number;
  errors: QaIssue[];
  warnings: QaIssue[];
  stats: { layers: number; tracks: number; pathChars: number; cues: number };
}

export const QA_PASS_SCORE = 70;
const LOOP_SEAM_TOLERANCE = 0.01;

export function runQa(input: unknown): QaResult {
  const errors: QaIssue[] = [];
  const warnings: QaIssue[] = [];
  const parsed = AssetDefinition.safeParse(input);
  if (!parsed.success) {
    for (const i of parsed.error.issues.slice(0, 20)) {
      errors.push({ code: "schema", message: i.message, path: i.path.join(".") });
    }
    return { passed: false, score: 0, errors, warnings, stats: { layers: 0, tracks: 0, pathChars: 0, cues: 0 } };
  }
  const ad = parsed.data;
  const { duration } = ad.timeline;

  // Layers: unique ids, referenced tokens exist, complexity.
  const ids = new Set<string>();
  let layers = 0;
  let pathChars = 0;
  const usedTokens = new Set<string>();
  const gradientIds = new Set(ad.gradients.map((g) => g.id));
  const usedGradients = new Set<string>();
  for (const g of ad.gradients) {
    for (const st of g.stops) {
      if (typeof st.color !== "object") continue;
      usedTokens.add(st.color.token);
      if (!(st.color.token in ad.tokens)) errors.push({ code: "unknown-token", message: `Unknown color token "${st.color.token}"`, path: `gradients.${g.id}` });
    }
  }
  const checkPaint = (p: FillPaint | undefined, where: string) => {
    if (p && typeof p === "object" && "gradient" in p) {
      usedGradients.add(p.gradient);
      if (!gradientIds.has(p.gradient)) errors.push({ code: "unknown-gradient", message: `Unknown gradient "${p.gradient}"`, path: where });
      return;
    }
    if (p && typeof p === "object") {
      usedTokens.add(p.token);
      if (!(p.token in ad.tokens)) errors.push({ code: "unknown-token", message: `Unknown color token "${p.token}"`, path: where });
    }
  };
  for (const l of walkLayers(ad.layers)) {
    layers++;
    if (ids.has(l.id)) errors.push({ code: "duplicate-layer", message: `Duplicate layer id "${l.id}"`, path: l.id });
    ids.add(l.id);
    if (l.kind === "shape") {
      checkPaint(l.fill, `${l.id}.fill`);
      checkPaint(l.stroke, `${l.id}.stroke`);
      if (l.shape.type === "path") pathChars += l.shape.d.length;
      if (l.fill === "none" && (l.stroke === undefined || l.stroke === "none")) {
        warnings.push({ code: "invisible-layer", message: `Layer "${l.id}" has no fill and no stroke`, path: l.id });
      }
    } else if (l.children.length === 0) {
      warnings.push({ code: "empty-group", message: `Group "${l.id}" is empty`, path: l.id });
    }
  }
  if (layers > 200) warnings.push({ code: "complexity", message: `${layers} layers (budget 200)` });
  if (pathChars > 40_000) warnings.push({ code: "complexity", message: `${pathChars} path characters (budget 40,000)` });
  for (const g of gradientIds) {
    if (!usedGradients.has(g)) warnings.push({ code: "unused-gradient", message: `Gradient "${g}" is not used`, path: `gradients.${g}` });
  }
  for (const t of Object.keys(ad.tokens)) {
    if (!usedTokens.has(t)) warnings.push({ code: "unused-token", message: `Token "${t}" is not used`, path: `tokens.${t}` });
  }

  // Tracks
  const seen = new Set<string>();
  for (const [i, tr] of ad.timeline.tracks.entries()) {
    const where = `timeline.tracks.${i}`;
    if (!ids.has(tr.target)) errors.push({ code: "unknown-target", message: `Track targets unknown layer "${tr.target}"`, path: where });
    const key = `${tr.target}.${tr.property}`;
    if (seen.has(key)) errors.push({ code: "duplicate-track", message: `Two tracks animate ${key}`, path: where });
    seen.add(key);
    const kfs = tr.keyframes;
    for (let k = 1; k < kfs.length; k++) {
      if (kfs[k]!.at < kfs[k - 1]!.at) {
        errors.push({ code: "unsorted-keyframes", message: `Keyframes of ${key} are not in time order`, path: where });
        break;
      }
    }
    const sorted = sortedKeyframes(tr);
    if (sorted.at(-1)!.at > duration) {
      errors.push({ code: "keyframe-after-end", message: `${key} has a keyframe after the ${duration} ms timeline end`, path: where });
    }
    if (tr.property === "opacity" && sorted.some((k) => k.value < 0 || k.value > 1)) {
      errors.push({ code: "opacity-range", message: `${key} opacity must stay within 0..1`, path: where });
    }
    // Springs should settle within their segment, otherwise the snap at the next keyframe is visible.
    for (let k = 0; k < sorted.length - 1; k++) {
      const e = sorted[k]!.ease;
      if (e && typeof e === "object" && "spring" in e) {
        const seg = sorted[k + 1]!.at - sorted[k]!.at;
        const residual = Math.abs(1 - springAt(seg, e.spring));
        if (residual > 0.02) {
          warnings.push({
            code: "spring-unsettled",
            message: `${key}: spring is ${Math.round(residual * 100)}% from rest when the segment ends (visible jump)`,
            path: where,
          });
        }
      }
    }
    // Loop seam: a looping animation should end where it starts.
    if (ad.timeline.loop !== false) {
      const v0 = evaluateTrack(sorted, 0);
      const vEnd = evaluateTrack(sorted, duration);
      const span = Math.max(1, ...sorted.map((k) => Math.abs(k.value)));
      // A full-turn rotation loops seamlessly.
      const diff = tr.property === "rotate" ? Math.abs(((vEnd - v0) % 360 + 540) % 360 - 180) : Math.abs(vEnd - v0);
      // A jump while the layer is fully transparent at the seam is invisible.
      const opacityTrack = ad.timeline.tracks.find((t) => t.target === tr.target && t.property === "opacity");
      const hiddenAtSeam =
        tr.property !== "opacity" &&
        opacityTrack !== undefined &&
        evaluateTrack(sortedKeyframes(opacityTrack), 0) < 0.01 &&
        evaluateTrack(sortedKeyframes(opacityTrack), duration) < 0.01;
      if (!hiddenAtSeam && diff / span > LOOP_SEAM_TOLERANCE) {
        warnings.push({ code: "loop-seam", message: `${key} ends at ${vEnd} but starts at ${v0}: the loop will jump`, path: where });
      }
    }
  }

  // Markers, cues, interactions
  for (const m of ad.timeline.markers) {
    if (m.at > duration) errors.push({ code: "marker-after-end", message: `Marker "${m.id}" is after the timeline end` });
  }
  const cueIds = new Set<string>();
  for (const c of ad.sounds) {
    cueIds.add(c.id);
    try {
      const at = cueTime(c, ad.timeline);
      if (at > duration) errors.push({ code: "cue-after-end", message: `Sound cue "${c.id}" starts after the timeline end` });
    } catch (e) {
      errors.push({ code: "unknown-marker", message: (e as Error).message, path: `sounds.${c.id}` });
    }
    if (c.panFrom && !ids.has(c.panFrom)) errors.push({ code: "unknown-pan-layer", message: `Sound cue "${c.id}" pans with unknown layer "${c.panFrom}"`, path: `sounds.${c.id}` });
  }
  for (const it of ad.interactions) {
    if (it.cue && !cueIds.has(it.cue)) errors.push({ code: "unknown-cue", message: `Interaction refers to unknown cue "${it.cue}"` });
  }
  if (ad.sounds.length > 0 && !ad.interactions.some((i) => i.on !== "load")) {
    warnings.push({ code: "sound-without-gesture", message: "Asset has sound but no hover/click/focus interaction; browsers block audio until a user gesture" });
  }

  // Accessibility
  if (ad.a11y.reducedMotionFrame > duration) errors.push({ code: "reduced-frame", message: "Reduced-motion frame is after the timeline end" });
  if (ad.a11y.label.trim().length < 3) warnings.push({ code: "a11y-label", message: "Accessible label is too short" });
  const fills = [...walkLayers(ad.layers)].flatMap((l) => (l.kind === "shape" && l.fill && typeof l.fill === "object" && "token" in l.fill ? [ad.tokens[l.fill.token]] : []));
  if (fills.length && fills.every((c) => c && contrastRatio(c, "#FFFFFF") < 1.3) && fills.every((c) => c && contrastRatio(c, "#000000") < 1.3)) {
    warnings.push({ code: "low-visibility", message: "All fills are mid-grey; asset may be hard to see on any background" });
  }

  const score = Math.max(0, 100 - errors.length * 25 - warnings.length * 5);
  return {
    passed: errors.length === 0 && score >= QA_PASS_SCORE,
    score,
    errors,
    warnings,
    stats: { layers, tracks: ad.timeline.tracks.length, pathChars, cues: ad.sounds.length },
  };
}
