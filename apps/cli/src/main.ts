#!/usr/bin/env bun
import { generateZig, runPipeline, type GenerateOptions } from "@zigshape/core";
import { serdeDecorator } from "@zigshape/serde-zig";

type Target = "plain" | "serde-zig";

type Args = {
  files: string[];
  rootName: string;
  target: Target;
  out: string | null;
  stdin: boolean;
  help: boolean;
};

const HELP = `zigshape — generate Zig structs from JSON

Usage:
  zigshape <file>... [--root NAME] [--target plain|serde-zig] [--out PATH]
  zigshape --stdin   [--root NAME] [--target plain|serde-zig] [--out PATH]

Options:
  --root NAME          Struct name for the root type. Default: Root.
  --target TARGET      plain (default) or serde-zig.
  --out PATH           Write Zig to PATH instead of stdout.
  --stdin              Read sample from stdin (default when no files given).
  -h, --help           Show this help.

Notes:
  Multiple files are merged as samples of the same shape — fields that
  appear in only some samples become optional.
`;

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    files: [],
    rootName: "Root",
    target: "plain",
    out: null,
    stdin: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const eq = a.indexOf("=");
    const flag = a.startsWith("--") && eq !== -1 ? a.slice(0, eq) : a;
    const inline = a.startsWith("--") && eq !== -1 ? a.slice(eq + 1) : null;

    switch (flag) {
      case "--root":
        args.rootName = inline ?? argv[++i] ?? args.rootName;
        break;
      case "--target": {
        const t = (inline ?? argv[++i]) as Target | undefined;
        if (t !== "plain" && t !== "serde-zig") {
          throw new Error(`--target must be 'plain' or 'serde-zig' (got '${t}')`);
        }
        args.target = t;
        break;
      }
      case "--out":
        args.out = inline ?? argv[++i] ?? null;
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

  const { normalized, warnings } = runPipeline({ samples, rootName: args.rootName });

  for (const w of warnings) {
    const path = w.path ? ` ${w.path}` : "";
    process.stderr.write(`${severityPrefix(w.severity)}:${path} ${w.message} [${w.code}]\n`);
  }

  if (!normalized) {
    process.stderr.write("zigshape: no parseable samples\n");
    return 1;
  }

  const opts: GenerateOptions = args.target === "serde-zig" ? serdeDecorator(normalized) : {};
  const code = generateZig(normalized, opts);

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
