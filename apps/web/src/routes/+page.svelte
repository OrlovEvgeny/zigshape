<script lang="ts">
  import Editor, { type EditorLanguage, type HighlightRange } from "$lib/Editor.svelte";
  import Inspector from "$lib/Inspector.svelte";
  import SampleTabs from "$lib/SampleTabs.svelte";
  import Toolbar from "$lib/Toolbar.svelte";
  import Warnings from "$lib/Warnings.svelte";
  import { EXAMPLES, type Example } from "$lib/examples";
  import { DEFAULT_PRESET, PRESETS, type PresetId } from "$lib/presets";
  import {
    detectFormat,
    generateZig,
    runPipeline,
    type Decl,
    type Diagnostic,
    type Format,
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
  let inputHighlight = $state<HighlightRange | null>(null);

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

  const displayCode = $derived(generated.code);

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

  // Best-effort: locate a JSON key span in the active sample.  Adequate for the
  // inspector demo; precise per-format mapping is roadmap.
  function findSrc(path: string): { sample: number; offset: number; length: number } | null {
    const sample = samples[activeIndex] ?? "";
    if (!sample) return null;
    if (path === "$") return { sample: activeIndex, offset: 0, length: sample.length };
    const segments = path
      .replace(/^\$\.?/, "")
      .split(/\.(?![^\[]*\])|(?=\[)/)
      .filter(Boolean);
    const leaf = segments[segments.length - 1];
    if (!leaf || leaf.startsWith("[")) {
      return { sample: activeIndex, offset: 0, length: Math.min(sample.length, 1) };
    }
    const needle = `"${leaf}"`;
    const idx = sample.indexOf(needle);
    if (idx < 0) return null;
    return { sample: activeIndex, offset: idx, length: needle.length };
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
    detectedFormat={detectedFormat ?? null}
    onLoadExample={loadExample}
    onCopy={copyZig}
    onDownload={downloadZig}
    canCopy={!!displayCode}
  />

  <section class="panes">
    <div class="pane">
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
  @media (max-width: 800px) { .panes { grid-template-columns: 1fr; min-height: 20rem; } }
</style>
