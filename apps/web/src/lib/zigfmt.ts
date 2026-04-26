// Lazy-loaded WASM zig fmt.  The `/web` export takes an explicit URL — we
// hand it Vite's `?url` import for the .wasm asset, which sidesteps the
// `?init` source-phase import that previously blocked browser builds.

import wasmUrl from "@wasm-fmt/zig_fmt/zig_fmt.wasm?url";
import initAsync, { format } from "@wasm-fmt/zig_fmt/web";

let initialized: Promise<unknown> | null = null;

export async function formatZig(input: string): Promise<string> {
  if (!initialized) initialized = initAsync(new URL(wasmUrl, window.location.href));
  await initialized;
  return format(input);
}
