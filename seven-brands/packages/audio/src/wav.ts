/** 16-bit PCM WAV encode/decode (mono or interleaved stereo). */

export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const n = channels[0]?.length ?? 0;
  const ch = channels.length;
  if (ch < 1 || ch > 2) throw new Error("encodeWav supports 1 or 2 channels");
  const dataBytes = n * ch * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c]![i]!));
      v.setInt16(o, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}

export interface DecodedWav {
  sampleRate: number;
  channels: Float32Array[];
}

export function decodeWav(bytes: Uint8Array): DecodedWav {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (bytes.byteLength < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Not a WAV file");
  let o = 12;
  let fmt: { ch: number; sr: number; bits: number; format: number } | null = null;
  while (o + 8 <= bytes.byteLength) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    const body = o + 8;
    if (id === "fmt ") {
      fmt = { format: v.getUint16(body, true), ch: v.getUint16(body + 2, true), sr: v.getUint32(body + 4, true), bits: v.getUint16(body + 14, true) };
    } else if (id === "data") {
      if (!fmt) throw new Error("WAV data before fmt chunk");
      if (fmt.format !== 1 || fmt.bits !== 16) throw new Error("Only 16-bit PCM WAV is supported");
      const frames = Math.floor(Math.min(size, bytes.byteLength - body) / (2 * fmt.ch));
      const channels = Array.from({ length: fmt.ch }, () => new Float32Array(frames));
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < fmt.ch; c++) {
          channels[c]![i] = v.getInt16(body + (i * fmt.ch + c) * 2, true) / 0x8000;
        }
      }
      return { sampleRate: fmt.sr, channels };
    }
    o = body + size + (size % 2);
  }
  throw new Error("WAV file has no data chunk");
}
