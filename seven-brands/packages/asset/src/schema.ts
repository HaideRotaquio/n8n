import { BrandSlug } from "@sb/core/brand-config";
import { z } from "zod";

/**
 * Asset Definition v1 (AD) — the canonical, versioned description of every product.
 * All export formats (animated SVG, Web Component, React, PNG, GIF, MP4, WebM, Lottie, ZIP)
 * are compiled from this document. It is deliberately constrained: only shapes, paints,
 * transforms and opacity, so every target can represent it faithfully and every value is
 * safe to place in SVG markup without escaping tricks.
 */

export const AD_SCHEMA_VERSION = "daos.asset/1" as const;

const id = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/, "Lowercase id: letters, digits, dashes; starts with a letter");
const num = z.number().finite();
const coord = num.min(-10_000).max(10_000);
const positive = num.positive().max(10_000);
export const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Expected #RRGGBB");
const tokenName = z.string().regex(/^[a-z][a-zA-Z0-9]{0,23}$/);

/** SVG path data: commands, numbers and separators only. */
export const PathData = z
  .string()
  .min(1)
  .max(50_000)
  .regex(/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/, "Path data contains invalid characters")
  .refine((d) => /^\s*[Mm]/.test(d), "Path data must start with a moveto command");

export const PointList = z
  .string()
  .min(1)
  .max(20_000)
  .regex(/^[0-9eE.,+\-\s]+$/, "Points contain invalid characters");

export const Paint = z.union([
  z.literal("none"),
  HexColor,
  z.object({ token: tokenName }).strict(),
]);
export type Paint = z.infer<typeof Paint>;

/**
 * Gradients are defined once per asset (`gradients`) and used as a fill with `{ gradient: "id" }`.
 * Coordinates are in the same space as the shape that uses them (they move with its layer). Stop colours can be
 * tokens, so customers' colour changes flow into gradients; per-stop opacity allows soft light and shade overlays.
 */
export const GradientStop = z
  .object({
    offset: num.min(0).max(1),
    color: z.union([HexColor, z.object({ token: tokenName }).strict()]),
    opacity: num.min(0).max(1).optional(),
  })
  .strict();
export type GradientStop = z.infer<typeof GradientStop>;

const stops = z
  .array(GradientStop)
  .min(2)
  .max(8)
  .refine((ss) => ss.every((x, i) => i === 0 || x.offset >= ss[i - 1]!.offset), "Gradient stop offsets must not decrease");

export const Gradient = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("linear"), x1: coord, y1: coord, x2: coord, y2: coord, stops }).strict(),
  z.object({ id, type: z.literal("radial"), cx: coord, cy: coord, r: positive, stops }).strict(),
]);
export type Gradient = z.infer<typeof Gradient>;

/** Fills may also use a gradient; strokes stay solid (every export target supports that combination). */
export const FillPaint = z.union([Paint, z.object({ gradient: id }).strict()]);
export type FillPaint = z.infer<typeof FillPaint>;

export const Shape = z.discriminatedUnion("type", [
  z.object({ type: z.literal("path"), d: PathData }).strict(),
  z.object({ type: z.literal("circle"), cx: coord, cy: coord, r: positive }).strict(),
  z.object({ type: z.literal("ellipse"), cx: coord, cy: coord, rx: positive, ry: positive }).strict(),
  z
    .object({
      type: z.literal("rect"),
      x: coord,
      y: coord,
      width: positive,
      height: positive,
      rx: num.min(0).max(10_000).optional(),
    })
    .strict(),
  z.object({ type: z.literal("line"), x1: coord, y1: coord, x2: coord, y2: coord }).strict(),
  z.object({ type: z.literal("polygon"), points: PointList }).strict(),
  z.object({ type: z.literal("polyline"), points: PointList }).strict(),
]);
export type Shape = z.infer<typeof Shape>;

/** Static transform applied before animation (translate → rotate → scale, around `origin`). */
export const StaticTransform = z
  .object({
    translateX: coord.optional(),
    translateY: coord.optional(),
    rotate: num.min(-3600).max(3600).optional(),
    scale: num.min(0).max(100).optional(),
  })
  .strict();

const layerBase = {
  id,
  /** Pivot for rotation/scale, in viewBox units. Defaults to the viewBox centre. */
  origin: z.tuple([coord, coord]).optional(),
  opacity: num.min(0).max(1).optional(),
  transform: StaticTransform.optional(),
};

export const ShapeLayer = z
  .object({
    ...layerBase,
    kind: z.literal("shape"),
    shape: Shape,
    fill: FillPaint.optional(),
    stroke: Paint.optional(),
    strokeWidth: num.min(0).max(1000).optional(),
    lineCap: z.enum(["butt", "round", "square"]).optional(),
    lineJoin: z.enum(["miter", "round", "bevel"]).optional(),
    fillRule: z.enum(["nonzero", "evenodd"]).optional(),
  })
  .strict();
export type ShapeLayer = z.infer<typeof ShapeLayer>;

export interface GroupLayer {
  id: string;
  kind: "group";
  origin?: [number, number];
  opacity?: number;
  transform?: z.infer<typeof StaticTransform>;
  children: Layer[];
}
export type Layer = ShapeLayer | GroupLayer;

export const GroupLayer: z.ZodType<GroupLayer> = z.lazy(() =>
  z
    .object({
      ...layerBase,
      kind: z.literal("group"),
      children: z.array(Layer).max(500),
    })
    .strict(),
) as z.ZodType<GroupLayer>;

export const Layer: z.ZodType<Layer> = z.lazy(() => z.union([ShapeLayer, GroupLayer])) as z.ZodType<Layer>;

