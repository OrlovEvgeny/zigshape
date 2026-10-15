// Lazy-loaded WASM zig fmt.  The `/web` export takes an explicit URL — we
// hand it Vite's `?url` import for the .wasm asset, which sidesteps the
// `?init` source-phase import that previously blocked browser builds.

import wasmUrl from "@wasm-fmt/zig_fmt/zig_fmt.wasm?url";
import initAsync, { format } from "@wasm-fmt/zig_fmt/web";

let initialized: Promise<(input: string) => string> | null = null;

/** Resolves once the WASM module is ready.  The formatter it hands back is
 *  synchronous, so callers can run it inside a `$derived` and never show
 *  output that lags behind the input. */
export function loadZigFmt(): Promise<(input: string) => string> {
  if (!initialized) {
    initialized = initAsync(new URL(wasmUrl, window.location.href)).then(() => format);
    initialized.catch(() => { initialized = null; });
  }
  return initialized;
}
