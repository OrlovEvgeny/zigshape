<script lang="ts">
  import { onMount } from "svelte";
  import Editor, { type EditorLanguage, type HighlightRange } from "$lib/Editor.svelte";
  import Inspector from "$lib/Inspector.svelte";
  import SampleSource from "$lib/SampleSource.svelte";
  import SampleTabs from "$lib/SampleTabs.svelte";
  import Toolbar from "$lib/Toolbar.svelte";
  import Warnings from "$lib/Warnings.svelte";
  import { EXAMPLES, type Example } from "$lib/examples";
  import { DEFAULT_PRESET, PRESETS, type PresetId } from "$lib/presets";
  import {
    decodeShareHash,
    encodeShareConfig,
    encodeShareWithSamples,
    ShareTooLargeError,
  } from "$lib/share";
  import {
    detectFormat,
    generateZig,
    parseSample,
    pathSrcMap,
    runPipeline,
    type Decl,
    type Diagnostic,
    type Format,
    type SrcRef,
  } from "@zigshape/core";
  import { serdeDecorator } from "@zigshape/serde-zig";

  type FormatArg = "auto" | Format;

  const initial = EXAMPLES[0]!;

  let samples = $state<string[]>([...initial.samples]);
  let activeIndex = $state(0);
  let rootName = $state(initial.rootName);
  let target = $state<"plain" | "serde-zig">(initial.target);
  let format = $state<FormatArg>("auto");
  let presetId = $state<PresetId>(DEFAULT_PRESET);
  let zigFmt = $state(false);
  let formattedCode = $state<string | null>(null);
  let formatterError = $state<string | null>(null);
  let inputHighlight = $state<HighlightRange | null>(null);
  let shareNotice = $state<string | null>(null);

  const detectedFormat = $derived.by(() => {
    if (format !== "auto") return null;
    const sample = samples[activeIndex] ?? "";
    if (!sample.trim()) return null;
    return detectFormat(sample).format;
  });

  const editorLanguage: EditorLanguage = $derived(
    format === "json" || format === "yaml" || format === "xml"
      ? format
      : format === "auto" && (detectedFormat === "json" || detectedFormat === "yaml" || detectedFormat === "xml")
        ? detectedFormat
        : "plain",
  );

  const presetOptions = $derived(
    PRESETS.find((p) => p.id === presetId)?.options ?? {},
  );

  const generated = $derived.by(() => {
    const nonEmpty = samples.filter((s) => s.trim().length > 0);
    if (nonEmpty.length === 0) {
      return { code: "", warnings: [] as Diagnostic[], decls: [] as Decl[] };
    }
    const { normalized, warnings } = runPipeline({
      samples: nonEmpty,
      rootName,
      inferOptions: { ...presetOptions, format },
    });
    if (!normalized) return { code: "", warnings, decls: [] as Decl[] };
    const opts = target === "serde-zig" ? serdeDecorator(normalized) : {};
    const code = generateZig(normalized, opts);
    return { code, warnings, decls: normalized.decls };
  });

  const displayCode = $derived(formattedCode ?? generated.code);

  // Refresh the formatted output any time the raw code or the toggle changes.
  // Errors fall back to unformatted (matches CLI behavior) and surface a notice.
  $effect(() => {
    const raw = generated.code;
    if (!zigFmt || !raw) {
      formattedCode = null;
      formatterError = null;
      return;
    }
    let cancelled = false;
    formatterError = null;
    void (async () => {
      try {
        const { formatZig } = await import("$lib/zigfmt");
        const out = await formatZig(raw);
        if (!cancelled) formattedCode = out;
      } catch (e) {
        if (!cancelled) {
          formattedCode = null;
          formatterError = (e as Error).message;
        }
      }
    })();
    return () => { cancelled = true; };
  });

  function loadExample(e: Example) {
    samples = [...e.samples];
    activeIndex = 0;
    rootName = e.rootName;
    target = e.target;
  }

  function addSample() {
    samples = [...samples, ""];
    activeIndex = samples.length - 1;
  }

  function addSamples(texts: string[]) {
    if (texts.length === 0) return;
    const trimmed = samples[activeIndex]?.trim() ?? "";
    // If the active editor is empty, replace it; otherwise append new tabs.
    let next = [...samples];
    let nextIndex = activeIndex;
    if (next.length === 1 && trimmed === "") {
      next = [...texts];
      nextIndex = next.length - 1;
    } else {
      next.push(...texts);
      nextIndex = next.length - 1;
    }
    samples = next;
    activeIndex = nextIndex;
  }

  function removeSample(i: number) {
    if (samples.length <= 1) return;
    samples = samples.filter((_, idx) => idx !== i);
    if (activeIndex >= samples.length) activeIndex = samples.length - 1;
  }

  async function copyZig() {
    const code = displayCode;
    if (!code) return;
    try { await navigator.clipboard.writeText(code); } catch { /* ignore */ }
  }

  function downloadZig() {
    const code = displayCode;
    if (!code) return;
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rootName || "Root"}.zig`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showShareNotice(msg: string) {
    shareNotice = msg;
    setTimeout(() => { shareNotice = null; }, 2400);
  }

  async function copyWithFallback(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function shareConfig() {
    const hash = encodeShareConfig({ rootName, target, format, presetId });
    const url = window.location.origin + window.location.pathname + hash;
    history.replaceState(null, "", hash);
    const ok = await copyWithFallback(url);
    showShareNotice(ok ? "Config link copied to clipboard." : "Config link in URL bar.");
  }

  async function shareWithSamples() {
    try {
      const hash = encodeShareWithSamples({ rootName, target, format, presetId, samples });
      const url = window.location.origin + window.location.pathname + hash;
      history.replaceState(null, "", hash);
      const ok = await copyWithFallback(url);
      showShareNotice(ok ? "Link with samples copied to clipboard." : "Link with samples in URL bar.");
    } catch (e) {
      if (e instanceof ShareTooLargeError) {
        showShareNotice(`Samples too large to share (${e.size} B); use Share config instead.`);
      } else {
        showShareNotice("Couldn't build share link.");
      }
    }
  }

  onMount(() => {
    const decoded = decodeShareHash(window.location.hash);
    if (!decoded) return;
    rootName = decoded.rootName;
    target = decoded.target;
    format = decoded.format;
    presetId = decoded.presetId;
    if (decoded.samples && decoded.samples.length > 0) {
      samples = [...decoded.samples];
      activeIndex = 0;
    }
  });

  let activeValue = $derived(samples[activeIndex] ?? "");
  $effect(() => {
    if (activeValue !== samples[activeIndex]) {
      samples = samples.map((s, i) => (i === activeIndex ? activeValue : s));
    }
  });

  function jumpToWarning(d: Diagnostic) {
    if (!d.src) return;
    if (d.src.sample !== activeIndex && d.src.sample < samples.length) {
      activeIndex = d.src.sample;
    }
    inputHighlight = { from: d.src.offset, length: d.src.length, nonce: Date.now() };
  }

  // Per-sample path → SrcRef map.  Built once per sample by re-parsing the
  // text and walking the ZValue.  Cheap because parses are already fast on
  // the inputs the playground deals with, and this lets the inspector use
  // precise per-path ranges (precise for JSON/YAML; whole-document fallback
  // for TOML/XML — same as before but exposed cleanly).
  const pathMaps = $derived.by(() => {
    const out: (Map<string, SrcRef> | null)[] = [];
    for (let i = 0; i < samples.length; i++) {
      const text = samples[i] ?? "";
      if (!text.trim()) {
        out.push(null);
        continue;
      }
      try {
        const r = parseSample(text, i, format);
        out.push(r.value ? pathSrcMap(r.value) : null);
      } catch {
        out.push(null);
      }
    }
    return out;
  });

  function jumpToPath(path: string) {
    const decl = generated.decls.find(
      (d) =>
        d.path === path ||
        (d.kind === "struct" && d.fields.some((f) => f.path === path)),
    );
    if (!decl) return;
    const src = findSrc(path);
    if (!src) return;
    if (src.sample !== activeIndex && src.sample < samples.length) {
      activeIndex = src.sample;
    }
    inputHighlight = { from: src.offset, length: src.length, nonce: Date.now() };
  }

  function findSrc(path: string): SrcRef | null {
    // Try active sample first; fall back to any sample where the path was seen.
    const active = pathMaps[activeIndex]?.get(path);
    if (active) return active;
    for (let i = 0; i < pathMaps.length; i++) {
      const m = pathMaps[i];
      if (!m) continue;
      const hit = m.get(path);
      if (hit) return hit;
    }
    // Last-resort fallback: if the path is the root, point at the whole text
    // (lets clicking the root struct still scroll to the start).
    if (path === "$") {
      const text = samples[activeIndex] ?? "";
      return { sample: activeIndex, offset: 0, length: text.length };
    }
    return null;
  }
</script>

<main>
  <header>
    <h1>zigshape</h1>
    <p class="tagline">Generate idiomatic Zig structs from JSON, YAML and TOML. Built for serde.zig.</p>
  </header>

  <Toolbar
    bind:rootName
    bind:target
    bind:format
    bind:presetId
    bind:zigFmt
    detectedFormat={detectedFormat ?? null}
    onLoadExample={loadExample}
    onCopy={copyZig}
    onDownload={downloadZig}
    onShareConfig={shareConfig}
    onShareWithSamples={shareWithSamples}
    canCopy={!!displayCode}
  />

  {#if shareNotice}
    <p class="share-notice">{shareNotice}</p>
  {/if}
  {#if formatterError}
    <p class="share-notice error">zig fmt failed ({formatterError}); showing unformatted output.</p>
  {/if}

  <section class="panes">
    <div class="pane">
      <SampleSource onAddSamples={addSamples} />
      <SampleTabs
        {samples}
        {activeIndex}
        onSelect={(i) => (activeIndex = i)}
        onAdd={addSample}
        onRemove={removeSample}
      />
      <Editor bind:value={activeValue} language={editorLanguage} highlight={inputHighlight} />
    </div>
    <div class="pane">
      <h2>Zig</h2>
      <Editor value={displayCode || "// (waiting for valid input)"} language="plain" readonly />
    </div>
  </section>

  <Warnings warnings={generated.warnings} onJump={jumpToWarning} />
  <Inspector decls={generated.decls} onJump={jumpToPath} />

  <footer>
    <small>Local-first. Your input never leaves the browser.</small>
  </footer>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #222;
    background: #fafafa;
  }
  main { max-width: 1200px; margin: 0 auto; padding: 1.5rem; display: flex; flex-direction: column; min-height: 100vh; box-sizing: border-box; }
  header h1 { margin: 0; font-size: 1.5rem; }
  .tagline { margin: 0.25rem 0 1rem; color: #666; }
  .panes { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; min-height: 28rem; }
  .pane { display: flex; flex-direction: column; min-height: 0; }
  .pane h2 { margin: 0 0 0.5rem; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #666; }
  footer { margin-top: 2rem; color: #888; }
  .share-notice {
    margin: 0 0 0.75rem;
    padding: 0.4rem 0.7rem;
    background: #f1f7ff;
    border-left: 3px solid #6c8aff;
    border-radius: 0 4px 4px 0;
    color: #234;
    font-size: 0.85rem;
  }
  .share-notice.error {
    background: #fff3f0;
    border-left-color: #d44;
    color: #722;
  }
  @media (max-width: 800px) { .panes { grid-template-columns: 1fr; min-height: 20rem; } }
</style>
