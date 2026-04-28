#!/usr/bin/env bun
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  buildReport,
  diffReports,
  emitBuildSnippet,
  emitParserHelper,
  emitTestScaffold,
  formatDrift,
  generateZig,
  runPipeline,
  type AliasStrategy,
  type ArrayStrategy,
  type EnumStrategy,
  type Format,
  type GenerateOptions,
  type IntStrategy,
  type MapStrategy,
  type Overrides,
  type SchemaReport,
  type StringStrategy,
  type UnionStrategy,
  type UnknownStrategy,
  type ZigshapeOptions,
} from "@zigshape/core";
import { serdeDecorator, type RenameAllStrategy } from "@zigshape/serde-zig";
import { loadConfig } from "./config";

type Target = "plain" | "serde-zig";
type FormatArg = "auto" | Format;

type Args = {
  files: string[];
  rootName: string;
  target: Target;
  format: FormatArg;
  intStrategy: IntStrategy;
  stringStrategy: StringStrategy;
  mapStrategy: MapStrategy;
  arrayStrategy: ArrayStrategy;
  unknownStrategy: UnknownStrategy;
  enums: EnumStrategy;
  unions: UnionStrategy;
  aliases: AliasStrategy;
  renameAll: RenameAllStrategy;
  denyUnknownFields: boolean;
  samplesFromArray: boolean;
  defaultsFromSamples: boolean;
  withParser: boolean;
  withTests: boolean;
  withBuildSnippet: boolean;
  withDocComments: boolean;
  zigFmt: boolean;
  out: string | null;
  reportOut: string | null;
  checkDrift: string | null;
  config: string | null;
  stdin: boolean;
  help: boolean;
  /** True iff the user explicitly passed the corresponding flag.  Used so
   *  config-file values fill in only the gaps, never override explicit CLI. */
  explicit: Set<keyof Args>;
};

