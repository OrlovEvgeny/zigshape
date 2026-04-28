# Limitations

What zigshape cannot infer perfectly today, why, and what to do about it.

## Datetimes are strings

JSON has no native datetime type. YAML can parse a scalar as a Date depending on schema. TOML has dedicated datetime literals. zigshape emits `[]const u8` for all of them.

The `infer.string_shape` warning fires when every observed value of a field matches a recognisable shape — ISO-8601 datetime, UUID, URL, or email. The type stays `[]const u8`; only the warning surfaces the hint, so the inferred wire shape is never silently changed.

**Workaround:** override the field via the inspector or `zigshape.json`:
```json
{ "overrides": { "$.profile.created_at": { "type": "MyDateTime" } } }
```

## Integer width is observation-bound

If your samples only ever contain `42`, zigshape cannot tell whether the wire shape is `u8` / `u32` / `u64` / `usize`. The default is the smallest unsigned width that fits every observed value across all samples — which means a `1` in every sample collapses to `u8`.

**Workarounds:**
- Pass `--int u64` (or `--int i64`) for conservative widening.
- Override per-field: `{ "overrides": { "$.id": { "type": "u32" } } }`.
- Add a sample with the maximum value the wire format actually allows.

## TOML / XML source ranges are whole-document

YAML and JSON expose per-node positions via their parsers, so the inspector highlights precise ranges. TOML (smol-toml) and XML (fast-xml-parser) do not — every path maps to the whole-document range. The inspector still works (it scrolls to the start of the input) but the highlight is coarse.

Tracked as a v1.1 follow-up; would require a hand-rolled span tracker for both formats.

## XML mixed content (attributes + text body)

`<description lang="en">Hello</description>` is mixed: `lang` is an attribute, `Hello` is the text body. serde.zig documents `xml_attribute` and `xml_root` but does not yet document a text-node mapping. zigshape generates a `value` field plus a `// TODO:` comment so the user explicitly verifies the wire behavior.

## NDJSON / array-of-samples confidence

When the root of a sample is an array, zigshape needs to know whether the array IS the data (becomes `[]const T`) or whether the array's elements are *samples* of T. The pipeline picks the second interpretation only when:
- `--format ndjson`, or
- `--samples-from-array` is explicitly passed.

This avoids guessing the wrong interpretation for genuine list-shaped APIs.

## `union(enum)` tagging styles

serde.zig supports four tagging styles: `internal`, `external`, `adjacent`, `untagged`. All four are reachable via the `--unions` flag (`internal` remains the default and the legacy `--unions tagged` is accepted as an alias). The `infer.union_untagged_overlap` warning fires when two variant bodies are structurally identical — at runtime serde.zig cannot disambiguate them.

The shape-detection trigger is the same for all four styles (a discriminator string field present in every array element); the flag only changes how the `pub const serde = .{ .tag = serde.UnionTag.<x>, ... }` block is emitted. Adjacent tagging emits `.content_field = "data"` by default; override the field path in `zigshape.json` if you need a different content field name.

## Enum suggestion is a heuristic

`--enums auto` requires at least 3 string observations, ≤8 distinct values, and a low distinct-to-total ratio. False positives are possible (e.g. when 5 different users have the same locale). False negatives happen on small sample sets. Use `--enums always` to force, `--enums off` to disable, or override the field type.

## Privacy — what leaves your machine

- **Web playground**: nothing. Samples stay in the browser. Share links use the URL hash, which browsers don't send to servers. The "Fetch URL" button is the only network call zigshape makes; it goes directly to the URL you typed and is subject to that origin's CORS policy.
- **CLI**: nothing, unless you pass an http(s) URL as an argument.
- **VS Code extension**: nothing. Inference and decoration both run inside the extension host.
