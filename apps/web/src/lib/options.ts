// Every knob the web playground exposes beyond the toolbar.  A preset fills
// in all of them; the Options panel records only the knobs the user moved
// away from the preset ("edits"), so switching presets stays predictable
// and share links stay short.  Names and values mirror the CLI flags.

import { DEFAULT_OPTIONS, type Format, type ZigshapeOptions } from "@zigshape/core";
import type { RenameAllStrategy } from "@zigshape/serde-zig";
import { PRESETS, type PresetId } from "./presets";

export type WebOptions = Pick<
  ZigshapeOptions,
  | "intStrategy"
  | "strings"
  | "arrays"
  | "maps"
  | "enums"
  | "unions"
  | "aliases"
  | "defaultsFromSamples"
  | "treatRootArrayAsSamples"
> & {
  /** `auto` picks the fallback the target can parse; see resolveTargetOptions. */
  unknown: ZigshapeOptions["unknown"] | "auto";
  /** `auto` follows the target: wire keys for std.json, snake_case for serde.zig. */
  fieldNames: ZigshapeOptions["fieldNames"] | "auto";
  renameAll: RenameAllStrategy;
  denyUnknownFields: boolean;
  withDocComments: boolean;
};

export type OptionKey = keyof WebOptions;
export type OptionEdits = Partial<WebOptions>;

type Choice = { value: string; label: string };

export type OptionField =
  | { key: OptionKey; kind: "select"; label: string; help: string; flag: string; choices: Choice[] }
  | { key: OptionKey; kind: "toggle"; label: string; help: string; flag: string };

export type OptionGroup = { id: "infer" | "serde" | "output"; title: string; fields: OptionField[] };

export const OPTION_GROUPS: OptionGroup[] = [
  {
    id: "infer",
    title: "Inference",
    fields: [
      {
        key: "intStrategy", kind: "select", label: "Integers", flag: "--int",
        help: "smallest picks the narrowest width that fits every observed value.",
        choices: [
          { value: "smallest", label: "smallest fit" },
          { value: "u64", label: "u64 / i64" },
          { value: "i64", label: "i64" },
          { value: "usize", label: "usize / isize" },
        ],
      },
      {
        key: "strings", kind: "select", label: "Strings", flag: "--strings",
        help: "Wire form for string fields.",
        choices: [
          { value: "slice", label: "[]const u8" },
          { value: "mut", label: "[]u8" },
          { value: "sentinel", label: "[:0]const u8" },
        ],
      },
      {
        key: "arrays", kind: "select", label: "Arrays", flag: "--arrays",
        help: "fixed emits [N]T only when every sample has the same length.",
        choices: [
          { value: "slice", label: "[]const T" },
          { value: "arraylist", label: "std.ArrayList(T)" },
          { value: "fixed", label: "[N]T when stable" },
        ],
      },
      {
        key: "maps", kind: "select", label: "Maps", flag: "--maps",
        help: "When objects with dynamic keys become std.StringHashMap.",
        choices: [
          { value: "auto", label: "auto-detect" },
          { value: "struct", label: "always struct" },
          { value: "hash-map", label: "StringHashMap" },
        ],
      },
      {
        key: "enums", kind: "select", label: "Enums", flag: "--enums",
        help: "Turn small sets of repeated strings into enums.",
        choices: [
          { value: "auto", label: "auto" },
          { value: "off", label: "off" },
          { value: "always", label: "always" },
        ],
      },
      {
        key: "unions", kind: "select", label: "Tagged unions", flag: "--unions",
        help: "Detect discriminated objects; the value is the serde tagging style.",
        choices: [
          { value: "off", label: "off" },
          { value: "internal", label: "internal" },
          { value: "external", label: "external" },
          { value: "adjacent", label: "adjacent" },
          { value: "untagged", label: "untagged" },
        ],
      },
      {
        key: "unknown", kind: "select", label: "Unknown shapes", flag: "--unknown",
        help: "Fallback for only-null or mixed-scalar fields. auto: std.json.Value for plain, ?serde.Value for serde.zig.",
        choices: [
          { value: "auto", label: "auto (by target)" },
          { value: "std-json-value", label: "std.json.Value" },
          { value: "serde-value", label: "serde.Value" },
          { value: "string", label: "[]const u8" },
          { value: "compile-error", label: "@compileError" },
        ],
      },
      {
        key: "defaultsFromSamples", kind: "toggle", label: "Defaults from samples", flag: "--defaults-from-samples",
        help: "Emit observed scalar values as field defaults.",
      },
      {
        key: "treatRootArrayAsSamples", kind: "toggle", label: "Root array as samples", flag: "--samples-from-array",
        help: "Each item of a top-level array counts as its own sample.",
      },
    ],
  },
  {
    id: "serde",
    title: "serde.zig",
    fields: [
      {
        key: "renameAll", kind: "select", label: "rename_all", flag: "--rename-all",
        help: "auto emits a convention only when it round-trips every key.",
        choices: [
          { value: "auto", label: "auto-detect" },
          { value: "none", label: "none (per-field)" },
          { value: "snake_case", label: "snake_case" },
          { value: "camel_case", label: "camelCase" },
          { value: "pascal_case", label: "PascalCase" },
          { value: "kebab_case", label: "kebab-case" },
          { value: "screaming_snake", label: "SCREAMING_SNAKE" },
        ],
      },
      {
        key: "aliases", kind: "select", label: "Aliases", flag: "--aliases",
        help: "Collapse sibling keys that never co-occur across samples into one field with serde.zig aliases.",
        choices: [
          { value: "auto", label: "auto" },
          { value: "off", label: "off" },
        ],
      },
      {
        key: "denyUnknownFields", kind: "toggle", label: "deny_unknown_fields", flag: "--deny-unknown-fields",
        help: "Reject payloads with keys the struct doesn't declare.",
      },
    ],
  },
  {
    id: "output",
    title: "Output",
    fields: [
      {
        key: "fieldNames", kind: "select", label: "Field names", flag: "--field-names",
        help: "auto: the wire keys for plain (std.json has no rename), snake_case + serde rename for serde.zig.",
        choices: [
          { value: "auto", label: "auto (by target)" },
          { value: "snake_case", label: "snake_case" },
          { value: "wire", label: "as on the wire" },
        ],
      },
      {
        key: "withDocComments", kind: "toggle", label: "Doc comments from YAML", flag: "--with-doc-comments",
        help: "Turn YAML key comments into /// lines above fields.",
      },
    ],
  },
];

