// Shared CLI test runner. Calls `run(argv)` in-process instead of spawning
// a Bun subprocess per test so the suite doesn't blow Bun 1.3.3's
// spawn-state limit (a SIGILL appears around 20-25 spawns and crashed CI
// before this was wired in).
//
// `process.stdout.write` and `process.stderr.write` are patched so the
// CLI's regular `process.stdout.write(...)` calls land in capture
// buffers instead of the test runner's terminal. Stdin is fed through
// `run(argv, { stdinText })` rather than `Bun.stdin`.

import { run } from "../src/main";

export type CliResult = { stdout: string; stderr: string; code: number };

export async function runCli(args: string[], stdin?: string): Promise<CliResult> {
  let stdout = "";
  let stderr = "";

  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);

  // The Node typings overload `write` heavily; the cast is unavoidable.
  // Each call returns `true` synchronously (no backpressure here) and
  // ignores the optional encoding/callback args.
  process.stdout.write = ((chunk: unknown) => {
    stdout += chunkToString(chunk);
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: unknown) => {
    stderr += chunkToString(chunk);
    return true;
  }) as typeof process.stderr.write;

  try {
    const code = await run(args, stdin !== undefined ? { stdinText: stdin } : {});
    return { stdout, stderr, code };
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}

function chunkToString(chunk: unknown): string {
  if (typeof chunk === "string") return chunk;
  if (chunk instanceof Uint8Array) return new TextDecoder().decode(chunk);
  return String(chunk);
}