export const Easing = z.union([
  z.enum(["linear", "easeIn", "easeOut", "easeInOut", "step"]),
  z.object({ cubicBezier: z.tuple([num.min(0).max(1), num.min(-5).max(5), num.min(0).max(1), num.min(-5).max(5)]) }).strict(),
  z
    .object({
      spring: z
        .object({
          stiffness: num.min(1).max(2000),
          damping: num.min(0.1).max(200),
          mass: num.min(0.1).max(50).default(1),
        })
        .strict(),
    })
    .strict(),
]);
export type Easing = z.infer<typeof Easing>;

export const ANIMATABLE = ["translateX", "translateY", "rotate", "scale", "scaleX", "scaleY", "opacity"] as const;
export const AnimatableProperty = z.enum(ANIMATABLE);
export type AnimatableProperty = z.infer<typeof AnimatableProperty>;

export const Keyframe = z
  .object({
    /** Time in ms from the start of the timeline. */
    at: num.min(0).max(60_000),
    value: num.min(-100_000).max(100_000),
    /** Easing used from this keyframe to the next. */
    ease: Easing.optional(),
  })
  .strict();
export type Keyframe = z.infer<typeof Keyframe>;

export const Track = z
  .object({
    target: id,
    property: AnimatableProperty,
    keyframes: z.array(Keyframe).min(1).max(200),
  })
  .strict();
export type Track = z.infer<typeof Track>;

export const Timeline = z
  .object({
    duration: num.min(100).max(60_000),
    /** true = loop forever; number = play that many times; false = once. */
    loop: z.union([z.boolean(), z.number().int().min(1).max(100)]),
    tracks: z.array(Track).max(200),
    /** Named moments used to anchor sound cues (e.g. "impact"). */
    markers: z.array(z.object({ id, at: num.min(0).max(60_000) }).strict()).max(50).default([]),
  })
  .strict();
export type Timeline = z.infer<typeof Timeline>;

/**
 * A reference to a sound. `synth:<preset>` refers to a procedural preset (owned, license-free);
 * `snd_<id>` refers to a stored `sound_asset` row with its own license record.
 */
export const SoundRef = z.string().regex(/^(synth:[a-z][a-z0-9-]{0,39}|snd_[0-9A-HJKMNP-TV-Z]{26})$/);

export const SoundCue = z
  .object({
    id,
    sound: SoundRef,
    /** Either an absolute time or a timeline marker (+ optional offset). */
    at: num.min(0).max(60_000).optional(),
    marker: id.optional(),
    offset: num.min(-5000).max(5000).optional(),
    gain: num.min(0).max(1).default(1),
    /** Stereo position: −1 left, 0 centre, 1 right. */
    pan: num.min(-1).max(1).optional(),
    /** Place the sound where this layer is on screen when the cue fires (instead of a fixed `pan`). */
    panFrom: id.optional(),
    /** Synth preset parameters (pitch etc.) — ignored for stored sounds. */
    params: z.record(z.string().regex(/^[a-z][a-zA-Z0-9]{0,23}$/), num).optional(),
  })
  .strict()
  .refine((c) => (c.at === undefined) !== (c.marker === undefined), "A cue needs exactly one of `at` or `marker`")
  .refine((c) => c.pan === undefined || c.panFrom === undefined, "A cue has either a fixed `pan` or `panFrom`, not both");
export type SoundCue = z.infer<typeof SoundCue>;

export const Interaction = z
  .object({
    on: z.enum(["load", "hover", "click", "focus", "inView"]),
    action: z.enum(["play", "restart", "toggle", "playSound"]),
    cue: id.optional(),
  })
  .strict()
  .refine((i) => i.action !== "playSound" || i.cue !== undefined, "playSound needs a cue id");

export const AssetDefinition = z
  .object({
    schema: z.literal(AD_SCHEMA_VERSION),
    brand: BrandSlug,
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/),
    name: z.string().min(1).max(80),
    viewBox: z.tuple([coord, coord, positive, positive]),
    /** Customizable colors. Layers reference them as `{ token: "primary" }`. */
    tokens: z.record(tokenName, HexColor).refine((t) => Object.keys(t).length <= 24, "At most 24 tokens"),
    layers: z.array(Layer).min(1).max(500),
    gradients: z
      .array(Gradient)
      .max(32)
      .default([])
      .refine((gs) => new Set(gs.map((g) => g.id)).size === gs.length, "Gradient ids must be unique"),
    timeline: Timeline,
    sounds: z.array(SoundCue).max(50).default([]),
    interactions: z.array(Interaction).max(20).default([]),
    a11y: z
      .object({
        label: z.string().min(1).max(200),
        /** Time (ms) of the frame shown when the user prefers reduced motion. */
        reducedMotionFrame: num.min(0).max(60_000),
      })
      .strict(),
    tags: z.array(z.string().min(1).max(40)).max(30).default([]),
    category: z.string().regex(/^[a-z0-9-]+$/).optional(),
    provenance: z
      .object({
        method: z.enum(["rig", "ai-assisted", "manual", "fixture"]),
        rig: z.string().max(80).optional(),
        notes: z.string().max(500).optional(),
      })
      .strict(),
  })
  .strict();
export type AssetDefinition = z.infer<typeof AssetDefinition>;
export type AssetDefinitionInput = z.input<typeof AssetDefinition>;

export { walkLayers, resolvePaint, resolveStopColor, cueTime } from "./helpers";

export function parseAssetDefinition(input: unknown): AssetDefinition {
  return AssetDefinition.parse(input);
}
