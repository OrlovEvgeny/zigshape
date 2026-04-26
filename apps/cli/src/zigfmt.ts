import { format } from "@wasm-fmt/zig_fmt";

/** Run generated Zig source through the WASM `zig fmt` formatter.
 *  Returns the formatted source.  Throws on parser-level errors so the caller
 *  can fall back to unformatted output and warn the user. */
export async function formatZig(input: string): Promise<string> {
  return format(input);
}
