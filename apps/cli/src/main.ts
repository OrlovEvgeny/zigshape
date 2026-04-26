#!/usr/bin/env bun
import {
  generateZig,
  runPipeline,
  type EnumStrategy,
  type Format,
  type GenerateOptions,
  type IntStrategy,
  type UnionStrategy,
  type ZigshapeOptions,
} from "@zigshape/core";
import { serdeDecorator } from "@zigshape/serde-zig";

type Target = "plain" | "serde-zig";
type FormatArg = "auto" | Format;

type Args = {
  files: string[];
  rootName: string;
  target: Target;
  format: FormatArg;
  intStrategy: IntStrategy;
  enums: EnumStrategy;
  unions: UnionStrategy;
  defaultsFromSamples: boolean;
  zigFmt: boolean;
  out: string | null;
  stdin: boolean;
  help: boolean;
};

const HELP = `zigshape — generate Zig structs from JSON / YAML / TOML

Usage:
  zigshape <file>... [options]
  zigshape --stdin   [options]

Input options:
  --format auto|json|yaml|toml   Input format. Default: auto.
  --stdin                        Read a single sample from stdin.

Output options:
  --root NAME                    Struct name for the root type. Default: Root.
  --target plain|serde-zig       Codegen target. Default: plain.
  --out PATH                     Write Zig to PATH instead of stdout.
  --zig-fmt                      Run generated code through zig fmt (WASM).

Inference options:
  --int smallest|u64|i64         Integer width strategy. Default: smallest.
  --enums auto|off|always        Enum suggestion. Default: auto.
  --unions off|tagged            Tagged-union inference. Default: off.
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
    enums: "auto",
    unions: "off",
    defaultsFromSamples: false,
    zigFmt: false,
    out: null,
    stdin: false,
    help: false,
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
        break;
      case "--target": {
        const t = next() as Target | undefined;
        if (t !== "plain" && t !== "serde-zig") {
          throw new Error(`--target must be 'plain' or 'serde-zig' (got '${t}')`);
        }
        args.target = t;
        break;
      }
      case "--format": {
        const f = next() as FormatArg | undefined;
        if (f !== "auto" && f !== "json" && f !== "yaml" && f !== "toml") {
          throw new Error(`--format must be auto|json|yaml|toml (got '${f}')`);
        }
        args.format = f;
        break;
      }
      case "--int": {
        const v = next() as IntStrategy | undefined;
        if (v !== "smallest" && v !== "u64" && v !== "i64") {
          throw new Error(`--int must be smallest|u64|i64 (got '${v}')`);
        }
        args.intStrategy = v;
        break;
      }
      case "--enums": {
        const v = next() as EnumStrategy | undefined;
        if (v !== "auto" && v !== "off" && v !== "always") {
          throw new Error(`--enums must be auto|off|always (got '${v}')`);
        }
        args.enums = v;
        break;
      }
      case "--unions": {
        const v = next() as UnionStrategy | undefined;
        if (v !== "off" && v !== "tagged") {
          throw new Error(`--unions must be off|tagged (got '${v}')`);
        }
        args.unions = v;
        break;
      }
      case "--defaults-from-samples":
        args.defaultsFromSamples = true;
        break;
      case "--zig-fmt":
        args.zigFmt = true;
        break;
      case "--out":
        args.out = next() ?? null;
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

  let samples: string[];
  if (args.stdin || args.files.length === 0) {
    samples = [await Bun.stdin.text()];
  } else {
    samples = await Promise.all(args.files.map((f) => Bun.file(f).text()));
  }

  const inferOptions: Partial<ZigshapeOptions> = {
    format: args.format,
    intStrategy: args.intStrategy,
    enums: args.enums,
    unions: args.unions,
    defaultsFromSamples: args.defaultsFromSamples,
  };

  const { normalized, warnings } = runPipeline({
    samples,
    rootName: args.rootName,
    inferOptions,
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

  const opts: GenerateOptions = args.target === "serde-zig" ? serdeDecorator(normalized) : {};
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
