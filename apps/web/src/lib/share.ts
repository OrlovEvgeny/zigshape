// Local-first share encoding.  All state lives in `location.hash`, which
// browsers do NOT send to servers (so even when this site is later hosted,
// pasted samples never leave the client).
//
// Two modes:
//   #c=<base64url(JSON)>   config-only — small, default share-button output
//   #s=<base64url(JSON)>   config + samples — falls back when payloads fit
//                          under the size guard (8 KB), errors out otherwise.

import type { PresetId } from "./presets";
import type { Format } from "@zigshape/core";

export type SharedConfig = {
  rootName: string;
  target: "plain" | "serde-zig";
  format: "auto" | Format;
  presetId: PresetId;
};

export type SharedState = SharedConfig & {
  samples?: string[];
};

export const SIZE_GUARD_BYTES = 8 * 1024;

export class ShareTooLargeError extends Error {
  constructor(public readonly size: number) {
    super(`shared payload is ${size} bytes (max ${SIZE_GUARD_BYTES})`);
    this.name = "ShareTooLargeError";
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const pad = (4 - (text.length % 4)) % 4;
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function encodeShareConfig(c: SharedConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(c));
  return "#c=" + toBase64Url(bytes);
}

export function encodeShareWithSamples(s: SharedState): string {
  const json = JSON.stringify(s);
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > SIZE_GUARD_BYTES) {
    throw new ShareTooLargeError(bytes.length);
  }
  return "#s=" + toBase64Url(bytes);
}

export function decodeShareHash(hash: string): SharedState | null {
  const trimmed = hash.replace(/^#/, "");
  if (!trimmed) return null;
  const eq = trimmed.indexOf("=");
  if (eq < 0) return null;
  const tag = trimmed.slice(0, eq);
  const data = trimmed.slice(eq + 1);
  if (tag !== "c" && tag !== "s") return null;
  let json: string;
  try {
    json = new TextDecoder().decode(fromBase64Url(data));
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const s = parsed as Partial<SharedState>;
  if (typeof s.rootName !== "string") return null;
  if (s.target !== "plain" && s.target !== "serde-zig") return null;
  if (
    s.format !== "auto" &&
    s.format !== "json" &&
    s.format !== "yaml" &&
    s.format !== "toml" &&
    s.format !== "xml"
  ) {
    return null;
  }
  if (typeof s.presetId !== "string") return null;
  const out: SharedState = {
    rootName: s.rootName,
    target: s.target,
    format: s.format,
    presetId: s.presetId as PresetId,
  };
  if (Array.isArray(s.samples) && s.samples.every((x) => typeof x === "string")) {
    out.samples = s.samples;
  }
  return out;
}
