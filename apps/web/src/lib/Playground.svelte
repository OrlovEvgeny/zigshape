<script lang="ts">
  import { onMount } from "svelte";
  import Editor, { type EditorLanguage, type HighlightRange } from "$lib/Editor.svelte";
  import Inspector from "$lib/Inspector.svelte";
  import SampleSource from "$lib/SampleSource.svelte";
  import SampleTabs from "$lib/SampleTabs.svelte";
  import Toolbar from "$lib/Toolbar.svelte";
  import Warnings from "$lib/Warnings.svelte";
  import { tryParseCurl } from "$lib/curl";
  import { EXAMPLES, type Example } from "$lib/examples";
  import { DEFAULT_PRESET, PRESETS, type PresetId } from "$lib/presets";
  import {
    decodeShareHash,
    encodeShareConfig,
    encodeShareWithSamples,
    ShareTooLargeError,
  } from "$lib/share";
  import {
    buildReport,
    detectFormat,
    emitBuildSnippet,
    emitParserHelper,
    emitTestScaffold,
    generateZig,
    parseSample,
    pathSrcMap,
    runPipeline,
    type Decl,
    type Diagnostic,
    type FieldOverride,
    type Format,
    type NormalizeResult,
    type Overrides,
    type SrcRef,
  } from "@zigshape/core";
  import { serdeDecorator } from "@zigshape/serde-zig";

  type FormatArg = "auto" | Format;

  // Per-format SEO routes pin these values via props; the root playground
  // leaves them at defaults and lets the toolbar drive everything.
  type Props = {
    initialFormat?: FormatArg;
    initialTarget?: "plain" | "serde-zig";
    initialPreset?: PresetId;
    initialRootName?: string;
    initialExample?: Example;
  };

  let {
    initialFormat = "auto",
    initialTarget,
    initialPreset = DEFAULT_PRESET,
    initialRootName,
    initialExample,
  }: Props = $props();

  const startExample = initialExample ?? EXAMPLES[0]!;

  // Open with a single sample — the user's stated mental model is "see one
  // example, erase it, type something new". Multi-sample examples (loaded
  // from the toolbar dropdown via loadExample) keep all their samples; only
  // the *initial* boot trims to the first one. SEO landing pages already
  // pass single-sample examples via `initialExample`, so this only changes
  // the root playground.
  let samples = $state<string[]>([startExample.samples[0] ?? ""]);
  let activeIndex = $state(0);
  let rootName = $state(initialRootName ?? startExample.rootName);
  let target = $state<"plain" | "serde-zig">(initialTarget ?? startExample.target);
  let format = $state<FormatArg>(initialFormat);
  let presetId = $state<PresetId>(initialPreset);
  let zigFmt = $state(false);
  let withDocComments = $state(false);
  let formattedCode = $state<string | null>(null);
  let formatterError = $state<string | null>(null);
  let inputHighlight = $state<HighlightRange | null>(null);
  let shareNotice = $state<string | null>(null);
  let overrides = $state<Overrides>({});

  const detectedFormat = $derived.by(() => {
    if (format !== "auto") return null;
    const sample = samples[activeIndex] ?? "";
    if (!sample.trim()) return null;
    return detectFormat(sample).format;
  });

  // Confidence (0..1) for the auto-detect. Surfaced in the Format
  // dropdown so the user knows when a heuristic is shaky and they
  // should click into a specific format.
  const detectedConfidence = $derived.by(() => {
    if (format !== "auto") return null;
    const sample = samples[activeIndex] ?? "";
    if (!sample.trim()) return null;
    return detectFormat(sample).confidence;
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
      return {
        code: "",
        warnings: [] as Diagnostic[],
        decls: [] as Decl[],
        normalized: null as NormalizeResult | null,
        resolvedFormat: null as Format | null,
      };
    }
    const { normalized, warnings, resolvedFormat } = runPipeline({
      samples: nonEmpty,
      rootName,
      inferOptions: { ...presetOptions, format },
      overrides,
    });
    if (!normalized) {
      return {
        code: "",
        warnings,
        decls: [] as Decl[],
        normalized: null,
        resolvedFormat,
      };
    }
    const baseOpts = target === "serde-zig" ? serdeDecorator(normalized) : {};
    const opts = { ...baseOpts, withDocComments };
    const code = generateZig(normalized, opts);
    return { code, warnings, decls: normalized.decls, normalized, resolvedFormat };
  });

  const displayCode = $derived(formattedCode ?? generated.code);

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
    overrides = {};
  }

  function setOverride(path: string, ov: FieldOverride | null) {
    if (ov === null) {
      const next = { ...overrides };
      delete next[path];
      overrides = next;
    } else {
      overrides = { ...overrides, [path]: ov };
    }
  }

  function clearAllOverrides() { overrides = {}; }

  function addSample() {
    samples = [...samples, ""];
    activeIndex = samples.length - 1;
  }

  function addSamples(texts: string[]) {
    if (texts.length === 0) return;
    const trimmed = samples[activeIndex]?.trim() ?? "";
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
    downloadBlob(displayCode || "", `${rootName || "Root"}.zig`, "text/plain");
  }

  function downloadBlob(content: string, filename: string, mime: string) {
    if (!content) return;
    const blob = new Blob([content], { type: mime + ";charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // The four output-variant buttons.  Each builds its content from the
  // current generated state so a stale value can never leak into the
  // clipboard / download.  Format defaults to JSON when the pipeline
  // hasn't resolved one yet (no samples or mixed) — matches CLI.
  async function copyParser() {
    if (!generated.normalized) return;
    const fmt: Format = generated.resolvedFormat ?? "json";
    await copyWithFallback(emitParserHelper(rootName || "Root", target, fmt).trim() + "\n");
  }

  async function copyBuildSnippet() {
    await copyWithFallback(emitBuildSnippet(target).trim() + "\n");
  }

  async function copyTestScaffold() {
    if (!generated.normalized) return;
    const sample = (samples[activeIndex] ?? samples[0] ?? "").trim();
    if (!sample) return;
    const fmt: Format = generated.resolvedFormat ?? "json";
    await copyWithFallback(
      emitTestScaffold(rootName || "Root", sample, target, fmt).trim() + "\n",
    );
  }

  function downloadReport() {
    if (!generated.normalized) return;
    const report = buildReport(generated.normalized, generated.warnings);
    downloadBlob(
      JSON.stringify(report, null, 2) + "\n",
      `${rootName || "Root"}.schema.json`,
      "application/json",
    );
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
  let curlNotice = $state<string | null>(null);
  $effect(() => {
    if (activeValue !== samples[activeIndex]) {
      samples = samples.map((s, i) => (i === activeIndex ? activeValue : s));
    }
  });

  // When the active sample is pasted as a `curl ...` command, replace it
  // with the extracted body and (if no name has been edited yet) seed the
  // root struct name from the URL path.  Triggered after the value is
  // committed so the editor and `samples` stay in sync — the next derive
  // recomputes `activeValue` from the new `samples[activeIndex]`.
  $effect(() => {
    const v = samples[activeIndex];
    if (!v) return;
    const c = tryParseCurl(v);
    if (!c) return;
    const next = [...samples];
    next[activeIndex] = c.sample;
    samples = next;
    if (c.rootHint) {
      // Avoid overwriting a name the user explicitly chose.  A "default"
      // rootName is one that still matches an example's rootName, the
      // empty string, or the literal "Root".
      const looksDefault =
        rootName === "" ||
        rootName === "Root" ||
        EXAMPLES.some((e) => e.rootName === rootName);
      if (looksDefault) rootName = c.rootHint;
    }
    curlNotice = `Detected curl — extracted body${c.rootHint ? ` and set root to ${c.rootHint}` : ""}.`;
    setTimeout(() => { curlNotice = null; }, 2400);
  });

  function jumpToWarning(d: Diagnostic) {
    if (!d.src) return;
    if (d.src.sample !== activeIndex && d.src.sample < samples.length) {
      activeIndex = d.src.sample;
    }
    inputHighlight = { from: d.src.offset, length: d.src.length, nonce: Date.now() };
  }

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
    const active = pathMaps[activeIndex]?.get(path);
    if (active) return active;
    for (let i = 0; i < pathMaps.length; i++) {
      const m = pathMaps[i];
      if (!m) continue;
      const hit = m.get(path);
      if (hit) return hit;
    }
    if (path === "$") {
      const text = samples[activeIndex] ?? "";
      return { sample: activeIndex, offset: 0, length: text.length };
    }
    return null;
  }
</script>

<Toolbar
  bind:rootName
  bind:target
  bind:format
  bind:presetId
  bind:zigFmt
  bind:withDocComments
  detectedFormat={detectedFormat ?? null}
  detectedConfidence={detectedConfidence ?? null}
  onLoadExample={loadExample}
  onCopy={copyZig}
  onDownload={downloadZig}
  onShareConfig={shareConfig}
  onShareWithSamples={shareWithSamples}
  onCopyParser={copyParser}
  onCopyBuildSnippet={copyBuildSnippet}
  onCopyTestScaffold={copyTestScaffold}
  onDownloadReport={downloadReport}
  canCopy={!!displayCode}
/>

{#if shareNotice}
  <p class="share-notice">{shareNotice}</p>
{/if}
{#if curlNotice}
  <p class="share-notice">{curlNotice}</p>
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
<Inspector
  decls={generated.decls}
  {overrides}
  onJump={jumpToPath}
  onSetOverride={setOverride}
  onClearAll={clearAllOverrides}
/>

<style>
  .panes { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; min-height: 28rem; }
  .pane { display: flex; flex-direction: column; min-height: 0; }
  .pane h2 { margin: 0 0 0.5rem; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #666; }
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