const HELP = `zigshape — generate Zig structs from JSON / YAML / TOML / XML

Usage:
  zigshape <file-or-dir-or-url>... [options]
  zigshape --stdin   [options]

Directory args are walked recursively; files matching the active --format
extension(s) become samples (each file = one sample). With --format auto,
.json / .ndjson / .yaml / .yml / .toml / .xml are picked up.

Input options:
  --format auto|json|ndjson|yaml|toml|xml
                                     Input format. Default: auto.
  --stdin                            Read a single sample from stdin.
  --samples-from-array               Treat each top-level array item as a
                                     separate sample (NDJSON-style).
  http(s)://… arguments are fetched at run-time before parsing.

Output options:
  --root NAME                    Struct name for the root type. Default: Root.
  --target plain|serde-zig       Codegen target. Default: plain.
  --out PATH                     Write Zig to PATH instead of stdout.
  --zig-fmt                      Run generated code through zig fmt (WASM).
  --report PATH                  Write a JSON schema report to PATH.
  --check-drift PATH             Compare current schema to the report at PATH;
                                 exit 3 if there is any breaking drift.
  --config PATH                  Load defaults and overrides from zigshape.json.
  --with-parser                  Append a parse<Root>(...) helper that wraps
                                 std.json.parseFromSlice or
                                 serde.<format>.fromSlice for the resolved
                                 input format.
  --with-tests                   Append a test "parse <Root>" scaffold using
                                 the first sample as input.
  --with-build-snippet           Prepend a build.zig comment block describing
                                 dependency wiring (no-op for plain target).
  --with-doc-comments            Surface YAML key comments as /// doc
                                 comments above the matching struct fields.
                                 No-op for JSON / TOML / XML — those parsers
                                 don't expose comments.

Inference options:
  --int smallest|u64|i64|usize   Integer width strategy. Default: smallest.
                                 usize emits usize for non-negative
                                 observations and isize when any sample
                                 was negative.
  --strings slice|mut|sentinel   String wire form. slice = []const u8 (default).
  --maps auto|struct|hash-map    Map detection override. Default: auto.
  --arrays slice|arraylist|fixed Array codegen strategy.  slice = []const T
                                 (default). arraylist = std.ArrayList(T).
                                 fixed = [N]T when every observation has the
                                 same length, else falls back to slice with
                                 the infer.fixed_length_unstable warning.
  --unknown CONV                 Strategy for shapes inference can't pin down
                                 (only-null / heterogeneous mixed scalars).
                                 CONV is std-json-value (default),
                                 serde-value, string, or compile-error.
  --rename-all CONV              Force a serde naming convention instead of
                                 the auto-detect heuristic. CONV is one of
                                 auto (default), none, snake_case,
                                 camel_case, pascal_case, kebab_case,
                                 screaming_snake.  serde-zig target only.
  --enums auto|off|always        Enum suggestion. Default: auto.
  --unions off|internal|external|adjacent|untagged
                                 Tagged-union inference + serde tagging
                                 style. Default: off. 'tagged' is accepted
                                 as a back-compat alias for 'internal'.
  --aliases auto|off             Cross-sample alias detection. Default: auto.
  --deny-unknown-fields          Emit serde .deny_unknown_fields = true.
  --defaults-from-samples        Emit observed scalar values as Zig defaults.

Other:
  -h, --help                     Show this help.

Notes:
  Multiple files are merged as samples of the same shape — fields that
  appear in only some samples become optional.
`;

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    files: [],
    rootName: "Root",
    target: "plain",
    format: "auto",
    intStrategy: "smallest",
    stringStrategy: "slice",
    mapStrategy: "auto",
    arrayStrategy: "slice",
    unknownStrategy: "std-json-value",
    enums: "auto",
    unions: "off",
    aliases: "auto",
    renameAll: "auto",
    denyUnknownFields: false,
    samplesFromArray: false,
    defaultsFromSamples: false,
    withParser: false,
    withTests: false,
    withBuildSnippet: false,
    withDocComments: false,
    zigFmt: false,
    out: null,
    reportOut: null,
    checkDrift: null,
    config: null,
    stdin: false,
    help: false,
    explicit: new Set(),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const eq = a.indexOf("=");
    const flag = a.startsWith("--") && eq !== -1 ? a.slice(0, eq) : a;
    const inline = a.startsWith("--") && eq !== -1 ? a.slice(eq + 1) : null;
    const next = () => inline ?? argv[++i];

    switch (flag) {
      case "--root":
        args.rootName = next() ?? args.rootName;
        args.explicit.add("rootName");
        break;
      case "--target": {
        const t = next() as Target | undefined;
        if (t !== "plain" && t !== "serde-zig") {
          throw new Error(`--target must be 'plain' or 'serde-zig' (got '${t}')`);
        }
        args.target = t;
        args.explicit.add("target");
        break;
      }
      case "--format": {
        const f = next() as FormatArg | undefined;
        if (
          f !== "auto" &&
          f !== "json" &&
          f !== "ndjson" &&
          f !== "yaml" &&
          f !== "toml" &&
          f !== "xml"
        ) {
          throw new Error(`--format must be auto|json|ndjson|yaml|toml|xml (got '${f}')`);
        }
        args.format = f;
        args.explicit.add("format");
        break;
      }
      case "--int": {
        const v = next() as IntStrategy | undefined;
        if (v !== "smallest" && v !== "u64" && v !== "i64" && v !== "usize") {
          throw new Error(`--int must be smallest|u64|i64|usize (got '${v}')`);
        }
        args.intStrategy = v;
        args.explicit.add("intStrategy");
        break;
      }
      case "--strings": {
        const v = next() as StringStrategy | undefined;
        if (v !== "slice" && v !== "mut" && v !== "sentinel") {
          throw new Error(`--strings must be slice|mut|sentinel (got '${v}')`);
        }
        args.stringStrategy = v;
        args.explicit.add("stringStrategy");
        break;
      }
      case "--maps": {
        const v = next() as MapStrategy | undefined;
        if (v !== "auto" && v !== "struct" && v !== "hash-map") {
          throw new Error(`--maps must be auto|struct|hash-map (got '${v}')`);
        }
        args.mapStrategy = v;
        args.explicit.add("mapStrategy");
        break;
      }
      case "--arrays": {
        const v = next() as ArrayStrategy | undefined;
        if (v !== "slice" && v !== "arraylist" && v !== "fixed") {
          throw new Error(`--arrays must be slice|arraylist|fixed (got '${v}')`);
        }
        args.arrayStrategy = v;
        args.explicit.add("arrayStrategy");
        break;
      }
      case "--unknown": {
        const v = next() as UnknownStrategy | undefined;
        if (
          v !== "std-json-value" &&
          v !== "serde-value" &&
          v !== "string" &&
          v !== "compile-error"
        ) {
          throw new Error(
            `--unknown must be std-json-value|serde-value|string|compile-error (got '${v}')`,
          );
        }
        args.unknownStrategy = v;
        args.explicit.add("unknownStrategy");
        break;
      }
      case "--rename-all": {
        const v = next() as RenameAllStrategy | undefined;
        if (
          v !== "auto" &&
          v !== "none" &&
          v !== "snake_case" &&
          v !== "camel_case" &&
          v !== "pascal_case" &&
          v !== "kebab_case" &&
          v !== "screaming_snake"
        ) {
          throw new Error(
            `--rename-all must be auto|none|snake_case|camel_case|pascal_case|kebab_case|screaming_snake (got '${v}')`,
          );
        }
        args.renameAll = v;
        args.explicit.add("renameAll");
        break;
      }
      case "--enums": {
        const v = next() as EnumStrategy | undefined;
        if (v !== "auto" && v !== "off" && v !== "always") {
          throw new Error(`--enums must be auto|off|always (got '${v}')`);
        }
        args.enums = v;
        args.explicit.add("enums");
        break;
      }
      case "--unions": {
        const v = next() as UnionStrategy | undefined;
        if (
          v !== "off" &&
          v !== "tagged" &&
          v !== "internal" &&
          v !== "external" &&
          v !== "adjacent" &&
          v !== "untagged"
        ) {
          throw new Error(
            `--unions must be off|internal|external|adjacent|untagged (got '${v}')`,
          );
        }
        args.unions = v;
        args.explicit.add("unions");
        break;
      }
      case "--aliases": {
        const v = next() as AliasStrategy | undefined;
        if (v !== "auto" && v !== "off") {
          throw new Error(`--aliases must be auto|off (got '${v}')`);
        }
        args.aliases = v;
        args.explicit.add("aliases");
        break;
      }
      case "--deny-unknown-fields":
        args.denyUnknownFields = true;
        args.explicit.add("denyUnknownFields");
        break;
      case "--samples-from-array":
        args.samplesFromArray = true;
        args.explicit.add("samplesFromArray");
        break;
      case "--defaults-from-samples":
        args.defaultsFromSamples = true;
        args.explicit.add("defaultsFromSamples");
        break;
      case "--with-parser":
        args.withParser = true;
        args.explicit.add("withParser");
        break;
      case "--with-tests":
        args.withTests = true;
        args.explicit.add("withTests");
        break;
      case "--with-build-snippet":
        args.withBuildSnippet = true;
        args.explicit.add("withBuildSnippet");
        break;
      case "--with-doc-comments":
        args.withDocComments = true;
        args.explicit.add("withDocComments");
        break;
      case "--zig-fmt":
        args.zigFmt = true;
        break;
      case "--out":
        args.out = next() ?? null;
        break;
      case "--report":
        args.reportOut = next() ?? null;
        break;
      case "--check-drift":
        args.checkDrift = next() ?? null;
        break;
      case "--config":
        args.config = next() ?? null;
        break;
      case "--stdin":
        args.stdin = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        if (a.startsWith("-")) throw new Error(`unknown flag: ${a}`);
        args.files.push(a);
        break;
    }
  }
  return args;
}

