<script lang="ts">
  import { OPTION_GROUPS, type OptionEdits, type OptionKey, type WebOptions } from "./options";

  type Props = {
    options: WebOptions;
    edits: OptionEdits;
    presetLabel: string;
    target: "plain" | "serde-zig";
    cli: string;
    onChange: (key: OptionKey, value: WebOptions[OptionKey]) => void;
    onReset: () => void;
    onCopyCli: () => void;
  };

  let { options, edits, presetLabel, target, cli, onChange, onReset, onCopyCli }: Props = $props();

  const editCount = $derived(Object.keys(edits).length);
</script>

<section class="options" aria-label="Options">
  <header>
    <span class="title">Options</span>
    <span class="based">
      Based on <b>{presetLabel}</b>{#if editCount > 0}, {editCount} changed{/if}
    </span>
    <span class="grow"></span>
    <button type="button" class="btn ghost sm" onclick={onReset} disabled={editCount === 0}>Reset to preset</button>
  </header>

  <div class="groups">
    {#each OPTION_GROUPS as group (group.id)}
      {@const inactive = group.id === "serde" && target !== "serde-zig"}
      <fieldset class="group {group.id}" class:inactive>
        <legend class="label">
          {group.title}
          {#if inactive}<span class="note">applies to the serde.zig target</span>{/if}
        </legend>
        <div class="grid">
          {#each group.fields as field (field.key)}
            {@const changed = field.key in edits}
            {#if field.kind === "select"}
              <label class="field" title={field.help}>
                <span class="name">
                  {field.label}
                  {#if changed}<span class="changed" title="Changed from the preset"></span>{/if}
                </span>
                <select
                  class="select"
                  value={options[field.key]}
                  onchange={(e) => onChange(field.key, (e.currentTarget as HTMLSelectElement).value as WebOptions[OptionKey])}
                >
                  {#each field.choices as c (c.value)}
                    <option value={c.value}>{c.label}</option>
                  {/each}
                </select>
              </label>
            {:else}
              <label class="field toggle" title={field.help}>
                <input
                  type="checkbox"
                  checked={options[field.key] === true}
                  onchange={(e) => onChange(field.key, (e.currentTarget as HTMLInputElement).checked)}
                />
                <span class="name">
                  {field.label}
                  {#if changed}<span class="changed" title="Changed from the preset"></span>{/if}
                </span>
              </label>
            {/if}
          {/each}
        </div>
      </fieldset>
    {/each}
  </div>

  <footer>
    <span class="label">CLI</span>
    <code class="cli">{cli}</code>
    <button type="button" class="btn ghost sm" onclick={onCopyCli}>Copy</button>
  </footer>
</section>

<style>
  .options {
    margin: 0 0 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    animation: reveal 0.14s ease-out;
  }
  @keyframes reveal {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 40px;
    padding: 0 8px 0 14px;
    border-bottom: 1px solid var(--border);
  }
  .title {
    font-size: 13px;
    font-weight: 600;
  }
  .based {
    color: var(--text-3);
    font-size: 12px;
  }
  .based b {
    color: var(--text-2);
    font-weight: 500;
  }
  .grow {
    flex: 1;
  }

  .groups {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
    gap: 4px 28px;
    padding: 12px 14px 14px;
  }
  .group {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .group.infer {
    grid-row: span 2;
  }
  .group legend {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
    padding: 0;
  }
  .note {
    color: var(--text-3);
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
  }
  .group.inactive .grid {
    opacity: 0.5;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px 14px;
  }
  .serde .grid,
  .output .grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .field .select {
    width: 100%;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .name {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-2);
    font-size: 12px;
  }
  .toggle {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    align-self: end;
    height: 30px;
    cursor: pointer;
  }
  .toggle input {
    margin: 0;
    accent-color: var(--accent);
  }
  .toggle .name {
    color: var(--text);
    font-size: 12.5px;
  }
  .changed {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
  }

  footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 8px 8px 14px;
    border-top: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 0 0 var(--radius) var(--radius);
  }
  .cli {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    color: var(--text-2);
    font-size: 12px;
    white-space: nowrap;
    scrollbar-width: thin;
  }

  @media (max-width: 900px) {
    .groups {
      grid-template-columns: minmax(0, 1fr);
    }
    .group.infer {
      grid-row: auto;
    }
  }
</style>
