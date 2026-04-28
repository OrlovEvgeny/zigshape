#!/usr/bin/env bun
import {
  buildReport,
  diffReports,
  formatDrift,
  generateZig,
  runPipeline,
  type AliasStrategy,
  type EnumStrategy,
  type Format,
  type GenerateOptions,
  type IntStrategy,
  type MapStrategy,
  type Overrides,
  type SchemaReport,
  type StringStrategy,
  type UnionStrategy,
  type ZigshapeOptions,
} from "@zigshape/core";
import { serdeDecorator } from "@zigshape/serde-zig";
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
  enums: EnumStrategy;
  unions: UnionStrategy;
  aliases: AliasStrategy;
  denyUnknownFields: boolean;
  samplesFromArray: boolean;
  defaultsFromSamples: boolean;
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
  zigshape <file>... [options]
  zigshape --stdin   [options]

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

Inference options:
  --int smallest|u64|i64         Integer width strategy. Default: smallest.
  --strings slice|mut|sentinel   String wire form. slice = []const u8 (default).
  --maps auto|struct|hash-map    Map detection override. Default: auto.
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
    enums: "auto",
    unions: "off",
    aliases: "auto",
    denyUnknownFields: false,
    samplesFromArray: false,
    defaultsFromSamples: false,
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
        if (v !== "smallest" && v !== "u64" && v !== "i64") {
          throw new Error(`--int must be smallest|u64|i64 (got '${v}')`);
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
      samples = await Promise.all(
        args.files.map(async (f) => {
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
    enums: args.enums,
    unions: args.unions,
    aliases: args.aliases,
    treatRootArrayAsSamples: args.samplesFromArray,
    defaultsFromSamples: args.defaultsFromSamples,
  };

  const { normalized, warnings } = runPipeline({
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

  const opts: GenerateOptions =
    args.target === "serde-zig"
      ? serdeDecorator(normalized, { denyUnknownFields, flattenPaths, skipPaths })
      : {};
  let code = generateZig(normalized, opts);

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
