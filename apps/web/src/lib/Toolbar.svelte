<script lang="ts">
  import { EXAMPLES, type Example } from "./examples";

  type Props = {
    rootName: string;
    target: "plain" | "serde-zig";
    onLoadExample: (e: Example) => void;
    onCopy: () => void;
    onDownload: () => void;
    canCopy: boolean;
  };

  let {
    rootName = $bindable(),
    target = $bindable(),
    onLoadExample,
    onCopy,
    onDownload,
    canCopy,
  }: Props = $props();

  let exampleId = $state("");

  function pickExample(e: Event) {
    const id = (e.currentTarget as HTMLSelectElement).value;
    const ex = EXAMPLES.find((x) => x.id === id);
    if (ex) onLoadExample(ex);
    exampleId = "";
  }
</script>

<div class="toolbar">
  <label>Root struct
    <input bind:value={rootName} placeholder="User" spellcheck="false" />
  </label>
  <label>Target
    <select bind:value={target}>
      <option value="plain">plain</option>
      <option value="serde-zig">serde.zig</option>
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

<style>
  .toolbar {
    display: flex;
    gap: 1rem;
    align-items: end;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  .toolbar label {
    display: flex;
    flex-direction: column;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #666;
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
</style>
