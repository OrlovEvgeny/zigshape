<script lang="ts">
  import type { Format } from "@zigshape/core";
  import Menu from "./Menu.svelte";
  import { EXAMPLES, type Example } from "./examples";
  import { PRESETS, type PresetId } from "./presets";

  type FormatArg = "auto" | Format;

  type Props = {
    rootName: string;
    target: "plain" | "serde-zig";
    format: FormatArg;
    detectedFormat: Format | null;
    detectedConfidence: number | null;
    presetId: PresetId;
    optionsOpen: boolean;
    editCount: number;
    onPresetChange?: () => void;
    onLoadExample: (e: Example) => void;
    onShareConfig: () => void;
    onShareWithSamples: () => void;
    onRootNameInput?: () => void;
    suggestedRoot?: string | null;
    rootAuto?: boolean;
  };

  let {
    rootName = $bindable(),
    target = $bindable(),
    format = $bindable(),
    detectedFormat,
    detectedConfidence,
    presetId = $bindable(),
    optionsOpen = $bindable(),
    editCount,
    onPresetChange,
    onLoadExample,
    onShareConfig,
    onShareWithSamples,
    onRootNameInput,
    suggestedRoot = null,
    rootAuto = false,
  }: Props = $props();

  const FORMAT_LABEL: Record<Format, string> = {
    json: "JSON",
    ndjson: "NDJSON",
    yaml: "YAML",
    toml: "TOML",
    xml: "XML",
  };

  const autoLabel = $derived(
    detectedFormat
      ? `Auto · ${FORMAT_LABEL[detectedFormat]}${detectedConfidence !== null ? ` ${Math.round(detectedConfidence * 100)}%` : ""}`
      : "Auto-detect",
  );

  const currentPreset = $derived(PRESETS.find((p) => p.id === presetId));
</script>

<div class="toolbar">
  <div class="controls">
    <label class="ctl root">
      <span class="label">Root</span>
      <span class="root-wrap">
        <input
          class="input mono"
          bind:value={rootName}
          oninput={() => onRootNameInput?.()}
          placeholder={suggestedRoot ?? "Root"}
          spellcheck="false"
          autocomplete="off"
          aria-label="Root struct name"
        />
        {#if rootAuto}
          <span class="auto-tag" title="Suggested from the input shape. Type to pin your own name.">auto</span>
        {/if}
      </span>
    </label>

    <label class="ctl">
      <span class="label">Format</span>
      <select class="select" bind:value={format} aria-label="Input format">
        <option value="auto">{autoLabel}</option>
        <option value="json">JSON</option>
        <option value="yaml">YAML</option>
        <option value="toml">TOML</option>
        <option value="xml">XML</option>
      </select>
    </label>

    <div class="ctl">
      <span class="label" id="target-label">Target</span>
      <div class="seg" role="radiogroup" aria-labelledby="target-label">
        <button type="button" role="radio" aria-checked={target === "plain"} onclick={() => (target = "plain")}>plain</button>
        <button type="button" role="radio" aria-checked={target === "serde-zig"} onclick={() => (target = "serde-zig")}>serde.zig</button>
      </div>
    </div>

    <label class="ctl">
      <span class="label">Preset</span>
      <select class="select" bind:value={presetId} onchange={() => onPresetChange?.()} aria-label="Inference preset">
        {#each PRESETS as p (p.id)}
          <option value={p.id}>{p.label}</option>
        {/each}
      </select>
    </label>

    <button
      type="button"
      class="btn options-toggle"
      aria-expanded={optionsOpen}
      onclick={() => (optionsOpen = !optionsOpen)}
    >
      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 4h6M11 4h1M2 10h1M6 10h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /><circle cx="9.5" cy="4" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3" /><circle cx="4.5" cy="10" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3" /></svg>
      Options
      {#if editCount > 0}<span class="count">{editCount}</span>{/if}
    </button>
  </div>

  <div class="actions">
    <Menu label="Examples" variant="ghost" align="end" width="240px">
      <div class="menu-heading">Load an example</div>
      {#each EXAMPLES as ex (ex.id)}
        <button type="button" class="menu-item" role="menuitem" onclick={() => onLoadExample(ex)}>
          <span>{ex.label}</span>
          <small>{ex.samples.length} sample{ex.samples.length === 1 ? "" : "s"} · {ex.target === "serde-zig" ? "serde.zig" : "plain"}</small>
        </button>
      {/each}
    </Menu>
    <Menu label="Share" align="end" width="270px">
      <button type="button" class="menu-item" role="menuitem" onclick={onShareConfig}>
        <span>Copy link to settings</span>
        <small>Root name, format, target and preset. No input data.</small>
      </button>
      <button type="button" class="menu-item" role="menuitem" onclick={onShareWithSamples}>
        <span>Copy link with samples</span>
        <small>Embeds the input in the URL hash (up to 8 KB). Nothing is uploaded.</small>
      </button>
    </Menu>
  </div>
</div>

{#if currentPreset}
  <p class="preset-desc">
    <span class="preset-name">{currentPreset.label}{editCount > 0 ? ` + ${editCount} change${editCount === 1 ? "" : "s"}` : ""}</span>{currentPreset.description}
  </p>
{/if}

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 24px;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 20px;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ctl {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .ctl .label {
    font-size: 11px;
  }
  .root-wrap {
    position: relative;
    display: inline-flex;
  }
  .root .input {
    width: 150px;
    padding-right: 42px;
  }
  .auto-tag {
    position: absolute;
    top: 50%;
    right: 6px;
    transform: translateY(-50%);
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--surface-hover);
    color: var(--text-3);
    font-size: 10.5px;
    pointer-events: auto;
    cursor: help;
  }

  .seg {
    display: inline-flex;
    padding: 2px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }
  .seg button {
    height: 24px;
    padding: 0 10px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--text-2);
    font-family: var(--font-mono);
    font-size: 12px;
    cursor: pointer;
    transition: background-color 0.12s, color 0.12s;
  }
  .seg button:hover {
    color: var(--text);
  }
  .seg button[aria-checked="true"] {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 0 0 1px var(--border), 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .options-toggle[aria-expanded="true"] {
    background: var(--surface-hover);
  }
  .count {
    min-width: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 11px;
    line-height: 16px;
    text-align: center;
  }

  .preset-desc {
    margin: 10px 0 14px;
    color: var(--text-3);
    font-size: 12.5px;
  }
  .preset-name {
    margin-right: 8px;
    color: var(--text-2);
    font-weight: 500;
  }

  @media (max-width: 640px) {
    .controls {
      gap: 10px 14px;
    }
    .root .input {
      width: 130px;
    }
  }
</style>