/** Map of explicit `--format` value to the file extensions that should be
 *  pulled in when walking a directory.  `auto` accepts every recognised
 *  format. */
const DIR_MODE_EXTENSIONS: Record<FormatArg, readonly string[]> = {
  auto: [".json", ".ndjson", ".yaml", ".yml", ".toml", ".xml"],
  json: [".json"],
  ndjson: [".ndjson"],
  yaml: [".yaml", ".yml"],
  toml: [".toml"],
  xml: [".xml"],
};

/** Recursively collect files under a directory whose extensions match the
 *  active format filter.  Sorted for deterministic ordering across runs. */
async function collectFilesUnder(dir: string, format: FormatArg): Promise<string[]> {
  const exts = DIR_MODE_EXTENSIONS[format];
  const out: string[] = [];
  async function walk(d: string): Promise<void> {
    const entries = await readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!e.isFile()) continue;
      const lower = e.name.toLowerCase();
      if (exts.some((x) => lower.endsWith(x))) out.push(full);
    }
  }
  await walk(dir);
  out.sort();
  return out;
}

function severityPrefix(sev: string): string {
  if (sev === "error") return "error";
  if (sev === "warning") return "warning";
  return "info";
}

export async function run(argv: readonly string[]): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`zigshape: ${(e as Error).message}\n`);
    process.stderr.write(HELP);
    return 2;
  }
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }

  let denyUnknownFields = args.denyUnknownFields;
  let overrides: Overrides | undefined;
  let flattenPaths: string[] | undefined;
  let skipPaths: string[] | undefined;
  let renameAll: RenameAllStrategy = args.renameAll;
  if (args.config) {
    try {
      const cfg = await loadConfig(args.config);
      if (cfg.options) {
        if (cfg.options.intStrategy !== undefined && !args.explicit.has("intStrategy")) {
          args.intStrategy = cfg.options.intStrategy;
        }
        if (cfg.options.strings !== undefined && !args.explicit.has("stringStrategy")) {
          args.stringStrategy = cfg.options.strings;
        }
        if (cfg.options.maps !== undefined && !args.explicit.has("mapStrategy")) {
          args.mapStrategy = cfg.options.maps;
        }
        if (cfg.options.arrays !== undefined && !args.explicit.has("arrayStrategy")) {
          args.arrayStrategy = cfg.options.arrays;
        }
        if (cfg.options.enums !== undefined && !args.explicit.has("enums")) {
          args.enums = cfg.options.enums;
        }
        if (cfg.options.unions !== undefined && !args.explicit.has("unions")) {
          args.unions = cfg.options.unions;
        }
        if (cfg.options.aliases !== undefined && !args.explicit.has("aliases")) {
          args.aliases = cfg.options.aliases;
        }
        if (cfg.options.format !== undefined && !args.explicit.has("format")) {
          args.format = cfg.options.format;
        }
        if (
          cfg.options.defaultsFromSamples !== undefined &&
          !args.explicit.has("defaultsFromSamples")
        ) {
          args.defaultsFromSamples = cfg.options.defaultsFromSamples;
        }
        if (
          cfg.options.denyUnknownFields !== undefined &&
          !args.explicit.has("denyUnknownFields")
        ) {
          denyUnknownFields = cfg.options.denyUnknownFields;
        }
      }
      if (cfg.serde?.denyUnknownFields !== undefined && !args.explicit.has("denyUnknownFields")) {
        denyUnknownFields = cfg.serde.denyUnknownFields;
      }
      if (cfg.serde?.flattenPaths && cfg.serde.flattenPaths.length > 0) {
        flattenPaths = cfg.serde.flattenPaths;
      }
      if (cfg.serde?.skipPaths && cfg.serde.skipPaths.length > 0) {
        skipPaths = cfg.serde.skipPaths;
      }
      if (cfg.serde?.renameAll !== undefined && !args.explicit.has("renameAll")) {
        renameAll = cfg.serde.renameAll;
      }
      if (cfg.overrides && Object.keys(cfg.overrides).length > 0) {
        overrides = cfg.overrides;
      }
    } catch (e) {
      process.stderr.write(`zigshape: ${(e as Error).message}\n`);
      return 2;
    }
  }

  let samples: string[];
  if (args.stdin || args.files.length === 0) {
    samples = [await Bun.stdin.text()];
  } else {
    try {
      // Expand any directory args into the matching files under them.  A
      // directory is only valid if `--format` is explicit OR the listed
      // files all match a single recognised extension; otherwise we'd be
      // guessing.  Files passed directly are unfiltered.
      const expanded: string[] = [];
      for (const f of args.files) {
        if (/^https?:\/\//i.test(f)) {
          expanded.push(f);
          continue;
        }
        let isDir = false;
        try {
          isDir = (await stat(f)).isDirectory();
        } catch {
          // Treat unreadable paths as files; the read below surfaces the
          // real error.
        }
        if (!isDir) {
          expanded.push(f);
          continue;
        }
        const matches = await collectFilesUnder(f, args.format);
        if (matches.length === 0) {
          throw new Error(
            `directory ${f}: no files matching ` +
              (args.format === "auto"
                ? "*.json|*.ndjson|*.yaml|*.yml|*.toml|*.xml"
                : `*.${args.format}`) +
              " (pass --format to widen the filter, or list files explicitly)",
          );
        }
        expanded.push(...matches);
      }
      samples = await Promise.all(
        expanded.map(async (f) => {
          if (/^https?:\/\//i.test(f)) {
            // Fetch http(s) URLs at runtime so users can pass an API endpoint
            // directly: `zigshape https://api.example.com/user --root User`.
            // CORS doesn't apply server-side — this is the CLI process, not a
            // browser.
            const resp = await fetch(f);
            if (!resp.ok) {
              throw new Error(`fetch ${f}: HTTP ${resp.status}`);
            }
            return await resp.text();
          }
          return await Bun.file(f).text();
        }),
      );
    } catch (e) {
      process.stderr.write(`zigshape: ${(e as Error).message}\n`);
      return 1;
    }
  }

  const inferOptions: Partial<ZigshapeOptions> = {
    format: args.format,
    intStrategy: args.intStrategy,
    strings: args.stringStrategy,
    maps: args.mapStrategy,
    arrays: args.arrayStrategy,
    unknown: args.unknownStrategy,
    enums: args.enums,
    unions: args.unions,
    aliases: args.aliases,
    treatRootArrayAsSamples: args.samplesFromArray,
    defaultsFromSamples: args.defaultsFromSamples,
  };

  const { normalized, warnings, resolvedFormat } = runPipeline({
    samples,
    rootName: args.rootName,
    inferOptions,
    overrides,
  });

  for (const w of warnings) {
    const path = w.path ? ` ${w.path}` : "";
    process.stderr.write(`${severityPrefix(w.severity)}:${path} ${w.message} [${w.code}]\n`);
  }

  // Mixed-format auto-detect → exit 2 to match the documented behavior, but
  // only when --format auto AND samples actually disagreed.
  if (warnings.some((w) => w.code === "pipeline.mixed_formats")) {
    process.stderr.write(
      "zigshape: samples appear to be in different formats; pass --format explicitly\n",
    );
    return 2;
  }

  if (!normalized) {
    process.stderr.write("zigshape: no parseable samples\n");
    return 1;
  }

  if (args.reportOut) {
    const report = buildReport(normalized, warnings);
    await Bun.write(args.reportOut, JSON.stringify(report, null, 2) + "\n");
  }

  if (args.checkDrift) {
    const next = buildReport(normalized, warnings);
    let prevText: string;
    try {
      prevText = await Bun.file(args.checkDrift).text();
    } catch (e) {
      process.stderr.write(`zigshape: cannot read drift baseline ${args.checkDrift}: ${(e as Error).message}\n`);
      return 2;
    }
    let prev: SchemaReport;
    try {
      prev = JSON.parse(prevText) as SchemaReport;
    } catch (e) {
      process.stderr.write(`zigshape: drift baseline ${args.checkDrift}: ${(e as Error).message}\n`);
      return 2;
    }
    const drift = diffReports(prev, next);
    if (drift.entries.length > 0) {
      process.stderr.write(formatDrift(drift) + "\n");
    }
    if (drift.hasBreaking) {
      process.stderr.write("zigshape: breaking schema drift\n");
      return 3;
    }
  }

  const baseOpts: GenerateOptions =
    args.target === "serde-zig"
      ? serdeDecorator(normalized, {
          denyUnknownFields,
          flattenPaths,
          skipPaths,
          renameAll,
        })
      : {};
  const opts: GenerateOptions = { ...baseOpts, withDocComments: args.withDocComments };
  let code = generateZig(normalized, opts);

  // Append snippets after struct codegen so `zig fmt` (which runs next)
  // sees the entire file.  The build.zig snippet is a comment block; we
  // prepend it so it's the first thing a reader sees.
  if (args.withParser || args.withTests || args.withBuildSnippet) {
    // resolvedFormat is null only when samples disagreed (mixed_formats
    // already exited above) or when the run had no samples.  In those
    // edge cases default to JSON — it's the most common shape and the
    // user can adjust manually.
    const fmt: Format = resolvedFormat ?? "json";
    const stdParseable = fmt === "json" || fmt === "ndjson";
    const snippetUsesStd =
      (args.withParser && (args.target === "serde-zig" || stdParseable)) ||
      (args.withTests && (args.target === "serde-zig" || stdParseable));
    const snippetUsesSerde =
      args.target === "serde-zig" && (args.withParser || args.withTests);
    if (snippetUsesStd && !code.includes('@import("std")')) {
      code = 'const std = @import("std");\n' + code;
    }
    if (snippetUsesSerde && !code.includes('@import("serde")')) {
      code = 'const serde = @import("serde");\n' + code;
    }
    if (args.withParser) {
      code += emitParserHelper(args.rootName, args.target, fmt);
    }
    if (args.withTests && samples.length > 0) {
      code += emitTestScaffold(args.rootName, samples[0]!.trim(), args.target, fmt);
    }
    if (args.withBuildSnippet) {
      code = emitBuildSnippet(args.target) + code;
    }
  }

  if (args.zigFmt) {
    try {
      const { formatZig } = await import("./zigfmt");
      code = await formatZig(code);
    } catch (e) {
      process.stderr.write(
        `warning: --zig-fmt failed (${(e as Error).message}); writing unformatted output\n`,
      );
    }
  }

  if (args.out) {
    await Bun.write(args.out, code);
  } else {
    process.stdout.write(code);
  }
  return 0;
}

if (import.meta.main) {
  run(Bun.argv.slice(2)).then((code) => process.exit(code));
}
