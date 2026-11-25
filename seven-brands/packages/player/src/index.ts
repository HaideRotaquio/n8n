import {
  cueTime,
  cuePan,
  indexTracks,
  layerOrigin,
  layerState,
  localTime,
  renderStructure,
  svgTransform,
  totalDuration,
  walkLayers,
  fmt,
  SVG_NS,
  type AssetDefinition,
  type Layer,
  type TrackIndex,
  type VNode,
} from "@sb/asset/runtime";
import { DEFAULT_SAMPLE_RATE, parseSynthRef, renderPreset } from "@sb/audio";

/**
 * Browser playback engine (used by the admin's Universal Viewer, storefront previews and the
 * exported Web Component). Builds the SVG once with createElementNS from validated data,
 * then updates per-layer transforms each animation frame. Sound is scheduled on the Web Audio
 * clock with a short look-ahead so cues land on the animation frame they belong to.
 *
 * Audio only starts after a user gesture (browser autoplay policy) and only when unmuted.
 */

export interface PlayerOptions {
  tokens?: Record<string, string>;
  speed?: number;
  muted?: boolean;
  /** Pixel size of the rendered SVG (width). */
  size?: number;
  background?: string;
  /** Respect prefers-reduced-motion (default true). */
  respectReducedMotion?: boolean;
  /** URLs (or data: URIs) for stored sounds referenced as `snd_…`. */
  soundUrls?: Record<string, string>;
  /** Start playing as soon as possible (subject to reduced motion). */
  autoplay?: boolean;
  onTick?: (timelineMs: number, elapsedMs: number) => void;
  onStateChange?: (state: { playing: boolean; muted: boolean }) => void;
}

export function buildDom(node: VNode | string, doc: Document): Node {
  if (typeof node === "string") return doc.createTextNode(node);
  const el = doc.createElementNS(SVG_NS, node.tag);
  for (const [k, v] of Object.entries(node.attrs)) {
    if (k === "xmlns") continue;
    el.setAttribute(k, v);
  }
  for (const c of node.children) el.appendChild(buildDom(c, doc));
  return el;
}

const LOOKAHEAD_MS = 120;

export class AssetPlayer {
  readonly svg: SVGSVGElement;
  private ad: AssetDefinition;
  private opts: PlayerOptions;
  private idx: TrackIndex;
  private layers: { layer: Layer; el: Element; origin: [number, number] }[] = [];
  private raf = 0;
  private playing = false;
  /** Elapsed playback time (ms, already speed-adjusted) at `anchorWall`. */
  private elapsedAtAnchor = 0;
  private anchorWall = 0;
  private audio: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private scheduled = new Set<string>();
  private reduced = false;

  constructor(private host: Element | ShadowRoot, ad: AssetDefinition, opts: PlayerOptions = {}) {
    this.ad = ad;
    this.opts = { speed: 1, muted: true, respectReducedMotion: true, ...opts };
    this.idx = indexTracks(ad.timeline);
    const doc = (host as Node).ownerDocument ?? document;
    this.svg = buildDom(renderStructure(ad, { tokens: opts.tokens, size: opts.size, background: opts.background }), doc) as SVGSVGElement;
    this.svg.style.display = "block";
    // Fill the host unless an explicit pixel size was requested; the host decides the size.
    if (opts.size === undefined) this.svg.style.width = "100%";
    this.svg.style.maxWidth = "100%";
    this.svg.style.height = "auto";
    host.appendChild(this.svg);
    this.bindLayers();
    this.reduced =
      !!this.opts.respectReducedMotion && typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.render(this.reduced ? ad.a11y.reducedMotionFrame : 0);
    this.bindInteractions();
    if (this.opts.autoplay && !this.reduced) this.play();
  }

