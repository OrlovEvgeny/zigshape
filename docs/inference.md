# Inference rules

This page documents what triggers each shape decision the v0.2 pipeline can make. The defaults are tuned for the **API response** preset; presets and CLI flags adjust the thresholds.

## Integer width

Default: `--int smallest`. Picks the narrowest Zig type that holds every observed value across all samples.

| Observed range            | Zig type |
|---------------------------|----------|
| `[0, 255]`                | `u8`     |
| `[0, 65535]`              | `u16`    |
| `[0, 4294967295]`         | `u32`    |
| `[0, 2^64-1]`             | `u64`    |
| `[-128, 127]`             | `i8`     |
| `[-32768, 32767]`         | `i16`    |
| `[-2^31, 2^31-1]`         | `i32`    |
| anything else (signed)    | `i64`    |

JSON values are re-parsed as `BigInt` from the source text, so widths above `Number.MAX_SAFE_INTEGER` are exact. YAML and TOML go through library parsers that may lose precision past ~2^53.

`--int u64` reverts to the v0.1 behavior (always `u64`, or `i64` if any negative). `--int i64` always emits `i64`.

## Optional fields

A field is rendered as `?T = null` when *either*:
- It's missing in at least one sample (the parent object was observed without it).
- It was observed as `null` at least once.

The inspector shows the exact reason (`missing`, `null`, or `missing-and-null`).

## Map detection

An object becomes `std.StringHashMap(V)` when:
- It has at least 4 fields (`--maps` threshold; default fixed for v0.2).
- All field values share the same shape.
- The keys look dynamic: at least one non-identifier character, or all keys are pure digits, or all keys look like UUIDs.

Identifier-only keys (`alice`, `bob`) keep the object as a struct.

## Enum suggestion

Default: `--enums auto`. A string field becomes `enum { ... }` when:
- Observation count ≥ 3.
- Distinct value count ≤ 8.
- Distinct-to-total ratio < 0.6 (i.e. values repeat).
- All distinct values sanitize to plain Zig identifiers (no `@"…"` escaping).

`--enums always` ignores the threshold and emits enums for any low-cardinality string field, including ones that need `@"…"`. `--enums off` keeps strings as `[]const u8`.

When variant names differ from the wire values (`in_progress` ← `in-progress`), the serde target attaches `pub const serde = .{ .rename_all = ... }` if a single convention covers all variants, or per-variant `.rename = .{ ... }` otherwise.

## Tagged union inference

Opt-in via `--unions internal|external|adjacent|untagged` (`tagged` is accepted as a back-compat alias for `internal`). Detection triggers when:
- The shape is an array of objects.
- A discriminator field is present in every object as a string.
- At least 2 distinct discriminator values exist.

Preferred discriminator names (in order): `type`, `kind`, `_type`, `_tag`, `__typename`. Falls back to any string field meeting the criteria, preferring the one with the most distinct values.

For each distinct tag value, the corresponding variant struct is the union of fields observed when that tag is present (minus the tag field itself). The serde target emits a `pub const serde = ...` block keyed by the chosen tagging style:

```zig
// --unions internal (default once enabled)
pub const serde = .{ .tag = serde.UnionTag.internal, .tag_field = "type" };

// --unions external
pub const serde = .{ .tag = serde.UnionTag.external };

// --unions adjacent
pub const serde = .{
    .tag = serde.UnionTag.adjacent,
    .tag_field = "type",
    .content_field = "data",
};

// --unions untagged
pub const serde = .{ .tag = serde.UnionTag.untagged };
```

Untagged unions emit `infer.union_untagged_overlap` when two variant bodies are structurally identical — serde.zig cannot disambiguate them at runtime.

Default `--unions off` keeps the v0.1 behavior: heterogeneous arrays fall back to `std.json.Value`.

## String-shape hints

Independent of enum suggestion, `infer.string_shape` fires whenever every observed value of a string field matches the same recognisable shape: ISO-8601 datetime, UUID, URL, or email. The emitted Zig type is unchanged (`[]const u8`); only the diagnostic surfaces the hint. Use a per-field override (`zigshape.json` `overrides[$.path].type`) to swap in a custom adapter type.

## Heterogeneous fallback

When a field is observed as multiple incompatible kinds (e.g. `string | int`), the type becomes `std.json.Value` with a warning. The mixed `int + float` case is special-cased to `f64` (without falling back).

## Array codegen

Default: `--arrays slice` → `[]const T`. `--arrays arraylist` emits
`std.ArrayList(T)` for owned/builder patterns. `--arrays fixed` emits
`[N]T` only when every observation of the array has the same length `N`;
otherwise it falls back to `[]const T` and emits the
`infer.fixed_length_unstable` warning.

Nested arrays follow the same strategy at every level.

## Forced rename_all

The serde target normally emits `.rename_all` only when one convention
round-trips every renamed field exactly. `--rename-all <CONV>` skips the
detection and pins the chosen convention. Fields that don't round-trip
through it (escaped identifiers, keyword escapes, or wires that simply
don't fit) get explicit `.rename` entries that override the
`rename_all`. `--rename-all none` disables auto-detection entirely so
every renamed field gets explicit `.rename`.

## Naming engine

Field names are sanitized:
- camelCase / PascalCase / kebab-case / SCREAMING_SNAKE → `snake_case`.
- Reserved Zig keyword (`type`, `pub`, `fn`, …) → suffix `_`.
- Invalid identifier (starts with digit, contains spaces) → `@"original"` syntax.
- Collisions after sanitization → suffix `_2`, `_3` deterministically.

Struct names are derived from the field's PascalCase name. Array element struct names are singularized with a naive trailing-`s` strip (`users` → `User`, `entries` → `Entry`).

The serde decorator detects when a single naming convention round-trips every renamed field exactly and emits `.rename_all = serde.NamingConvention.<convention>` instead of per-field `.rename`. Fields with a trailing `_` (keyword escape) and `@"…"`-escaped fields always get explicit `.rename` entries.

## Doc comments

YAML mapping pair comments (`# ...` lines that immediately precede a key)
are captured at parse time and surfaced as `///` doc comments on the
matching struct fields when the generator's `withDocComments` option is on
(`--with-doc-comments` on the CLI, the *YAML doc comments* toggle in the
web playground). JSON, TOML, and XML parsers don't expose comments, so the
flag is a no-op for those inputs.

## Nested struct hoisting

Every nested object becomes its own top-level `pub const X = struct { ... };`
declaration, named after the containing field's PascalCase form (or its
singularised array element form). There's no inline-vs-hoisted toggle —
hoisting is unconditional, which keeps recursive types and shared sub-shapes
simple to reference and to override.

## What's deferred

- Alias detection across samples (different keys for the same field) — v1.0.
- `deny_unknown_fields`, `flatten`, `skip` — v1.0 with the broader serde feature pass.
- XML attributes / mixed content / namespaces — v0.3.
- Editable per-field overrides — v1.0.