/** Knobs that only mean something for the serde.zig target. */
const SERDE_ONLY = new Set<OptionKey>(OPTION_GROUPS.find((g) => g.id === "serde")!.fields.map((f) => f.key));

const FIELDS = new Map(OPTION_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f] as const)));

const BASE: WebOptions = {
  intStrategy: DEFAULT_OPTIONS.intStrategy,
  strings: DEFAULT_OPTIONS.strings,
  arrays: DEFAULT_OPTIONS.arrays,
  maps: DEFAULT_OPTIONS.maps,
  enums: DEFAULT_OPTIONS.enums,
  unions: DEFAULT_OPTIONS.unions,
  unknown: "auto",
  aliases: DEFAULT_OPTIONS.aliases,
  fieldNames: "auto",
  defaultsFromSamples: DEFAULT_OPTIONS.defaultsFromSamples,
  treatRootArrayAsSamples: DEFAULT_OPTIONS.treatRootArrayAsSamples,
  renameAll: "auto",
  denyUnknownFields: false,
  withDocComments: false,
};

/** Full option set for a preset, before any user edits. */
export function presetOptions(id: PresetId): WebOptions {
  const preset = PRESETS.find((p) => p.id === id)?.options ?? {};
  const out: WebOptions = { ...BASE };
  for (const key of Object.keys(BASE) as OptionKey[]) {
    if (key in preset) (out as Record<string, unknown>)[key] = (preset as Record<string, unknown>)[key];
  }
  return out;
}

/** Record `value` for `key`, dropping the edit when it matches the preset. */
export function applyEdit<K extends OptionKey>(
  edits: OptionEdits,
  preset: WebOptions,
  key: K,
  value: WebOptions[K],
): OptionEdits {
  const next = { ...edits };
  if (preset[key] === value) delete next[key];
  else next[key] = value;
  return next;
}

/** Keep only known keys with allowed values.  Used on share-link input. */
export function sanitizeEdits(raw: unknown): OptionEdits {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const field = FIELDS.get(key as OptionKey);
    if (!field) continue;
    if (field.kind === "toggle" && typeof value === "boolean") out[key] = value;
    if (field.kind === "select" && field.choices.some((c) => c.value === value)) out[key] = value;
  }
  return out as OptionEdits;
}

/** The CLI invocation that reproduces the playground output. */
export function cliCommand(
  opts: WebOptions,
  ctx: { format: "auto" | Format; target: "plain" | "serde-zig"; rootName: string },
): string {
  const ext = ctx.format === "auto" ? "json" : ctx.format === "ndjson" ? "ndjson" : ctx.format;
  const parts = ["zigshape", `sample.${ext}`];
  if (ctx.format !== "auto") parts.push("--format", ctx.format);
  if (ctx.rootName !== "Root") parts.push("--root", ctx.rootName);
  if (ctx.target !== "plain") parts.push("--target", ctx.target);
  for (const field of FIELDS.values()) {
    const value = opts[field.key];
    if (value === BASE[field.key]) continue;
    if (value === "auto") continue;
    if (SERDE_ONLY.has(field.key) && ctx.target !== "serde-zig") continue;
    if (field.kind === "toggle") {
      if (value === true) parts.push(field.flag);
    } else {
      parts.push(field.flag, String(value));
    }
  }
  parts.push("--zig-fmt");
  return parts.join(" ");
}

/** Core options for a target.  std.json can't read std.StringHashMap, has
 *  neither rename nor alias, and serde.zig can't read std.json.Value, so
 *  these follow the target unless the user picked something. */
export function resolveTargetOptions(opts: WebOptions, target: "plain" | "serde-zig") {
  const serde = target === "serde-zig";
  return {
    intStrategy: opts.intStrategy,
    strings: opts.strings,
    arrays: opts.arrays,
    maps: opts.maps,
    enums: opts.enums,
    unions: opts.unions,
    defaultsFromSamples: opts.defaultsFromSamples,
    treatRootArrayAsSamples: opts.treatRootArrayAsSamples,
    unknown: opts.unknown === "auto" ? (serde ? "serde-value" : "std-json-value") : opts.unknown,
    fieldNames: opts.fieldNames === "auto" ? (serde ? "snake_case" : "wire") : opts.fieldNames,
    aliases: serde ? opts.aliases : "off",
    mapType: serde ? "string-hash-map" : "json-array-hash-map",
  } satisfies Partial<ZigshapeOptions>;
}