  private bindLayers() {
    this.layers = [];
    const byId = new Map<string, Element>();
    this.svg.querySelectorAll("[data-layer]").forEach((el) => byId.set(el.getAttribute("data-layer")!, el));
    for (const layer of walkLayers(this.ad.layers)) {
      const el = byId.get(layer.id);
      if (el) this.layers.push({ layer, el, origin: layerOrigin(layer, this.ad) });
    }
  }

  private bindInteractions() {
    const target = this.svg;
    for (const it of this.ad.interactions) {
      if (it.on === "load") continue;
      const ev = it.on === "hover" ? "pointerenter" : it.on === "click" ? "click" : it.on === "focus" ? "focus" : null;
      if (it.on === "inView" && typeof IntersectionObserver !== "undefined") {
        new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && this.runAction(it.action, it.cue)).observe(target);
        continue;
      }
      if (ev) target.addEventListener(ev, () => this.runAction(it.action, it.cue, true));
      if (it.on === "click") target.style.cursor = "pointer";
    }
  }

  private runAction(action: string, cue?: string, fromGesture = false) {
    if (fromGesture) void this.ensureAudio();
    if (action === "play") this.play();
    else if (action === "restart") this.restart();
    else if (action === "toggle") (this.playing ? this.pause() : this.play());
    else if (action === "playSound" && cue) void this.playCueNow(cue);
  }

  // ─── Transport ────────────────────────────────────────────────────────────

  get isPlaying() {
    return this.playing;
  }

  get elapsed(): number {
    if (!this.playing) return this.elapsedAtAnchor;
    return this.elapsedAtAnchor + (performance.now() - this.anchorWall) * (this.opts.speed ?? 1);
  }

  play() {
    if (this.playing) return;
    if (this.elapsedAtAnchor >= totalDuration(this.ad.timeline)) this.elapsedAtAnchor = 0;
    this.playing = true;
    this.anchorWall = performance.now();
    this.scheduled.clear();
    this.emitState();
    const loop = () => {
      if (!this.playing) return;
      const e = this.elapsed;
      this.render(localTime(this.ad.timeline, e), e);
      this.scheduleAudio(e);
      if (e >= totalDuration(this.ad.timeline)) {
        this.elapsedAtAnchor = e;
        this.playing = false;
        this.emitState();
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause() {
    if (!this.playing) return;
    this.elapsedAtAnchor = this.elapsed;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.emitState();
  }

  restart() {
    this.pause();
    this.elapsedAtAnchor = 0;
    this.render(0, 0);
    this.play();
  }

  seek(timelineMs: number) {
    const t = Math.max(0, Math.min(timelineMs, this.ad.timeline.duration));
    this.elapsedAtAnchor = t;
    this.anchorWall = performance.now();
    this.scheduled.clear();
    this.render(t, t);
  }

  setSpeed(speed: number) {
    const e = this.elapsed;
    this.opts.speed = Math.min(4, Math.max(0.1, speed));
    this.elapsedAtAnchor = e;
    this.anchorWall = performance.now();
    this.scheduled.clear();
  }

  /** Unmuting must happen from a user gesture (click/tap/key) for audio to start. */
  async setMuted(muted: boolean) {
    this.opts.muted = muted;
    if (!muted) await this.ensureAudio();
    this.scheduled.clear();
    this.emitState();
  }

  setTokens(tokens: Record<string, string>) {
    this.opts.tokens = tokens;
    const t = localTime(this.ad.timeline, this.elapsed);
    const fresh = buildDom(renderStructure(this.ad, { tokens, size: this.opts.size, background: this.opts.background }), this.svg.ownerDocument) as SVGSVGElement;
    this.svg.replaceChildren(...Array.from(fresh.childNodes));
    this.bindLayers();
    this.render(t);
  }

  destroy() {
    this.pause();
    this.svg.remove();
    void this.audio?.close();
  }

  private emitState() {
    this.opts.onStateChange?.({ playing: this.playing, muted: !!this.opts.muted });
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  render(t: number, elapsed = t) {
    for (const { layer, el, origin } of this.layers) {
      const s = layerState(layer, this.idx, t);
      const tr = svgTransform(s, origin);
      if (tr) el.setAttribute("transform", tr);
      else el.removeAttribute("transform");
      if (s.opacity !== 1) el.setAttribute("opacity", fmt(s.opacity));
      else el.removeAttribute("opacity");
    }
    this.opts.onTick?.(t, elapsed);
  }

  // ─── Audio ────────────────────────────────────────────────────────────────

  private async ensureAudio(): Promise<AudioContext | null> {
    if (typeof AudioContext === "undefined") return null;
    this.audio ??= new AudioContext();
    if (this.audio.state === "suspended") await this.audio.resume().catch(() => undefined);
    await this.loadBuffers();
    return this.audio;
  }

  private async loadBuffers() {
    const ctx = this.audio;
    if (!ctx) return;
    for (const cue of this.ad.sounds) {
      const key = `${cue.sound}|${JSON.stringify(cue.params ?? {})}`;
      if (this.buffers.has(key)) continue;
      const preset = parseSynthRef(cue.sound);
      if (preset) {
        const data = renderPreset(preset, cue.params ?? {}, DEFAULT_SAMPLE_RATE);
        const buf = ctx.createBuffer(1, data.length, DEFAULT_SAMPLE_RATE);
        buf.copyToChannel(new Float32Array(data), 0);
        this.buffers.set(key, buf);
      } else if (this.opts.soundUrls?.[cue.sound]) {
        try {
          const res = await fetch(this.opts.soundUrls[cue.sound]!);
          this.buffers.set(key, await ctx.decodeAudioData(await res.arrayBuffer()));
        } catch {
          /* missing sound: play silently rather than break the animation */
        }
      }
    }
  }

  private playBuffer(cueId: string, whenCtx: number) {
    const cue = this.ad.sounds.find((c) => c.id === cueId);
    const ctx = this.audio;
    if (!cue || !ctx) return;
    const buf = this.buffers.get(`${cue.sound}|${JSON.stringify(cue.params ?? {})}`);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = cue.gain;
    // Stereo placement (StereoPannerNode uses the same equal-power law as our exports).
    const pan = cuePan(cue, this.ad);
    if (pan !== 0 && typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      src.connect(g).connect(p).connect(ctx.destination);
    } else {
      src.connect(g).connect(ctx.destination);
    }
    src.start(Math.max(ctx.currentTime, whenCtx));
  }

  private async playCueNow(cueId: string) {
    if (this.opts.muted) return;
    const ctx = await this.ensureAudio();
    if (ctx) this.playBuffer(cueId, ctx.currentTime);
  }

  /** Schedules cues falling within the look-ahead window, once per loop iteration. */
  private scheduleAudio(elapsed: number) {
    const ctx = this.audio;
    if (this.opts.muted || !ctx || ctx.state !== "running") return;
    const d = this.ad.timeline.duration;
    const speed = this.opts.speed ?? 1;
    const end = Math.min(elapsed + LOOKAHEAD_MS * speed, totalDuration(this.ad.timeline));
    for (const cue of this.ad.sounds) {
      // Only cues triggered by the timeline itself; interaction cues play on demand.
      if (this.ad.interactions.some((i) => i.action === "playSound" && i.cue === cue.id && i.on !== "load")) continue;
      const ct = cueTime(cue, this.ad.timeline);
      const firstIter = Math.floor(elapsed / d);
      for (let iter = firstIter; iter <= Math.floor(end / d); iter++) {
        const at = iter * d + ct;
        if (at < elapsed - 1 || at > end) continue;
        const key = `${cue.id}@${iter}`;
        if (this.scheduled.has(key)) continue;
        this.scheduled.add(key);
        this.playBuffer(cue.id, ctx.currentTime + (at - elapsed) / speed / 1000);
      }
    }
  }
}
