<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { replaceState } from "$app/navigation";
  import Editor, { type EditorLanguage, type HighlightRange } from "$lib/Editor.svelte";
  import Inspector from "$lib/Inspector.svelte";
  import Menu from "$lib/Menu.svelte";
  import OptionsPanel from "$lib/OptionsPanel.svelte";
  import SampleSource, { readFiles } from "$lib/SampleSource.svelte";
  import SampleTabs from "$lib/SampleTabs.svelte";
  import Toolbar from "$lib/Toolbar.svelte";
  import Warnings from "$lib/Warnings.svelte";
  import { tryParseCurl } from "$lib/curl";
  import { EXAMPLES, type Example } from "$lib/examples";
  import {
    applyEdit,
    cliCommand,
    resolveTargetOptions,
    presetOptions,
    type OptionEdits,
    type OptionKey,
    type WebOptions,
  } from "$lib/options";
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
    suggestRootName,
    type Decl,
    type Diagnostic,
    type FieldOverride,
    type Format,
    type NormalizeResult,
    type Overrides,
    type SrcRef,
  } from "@zigshape/core";
  import { serdeCompatWarnings, serdeDecorator } from "@zigshape/serde-zig";

  type FormatArg = "auto" | Format;

  // Per-format SEO routes pin these values via props; the root playground
  // leaves them at defaults and lets the toolbar drive everything.  Props
  // only seed the initial state.
  type Props = {
    initialFormat?: FormatArg;
    initialTarget?: "plain" | "serde-zig";
    initialPreset?: PresetId;
    initialRootName?: string;
    initialExample?: Example;
  };

  let props: Props = $props();
  const init = untrack(() => ({ ...props }));

  const startExample = init.initialExample ?? EXAMPLES[0]!;

  const FORMAT_LABEL: Record<Format, string> = {
    json: "JSON",
    ndjson: "NDJSON",
    yaml: "YAML",
    toml: "TOML",
    xml: "XML",
  };

  // Open with a single sample — the user's stated mental model is "see one
  // example, erase it, type something new". Multi-sample examples (loaded
  // from the Examples menu via loadExample) keep all their samples; only
  // the *initial* boot trims to the first one. SEO landing pages already
  // pass single-sample examples via `initialExample`, so this only changes
  // the root playground.
  let samples = $state<string[]>([startExample.samples[0] ?? ""]);
  let activeIndex = $state(0);
  let rootName = $state(init.initialRootName ?? startExample.rootName);
  // The rootName starts pinned (the example or initial prop is an
  // explicit choice). Editing samples drops the pin so the suggestion
  // takes over; typing in the Root input or picking an example pins again.
  let rootNamePinned = $state(true);
  let target = $state<"plain" | "serde-zig">(init.initialTarget ?? startExample.target);
  let format = $state<FormatArg>(init.initialFormat ?? "auto");
  let presetId = $state<PresetId>(init.initialPreset ?? DEFAULT_PRESET);
  // Knobs moved away from the preset in the Options panel.
  let optionEdits = $state<OptionEdits>({});
  let optionsOpen = $state(false);
  // Set once the WASM zig fmt module has loaded; formatting itself is
  // synchronous after that.
  let zigFmt = $state.raw<((input: string) => string) | null>(null);
  let zigFmtLoadError = $state<string | null>(null);
  let inputHighlight = $state<HighlightRange | null>(null);
  let overrides = $state<Overrides>({});
  let toast = $state<{ text: string; tone: "info" | "error" } | null>(null);
  let copied = $state(false);
  let dragDepth = $state(0);

  const activeSample = $derived(samples[activeIndex] ?? "");

  const detection = $derived.by(() => {
    if (format !== "auto" || !activeSample.trim()) return null;
    return detectFormat(activeSample);
  });
  const detectedFormat = $derived(detection?.format ?? null);
  // Confidence (0..1) for the auto-detect. Surfaced in the Format
  // dropdown so the user knows when a heuristic is shaky and they
  // should click into a specific format.
  const detectedConfidence = $derived(detection?.confidence ?? null);

  const editorLanguage: EditorLanguage = $derived.by(() => {
    const f = format === "auto" ? detectedFormat : format;
    if (f === "json" || f === "ndjson") return "json";
    if (f === "yaml" || f === "xml" || f === "toml") return f;
    return "plain";
  });

  const basePreset = $derived(presetOptions(presetId));
  const options = $derived<WebOptions>({ ...basePreset, ...optionEdits });
  const editCount = $derived(Object.keys(optionEdits).length);

  // Auto-suggest a root name from the active sample's structure.  Runs
  // against the parser (not the inference output) so it works even when
  // multiple samples disagree.  Only writes back to `rootName` when the
  // user hasn't pinned it manually.
  const suggestedRoot = $derived.by(() => {
    if (!activeSample.trim()) return null;
    const r = parseSample(activeSample, activeIndex, format);
    if (!r.value) return null;
    return suggestRootName(r.value, {
      xmlRoot: r.xmlRoot,
      treatRootArrayAsSamples: options.treatRootArrayAsSamples,
    });
  });
  $effect(() => {
    if (rootNamePinned) return;
    const next = suggestedRoot ?? "Root";
    if (next !== untrack(() => rootName)) rootName = next;
  });

  // An empty Root struct input falls back to the same suggestion the
  // placeholder shows, so the output never disagrees with the field.
  const effectiveRoot = $derived(rootName.trim() || suggestedRoot || "Root");

  const generated = $derived.by(() => {
    // Empty tabs are skipped, so pipeline sample indices are positions in
    // `nonEmpty`; `tabOf` maps them back to the tab they came from.
    const tabOf = samples.flatMap((s, i) => (s.trim().length > 0 ? [i] : []));
    const nonEmpty = tabOf.map((i) => samples[i]!);
    if (nonEmpty.length === 0) {
      return {
        code: "",
        warnings: [] as Diagnostic[],
        decls: [] as Decl[],
        normalized: null as NormalizeResult | null,
        resolvedFormat: null as Format | null,
      };
    }
    const result = runPipeline({
      samples: nonEmpty,
      rootName: effectiveRoot,
      inferOptions: { ...resolveTargetOptions(options, target), format },
      overrides,
    });
    const { normalized, resolvedFormat } = result;
    const warnings = result.warnings.map((d) =>
      d.src ? { ...d, src: { ...d.src, sample: tabOf[d.src.sample] ?? d.src.sample } } : d,
    );
    if (!normalized) {
      return {
        code: "",
        warnings,
        decls: [] as Decl[],
        normalized: null,
        resolvedFormat,
      };
    }
    const serde = target === "serde-zig";
    if (serde) warnings.push(...serdeCompatWarnings(normalized));
    const baseOpts = serde
      ? serdeDecorator(normalized, { renameAll: options.renameAll, denyUnknownFields: options.denyUnknownFields })
      : {};
    const opts = { ...baseOpts, withDocComments: options.withDocComments };
    const code = generateZig(normalized, opts);
    return { code, warnings, decls: normalized.decls, normalized, resolvedFormat };
  });

  // zig fmt always runs — the user shouldn't have to think about it.  On
  // failure (usually a raw override that isn't valid Zig) we fall back to
  // the unformatted source and surface the reason.
  const formatted = $derived.by(() => {
    const raw = generated.code;
    if (!raw || !zigFmt) return { code: raw, error: zigFmtLoadError };
    try {
      return { code: zigFmt(raw), error: null };
    } catch (e) {
      return { code: raw, error: (e as Error).message };
    }
  });
  const displayCode = $derived(formatted.code);
  const formatterError = $derived(formatted.error);

  // ---- Status-bar facts ----------------------------------------------

  const errorTabs = $derived(
    new Set(
      generated.warnings
        .filter((d) => d.severity === "error" && d.src)
        .map((d) => d.src!.sample),
    ),
  );
  const firstError = $derived(generated.warnings.find((d) => d.severity === "error") ?? null);

  // A pinned format that fails on the active sample while the text clearly
  // reads as another format (JSON pasted on the YAML page, say): offer a
  // one-click switch instead of a parser error.
  const formatMismatch = $derived.by((): Format | null => {
    if (format === "auto" || !activeSample.trim()) return null;
    const failed = generated.warnings.some(
      (d) => d.severity === "error" && (d.src?.sample ?? activeIndex) === activeIndex,
    );
    if (!failed) return null;
    const d = detectFormat(activeSample);
    if (d.format === format || d.confidence < 0.6) return null;
    return d.format;
  });

  function acceptFormatSuggestion() {
    if (!formatMismatch) return;
    // NDJSON isn't in the Format dropdown; auto-detect handles it.
    format = formatMismatch === "ndjson" ? "auto" : formatMismatch;
  }
  const inputFormatLabel = $derived.by(() => {
    if (format !== "auto") return FORMAT_LABEL[format];
    if (!detectedFormat) return "Auto-detect";
    return FORMAT_LABEL[detectedFormat];
  });
  const inputLines = $derived(activeSample ? activeSample.split("\n").length : 0);
  const outputLines = $derived(displayCode ? displayCode.replace(/\n+$/, "").split("\n").length : 0);
  const declSummary = $derived.by(() => {
    let structs = 0;
    let enums = 0;
    let unions = 0;
    let fields = 0;
    for (const d of generated.decls) {
      if (d.kind === "struct") {
        structs++;
        fields += d.fields.length;
      } else if (d.kind === "enum") enums++;
      else unions++;
    }
    const parts: string[] = [];
    if (structs) parts.push(`${structs} struct${structs === 1 ? "" : "s"}`);
    if (enums) parts.push(`${enums} enum${enums === 1 ? "" : "s"}`);
    if (unions) parts.push(`${unions} union${unions === 1 ? "" : "s"}`);
    if (fields) parts.push(`${fields} field${fields === 1 ? "" : "s"}`);
    return parts.join(" · ");
  });

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  }
  const inputSize = $derived(formatBytes(new TextEncoder().encode(activeSample).length));

  // ---- Sample editing -------------------------------------------------

  function updateActive(text: string) {
    // A pasted `curl ...` command is replaced by its body; the URL path
    // seeds the root name when it has a usable segment.
    const c = tryParseCurl(text);
    if (c) {
      samples = samples.map((s, i) => (i === activeIndex ? c.sample : s));
      if (c.rootHint) {
        rootName = c.rootHint;
        rootNamePinned = true;
      } else {
        rootNamePinned = false;
      }
      notify(`Detected a curl command. Using its body${c.rootHint ? ` and root name ${c.rootHint}` : ""}.`);
      return;
    }
    samples = samples.map((s, i) => (i === activeIndex ? text : s));
    rootNamePinned = false;
  }

  function loadExample(e: Example) {
    // A pinned format (SEO pages, or picked by hand) would otherwise parse
    // the example with the wrong parser.  Auto mode detects it on its own.
    if (format !== "auto") format = e.format;
    samples = [...e.samples];
    activeIndex = 0;
    rootName = e.rootName;
    rootNamePinned = true;
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

  function setOption(key: OptionKey, value: WebOptions[OptionKey]) {
    optionEdits = applyEdit(optionEdits, basePreset, key, value);
  }

  const cli = $derived(cliCommand(options, { format, target, rootName: effectiveRoot }));

  function addSample() {
    samples = [...samples, ""];
    activeIndex = samples.length - 1;
  }

  function addSamples(texts: string[]) {
    if (texts.length === 0) return;
    const replaceEmpty = samples.length === 1 && (samples[0]?.trim() ?? "") === "";
    samples = replaceEmpty ? [...texts] : [...samples, ...texts];
    activeIndex = samples.length - 1;
    rootNamePinned = false;
    notify(`Added ${texts.length} sample${texts.length === 1 ? "" : "s"}.`);
  }

  function removeSample(i: number) {
    if (samples.length <= 1) return;
    samples = samples.filter((_, idx) => idx !== i);
    // Keep the same sample selected when a tab to its left goes away.
    if (i < activeIndex || activeIndex >= samples.length) activeIndex -= 1;
    rootNamePinned = false;
  }

  // ---- Drag and drop onto the input panel ------------------------------

  function hasFiles(e: DragEvent) {
    return Array.from(e.dataTransfer?.types ?? []).includes("Files");
  }
  function onDragEnter(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
  }
  function onDragOver(e: DragEvent) {
    if (hasFiles(e)) e.preventDefault();
  }
  function onDragLeave(e: DragEvent) {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
  }
  function onDrop(e: DragEvent) {
    if (!hasFiles(e)) return;
    // Capture phase: stop CodeMirror from also inserting the file text.
    e.preventDefault();
    e.stopPropagation();
    dragDepth = 0;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) void readFiles(files, addSamples);
  }

  // ---- Output actions -------------------------------------------------

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function notify(text: string, tone: "info" | "error" = "info") {
    toast = { text, tone };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast = null; }, 2600);
  }

  async function copyWithFallback(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  async function copyZig() {
    if (!displayCode) return;
    if (await copyWithFallback(displayCode)) {
      copied = true;
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => { copied = false; }, 1400);
    } else {
      notify("Clipboard is unavailable. Select the code and copy it manually.", "error");
    }
  }

  function downloadZig() {
    downloadBlob(displayCode || "", `${effectiveRoot}.zig`, "text/plain");
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

  async function copySnippet(text: string, what: string) {
    const ok = await copyWithFallback(text);
    notify(ok ? `${what} copied.` : "Clipboard is unavailable.", ok ? "info" : "error");
  }

  // The output-variant actions.  Each builds its content from the current
  // generated state so a stale value can never leak into the clipboard /
  // download.  Format defaults to JSON when the pipeline hasn't resolved
  // one yet (no samples or mixed) — matches CLI.
  async function copyParser() {
    if (!generated.normalized) return;
    const fmt: Format = generated.resolvedFormat ?? "json";
    await copySnippet(emitParserHelper(effectiveRoot, target, fmt).trim() + "\n", "Parse helper");
  }

  async function copyBuildSnippet() {
    await copySnippet(emitBuildSnippet(target).trim() + "\n", "build.zig snippet");
  }

  async function copyTestScaffold() {
    if (!generated.normalized) return;
    const sample = (samples[activeIndex] ?? samples[0] ?? "").trim();
    if (!sample) return;
    const fmt: Format = generated.resolvedFormat ?? "json";
    await copySnippet(emitTestScaffold(effectiveRoot, sample, target, fmt).trim() + "\n", "Test scaffold");
  }

  function downloadReport() {
    if (!generated.normalized) return;
    const report = buildReport(generated.normalized, generated.warnings);
    downloadBlob(
      JSON.stringify(report, null, 2) + "\n",
      `${effectiveRoot}.schema.json`,
      "application/json",
    );
  }

  function sharedOptions(): { options?: OptionEdits } {
    return editCount > 0 ? { options: { ...optionEdits } } : {};
  }

  async function shareConfig() {
    const hash = encodeShareConfig({ rootName, target, format, presetId, ...sharedOptions() });
    const url = window.location.origin + window.location.pathname + hash;
    replaceState(hash, {});
    const ok = await copyWithFallback(url);
    notify(ok ? "Link to these settings copied." : "Link is in the address bar.");
  }

  async function shareWithSamples() {
    try {
      const hash = encodeShareWithSamples({ rootName, target, format, presetId, ...sharedOptions(), samples });
      const url = window.location.origin + window.location.pathname + hash;
      replaceState(hash, {});
      const ok = await copyWithFallback(url);
      notify(ok ? "Link with samples copied." : "Link with samples is in the address bar.");
    } catch (e) {
      if (e instanceof ShareTooLargeError) {
        notify(`Samples are too large to share (${formatBytes(e.size)} of 8 KB). Share settings only.`, "error");
      } else {
        notify("Couldn't build the share link.", "error");
      }
    }
  }

  onMount(() => {
    import("$lib/zigfmt")
      .then((m) => m.loadZigFmt())
      .then((fmt) => { zigFmt = fmt; })
      .catch((e) => { zigFmtLoadError = (e as Error).message; });

    const decoded = decodeShareHash(window.location.hash);
    if (!decoded) return;
    rootName = decoded.rootName;
    rootNamePinned = true;
    target = decoded.target;
    format = decoded.format;
    if (PRESETS.some((p) => p.id === decoded.presetId)) presetId = decoded.presetId;
    optionEdits = decoded.options ?? {};
    if (editCount > 0) optionsOpen = true;
    if (decoded.samples && decoded.samples.length > 0) {
      samples = [...decoded.samples];
      activeIndex = 0;
    }
  });

  // ---- Jump to source ---------------------------------------------------

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

<div class="playground">
  <Toolbar
    bind:rootName
    bind:target
    bind:format
    bind:presetId
    bind:optionsOpen
    {editCount}
    onPresetChange={() => (optionEdits = {})}
    {detectedFormat}
    {detectedConfidence}
    onLoadExample={loadExample}
    onShareConfig={shareConfig}
    onShareWithSamples={shareWithSamples}
    onRootNameInput={() => (rootNamePinned = true)}
    {suggestedRoot}
    rootAuto={!rootNamePinned}
  />

  {#if optionsOpen}
    <OptionsPanel
      {options}
      edits={optionEdits}
      presetLabel={PRESETS.find((p) => p.id === presetId)?.label ?? presetId}
      {target}
      {cli}
      onChange={setOption}
      onReset={() => (optionEdits = {})}
      onCopyCli={() => copySnippet(cli, "CLI command")}
    />
  {/if}

  <div class="workspace">
    <section
      class="panel"
      class:dragging={dragDepth > 0}
      aria-label="Input"
      ondragentercapture={onDragEnter}
      ondragovercapture={onDragOver}
      ondragleavecapture={onDragLeave}
      ondropcapture={onDrop}
    >
      <header class="panel-head">
        <SampleTabs
          {samples}
          {activeIndex}
          {errorTabs}
          onSelect={(i) => (activeIndex = i)}
          onAdd={addSample}
          onRemove={removeSample}
        />
        <SampleSource onAddSamples={addSamples} />
      </header>
      <div class="panel-body">
        <Editor
          value={activeSample}
          onChange={updateActive}
          language={editorLanguage}
          highlight={inputHighlight}
          placeholder="Paste JSON, YAML, TOML or XML, or a curl command with a -d body"
          label="Input sample"
        />
      </div>
      <footer class="status">
        <span class="strong">{inputFormatLabel}</span>
        {#if format === "auto" && detectedConfidence !== null}
          <span title="Auto-detect confidence">{Math.round(detectedConfidence * 100)}% sure</span>
        {/if}
        <span>{inputLines} line{inputLines === 1 ? "" : "s"}</span>
        <span>{inputSize}</span>
        <span class="grow"></span>
        {#if formatMismatch}
          <button type="button" class="suggest" onclick={acceptFormatSuggestion}>
            Looks like {FORMAT_LABEL[formatMismatch]}. Parse as {FORMAT_LABEL[formatMismatch]}
          </button>
        {:else}
          <span class="hint">Drop files here to add samples</span>
        {/if}
      </footer>
      {#if dragDepth > 0}
        <div class="drop" aria-hidden="true">
          <span>Drop to add as {samples.length === 1 && !samples[0]?.trim() ? "the sample" : "new samples"}</span>
        </div>
      {/if}
    </section>

    <section class="panel" aria-label="Generated Zig">
      <header class="panel-head out">
        <span class="file">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1h4.5l2.5 2.5V11h-7z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" /><path d="M7 1v2.5h2.5" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" /></svg>
          <code>{effectiveRoot}.zig</code>
        </span>
        <span class="actions">
          <button type="button" class="btn sm" onclick={copyZig} disabled={!displayCode} aria-live="polite">
            {#if copied}
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3" fill="none" stroke="var(--ok)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
              Copied
            {:else}
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.1" /><path d="M8.5 1.5h-6a1 1 0 0 0-1 1v6" fill="none" stroke="currentColor" stroke-width="1.1" /></svg>
              Copy
            {/if}
          </button>
          <button type="button" class="btn sm icon" onclick={downloadZig} disabled={!displayCode} title="Download {effectiveRoot}.zig" aria-label="Download {effectiveRoot}.zig">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5V8M3.5 5.5L6 8l2.5-2.5M1.5 8.5v2h9v-2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <Menu label="More" size="sm" variant="ghost" align="end" width="280px">
            <div class="menu-heading">Copy companion code</div>
            <button type="button" class="menu-item" role="menuitem" onclick={copyParser} disabled={!displayCode}>
              <span>Parse helper</span>
              <small>parse{effectiveRoot}(allocator, input) for the detected format</small>
            </button>
            <button type="button" class="menu-item" role="menuitem" onclick={copyTestScaffold} disabled={!displayCode}>
              <span>Test scaffold</span>
              <small>A zig test that parses the active sample</small>
            </button>
            <button type="button" class="menu-item" role="menuitem" onclick={copyBuildSnippet}>
              <span>build.zig snippet</span>
              <small>Dependency wiring for {target === "serde-zig" ? "serde.zig" : "std.json"}</small>
            </button>
            <div class="menu-sep"></div>
            <button type="button" class="menu-item" role="menuitem" onclick={downloadReport} disabled={!displayCode}>
              <span>Download schema report</span>
              <small>{effectiveRoot}.schema.json for zigshape --check-drift in CI</small>
            </button>
          </Menu>
        </span>
      </header>
      <div class="panel-body">
        <Editor value={displayCode} language="zig" readonly label="Generated Zig" />
        {#if !displayCode}
          <div class="empty">
            {#if firstError}
              <p class="empty-title">The input doesn't parse yet</p>
              <button type="button" class="empty-error" onclick={() => jumpToWarning(firstError)}>
                {firstError.message}
              </button>
              {#if formatMismatch}
                <p class="empty-hint">
                  The input is parsed as {FORMAT_LABEL[format as Format]}, but it looks like {FORMAT_LABEL[formatMismatch]}.
                </p>
                <button type="button" class="btn primary" onclick={acceptFormatSuggestion}>
                  Parse as {FORMAT_LABEL[formatMismatch]}
                </button>
              {:else}
                <p class="empty-hint">Fix it on the left, or pick a different format in the toolbar.</p>
              {/if}
            {:else}
              <p class="empty-title">Nothing to generate yet</p>
              <p class="empty-hint">Paste a payload on the left, upload a file, or load one from Examples.</p>
            {/if}
          </div>
        {/if}
      </div>
      <footer class="status">
        {#if !displayCode}
          <span>Waiting for input</span>
        {:else if formatterError}
          <span class="fmt bad" title={formatterError}><span class="dot"></span>zig fmt failed, showing raw output</span>
        {:else if zigFmt}
          <span class="fmt ok"><span class="dot"></span>zig fmt</span>
        {:else}
          <span class="fmt"><span class="dot"></span>loading zig fmt</span>
        {/if}
        {#if declSummary}<span>{declSummary}</span>{/if}
        <span class="grow"></span>
        {#if displayCode}<span>{outputLines} lines</span>{/if}
      </footer>
    </section>
  </div>

  <div class="report">
    <Warnings warnings={generated.warnings} {samples} onJump={jumpToWarning} />
    <Inspector
      decls={generated.decls}
      {overrides}
      onJump={jumpToPath}
      onSetOverride={setOverride}
      onClearAll={clearAllOverrides}
    />
  </div>
</div>

{#if toast}
  <div class="toast" class:error={toast.tone === "error"} role="status">{toast.text}</div>
{/if}

<style>
  .playground {
    display: flex;
    flex-direction: column;
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px;
    height: clamp(420px, calc(100vh - 320px), 760px);
  }

  .panel {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--editor-bg);
    overflow: hidden;
  }
  .panel:focus-within {
    border-color: var(--border-strong);
  }
  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex: none;
    height: 38px;
    padding: 0 6px 0 4px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-2);
  }
  .panel-head.out {
    padding-left: 12px;
  }
  .file {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    color: var(--text-3);
  }
  .file code {
    overflow: hidden;
    color: var(--text);
    font-size: 12.5px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .panel-body {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 14px;
    flex: none;
    height: 28px;
    padding: 0 12px;
    border-top: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-3);
    font-size: 11.5px;
    white-space: nowrap;
    overflow: hidden;
  }
  .status .strong {
    color: var(--text-2);
    font-weight: 500;
  }
  .status .grow {
    flex: 1;
  }
  .fmt {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .fmt .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--border-strong);
  }
  .fmt.ok .dot {
    background: var(--ok);
  }
  .fmt.bad {
    color: var(--error);
  }
  .fmt.bad .dot {
    background: var(--error);
  }

  .suggest {
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    font-size: 11.5px;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .drop {
    position: absolute;
    inset: 6px;
    z-index: 5;
    display: grid;
    place-items: center;
    border: 1.5px dashed var(--accent);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--surface) 86%, transparent);
    color: var(--text);
    font-size: 13px;
    font-weight: 500;
    pointer-events: none;
  }

  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 24px;
    background: var(--editor-bg);
    text-align: center;
  }
  .empty-title {
    margin: 0;
    color: var(--text);
    font-size: 13.5px;
    font-weight: 500;
  }
  .empty-hint {
    margin: 0;
    max-width: 36ch;
    color: var(--text-3);
    font-size: 12.5px;
  }
  .empty .btn {
    margin-top: 6px;
  }
  .empty-error {
    max-width: 48ch;
    padding: 4px 8px;
    border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
    border-radius: var(--radius-sm);
    background: var(--error-soft);
    color: var(--error);
    font-family: var(--font-mono);
    font-size: 12px;
    cursor: pointer;
  }

  .report {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 12px;
  }

  .toast {
    position: fixed;
    left: 50%;
    bottom: 24px;
    z-index: 50;
    max-width: calc(100vw - 32px);
    padding: 9px 14px;
    border-radius: var(--radius);
    background: var(--primary);
    color: var(--primary-text);
    box-shadow: var(--shadow-pop);
    font-size: 13px;
    transform: translateX(-50%);
    animation: toast-in 0.16s ease-out;
  }
  .toast.error {
    background: var(--error);
    color: #fff;
  }
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translate(-50%, 6px);
    }
  }

  @media (max-width: 900px) {
    .workspace {
      grid-template-columns: minmax(0, 1fr);
      height: auto;
    }
    .panel {
      height: 400px;
    }
    .hint {
      display: none;
    }
  }
</style>
