import { AssetPlayer } from "./index";
import { isAssetDefinition, withDefaults } from "./validate-lite";

/**
 * <daos-asset> Web Component.
 *
 *   <daos-asset autoplay speed="1" tokens='{"primary":"#FF0066"}'>
 *     <script type="application/json">{ …Asset Definition… }</script>
 *   </daos-asset>
 *
 * Attributes: autoplay, muted (default on; sound needs a user click), speed, size,
 * tokens (JSON color overrides), src (URL of an Asset Definition JSON).
 * Methods: play(), pause(), restart(), unmute().
 * The definition is validated before anything is rendered.
 */
export class DaosAssetElement extends HTMLElement {
  private player: AssetPlayer | null = null;

  static get observedAttributes() {
    return ["speed", "tokens"];
  }

  async connectedCallback() {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = ":host{display:inline-block;line-height:0}svg{width:100%;height:auto}";
    root.appendChild(style);
    let raw: unknown;
    const src = this.getAttribute("src");
    try {
      if (src) raw = await (await fetch(src)).json();
      else raw = JSON.parse(this.querySelector('script[type="application/json"]')?.textContent ?? "null");
    } catch {
      raw = null;
    }
    if (!isAssetDefinition(raw)) {
      this.setAttribute("data-error", "invalid-asset");
      return;
    }
    const sounds = this.querySelector('script[type="application/daos-sounds+json"]')?.textContent;
    this.player = new AssetPlayer(root, withDefaults(raw), {
      autoplay: this.hasAttribute("autoplay"),
      speed: Number(this.getAttribute("speed") ?? 1) || 1,
      size: this.hasAttribute("size") ? Number(this.getAttribute("size")) : undefined,
      tokens: this.readTokens(),
      muted: true,
      soundUrls: sounds ? safeJson(sounds) : undefined,
    });
  }

  disconnectedCallback() {
    this.player?.destroy();
    this.player = null;
  }

  attributeChangedCallback(name: string) {
    if (!this.player) return;
    if (name === "speed") this.player.setSpeed(Number(this.getAttribute("speed") ?? 1) || 1);
    if (name === "tokens") this.player.setTokens(this.readTokens() ?? {});
  }

  private readTokens(): Record<string, string> | undefined {
    const t = this.getAttribute("tokens");
    return t ? safeJson(t) : undefined;
  }

  play() {
    this.player?.play();
  }
  pause() {
    this.player?.pause();
  }
  restart() {
    this.player?.restart();
  }
  /** Call from a click/tap handler. */
  unmute() {
    return this.player?.setMuted(false);
  }
}

function safeJson<T>(s: string): T | undefined {
  try {
    return JSON.parse(s) as T;
  } catch {
    return undefined;
  }
}

export function defineDaosAsset(tag = "daos-asset") {
  if (typeof customElements !== "undefined" && !customElements.get(tag)) customElements.define(tag, DaosAssetElement);
}
