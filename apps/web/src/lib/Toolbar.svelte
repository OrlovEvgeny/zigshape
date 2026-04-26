<script lang="ts">
  import type { Format } from "@zigshape/core";
  import { EXAMPLES, type Example } from "./examples";
  import { PRESETS, type PresetId } from "./presets";

  type FormatArg = "auto" | Format;

  type Props = {
    rootName: string;
    target: "plain" | "serde-zig";
    format: FormatArg;
    detectedFormat: Format | null;
    presetId: PresetId;
    onLoadExample: (e: Example) => void;
    onCopy: () => void;
    onDownload: () => void;
    canCopy: boolean;
  };

  let {
    rootName = $bindable(),
    target = $bindable(),
    format = $bindable(),
    detectedFormat,
    presetId = $bindable(),
    onLoadExample,
    onCopy,
    onDownload,
    canCopy,
  }: Props = $props();

  let exampleId = $state("");
  let advancedOpen = $state(false);

  function pickExample(e: Event) {
    const id = (e.currentTarget as HTMLSelectElement).value;
    const ex = EXAMPLES.find((x) => x.id === id);
    if (ex) onLoadExample(ex);
    exampleId = "";
  }

  const currentPreset = $derived(PRESETS.find((p) => p.id === presetId));
</script>

<div class="toolbar">
  <label>Root struct
    <input bind:value={rootName} placeholder="User" spellcheck="false" />
  </label>
  <label>Format
    <select bind:value={format}>
      <option value="auto">auto{detectedFormat ? ` (${detectedFormat})` : ""}</option>
      <option value="json">JSON</option>
      <option value="yaml">YAML</option>
      <option value="toml">TOML</option>
      <option value="xml">XML</option>
    </select>
  </label>
  <label>Target
    <select bind:value={target}>
      <option value="plain">plain</option>
      <option value="serde-zig">serde.zig</option>
    </select>
  </label>
  <label>Preset
    <select bind:value={presetId}>
      {#each PRESETS as p (p.id)}
        <option value={p.id}>{p.label}</option>
      {/each}
    </select>
  </label>
  <label class="example-picker">Example
    <select bind:value={exampleId} onchange={pickExample}>
      <option value="" disabled>Choose…</option>
      {#each EXAMPLES as ex (ex.id)}
        <option value={ex.id}>{ex.label}</option>
      {/each}
    </select>
  </label>
  <span class="spacer"></span>
  <button type="button" onclick={onCopy} disabled={!canCopy}>Copy Zig</button>
  <button type="button" onclick={onDownload} disabled={!canCopy}>Download</button>
</div>

{#if currentPreset}
  <p class="preset-desc">{currentPreset.description}
    <button type="button" class="advanced" onclick={() => (advancedOpen = !advancedOpen)}>
      {advancedOpen ? "hide" : "advanced…"}
    </button>
  </p>
{/if}

{#if advancedOpen}
  <p class="advanced-note">Advanced overrides for individual inference flags arrive in v0.2.1. For now, presets bundle the available knobs.</p>
{/if}

<style>
  .toolbar {
    display: flex;
    gap: 1rem;
    align-items: end;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }
  .toolbar label {
    display: flex;
    flex-direction: column;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #666;
  }
  .toolbar label.checkbox-label {
    flex-direction: row;
    align-items: center;
    gap: 0.35rem;
    text-transform: none;
    letter-spacing: 0;
    color: #222;
    font-size: 0.85rem;
  }
  .toolbar input,
  .toolbar select {
    margin-top: 0.25rem;
    padding: 0.35rem 0.5rem;
    font-size: 0.9rem;
    text-transform: none;
    color: #222;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
  }
  .toolbar label.checkbox-label input { margin-top: 0; }
  .toolbar input { min-width: 8rem; }
  .toolbar button {
    padding: 0.4rem 0.85rem;
    font-size: 0.85rem;
    border: 1px solid #ccc;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
  }
  .toolbar button:disabled { opacity: 0.4; cursor: not-allowed; }
  .toolbar button:hover:not(:disabled) { background: #f3f3f3; }
  .spacer { flex: 1 1 auto; }
  .example-picker { min-width: 14rem; }
  .preset-desc {
    color: #666;
    font-size: 0.8rem;
    margin: 0 0 1rem;
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
  }
  .preset-desc .advanced {
    background: none;
    border: 0;
    color: #2a6;
    cursor: pointer;
    padding: 0;
    font-size: 0.8rem;
    text-decoration: underline;
  }
  .advanced-note {
    color: #888;
    font-size: 0.8rem;
    margin: 0 0 1rem;
    padding: 0.5rem 0.75rem;
    background: #fafafa;
    border-left: 3px solid #ddd;
    border-radius: 0 4px 4px 0;
  }
</style>
