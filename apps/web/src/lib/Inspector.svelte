<script lang="ts">
  import type { Decl, FieldOverride, Overrides, ZigField } from "@zigshape/core";
  import { renderZigType } from "@zigshape/core";

  type Props = {
    decls: Decl[];
    overrides: Overrides;
    onJump: (path: string) => void;
    onSetOverride: (path: string, override: FieldOverride | null) => void;
    onClearAll: () => void;
  };

  let { decls, overrides, onJump, onSetOverride, onClearAll }: Props = $props();

  // Path of the field whose inline editor is currently open.  Only one open
  // at a time so the panel stays compact.
  let editingPath = $state<string | null>(null);

  let draftType = $state("");
  let draftName = $state("");
  let draftOptionalMode = $state<"inferred" | "true" | "false">("inferred");

  function startEdit(f: ZigField) {
    editingPath = f.path;
    const ov = overrides[f.path] ?? {};
    draftType = ov.type ?? "";
    draftName = ov.name ?? "";
    draftOptionalMode =
      ov.optional === undefined ? "inferred" : ov.optional ? "true" : "false";
  }

  function cancelEdit() { editingPath = null; }

  function saveEdit(path: string) {
    const next: FieldOverride = {};
    if (draftType.trim() !== "") next.type = draftType.trim();
    if (draftName.trim() !== "") next.name = draftName.trim();
    if (draftOptionalMode !== "inferred") next.optional = draftOptionalMode === "true";
    if (Object.keys(next).length === 0) {
      onSetOverride(path, null);
    } else {
      onSetOverride(path, next);
    }
    editingPath = null;
  }

  function resetField(path: string) {
    onSetOverride(path, null);
    if (editingPath === path) editingPath = null;
  }

  function reasonText(f: ZigField): string {
    const optional = f.defaultExpr === "null";
    if (!optional) return `${f.observedCount}/${f.parentTotal} samples — required`;
    const ratio = `${f.observedCount}/${f.parentTotal}`;
    switch (f.optionalReason) {
      case "missing":
        return `${ratio} samples — optional (missing in ${f.parentTotal - f.observedCount})`;
      case "null":
        return `${ratio} samples — optional (null observed)`;
      case "missing-and-null":
        return `${ratio} samples — optional (missing and null both observed)`;
      default:
        return `${ratio} samples — optional`;
    }
  }

  function kindBreakdown(f: ZigField): string | null {
    if (!f.kindCounts) return null;
    const parts: string[] = [];
    for (const [k, c] of Object.entries(f.kindCounts)) {
      if (c > 0) parts.push(`${k}: ${c}`);
    }
    const missing = f.parentTotal - f.observedCount;
    if (missing > 0) parts.push(`missing: ${missing}`);
    return parts.length > 0 ? parts.join(" · ") : null;
  }

  const overrideCount = $derived(Object.keys(overrides).length);
</script>

{#if decls.length > 0}
  <section class="inspector">
    <div class="header">
      <h2>Field decisions</h2>
      {#if overrideCount > 0}
        <button type="button" class="clear-all" onclick={onClearAll}>
          Clear {overrideCount} override{overrideCount === 1 ? "" : "s"}
        </button>
      {/if}
    </div>
    <div class="decls">
      {#each decls as decl (decl.name)}
        <details open>
          <summary>
            <span class="kind">{decl.kind}</span>
            <span class="struct">{decl.name}</span>
            <span class="path">{decl.path}</span>
          </summary>
          {#if decl.kind === "struct"}
            {#if decl.fields.length === 0}
              <p class="empty">(no fields)</p>
            {:else}
              <ul>
                {#each decl.fields as f (f.name)}
                  <li class:open={editingPath === f.path}>
                    <button type="button" class="row" onclick={() => onJump(f.path)}>
                      <code class="field">{f.name}</code>
                      <span class="type">: {renderZigType(f.type)}</span>
                      {#if f.defaultExpr !== undefined}<span class="default"> = {f.defaultExpr}</span>{/if}
                      {#if f.overridden}<span class="badge">overridden</span>{/if}
                      {#if f.aliases && f.aliases.length > 0}
                        <span class="badge alias">aliases: {f.aliases.join(", ")}</span>
                      {/if}
                      <span class="reason">{reasonText(f)}</span>
                      {#if kindBreakdown(f)}
                        <span class="breakdown">{kindBreakdown(f)}</span>
                      {/if}
                      {#if f.renamed}
                        <span class="rename">renamed from <code>{f.originalKey}</code></span>
                      {/if}
                    </button>
                    <span class="actions">
                      {#if editingPath === f.path}
                        <button type="button" class="link" onclick={cancelEdit}>cancel</button>
                      {:else}
                        <button type="button" class="link" onclick={() => startEdit(f)}>override…</button>
                      {/if}
                      {#if f.overridden}
                        <button type="button" class="link" onclick={() => resetField(f.path)}>reset</button>
                      {/if}
                    </span>
                    {#if editingPath === f.path}
                      <div class="editor">
                        <label>
                          <span>Type (raw Zig)</span>
                          <input bind:value={draftType} placeholder="[]const u8" spellcheck="false" />
                        </label>
                        <label>
                          <span>Name</span>
                          <input bind:value={draftName} placeholder={f.name} spellcheck="false" />
                        </label>
                        <label>
                          <span>Optional</span>
                          <select bind:value={draftOptionalMode}>
                            <option value="inferred">inferred</option>
                            <option value="true">force optional</option>
                            <option value="false">force required</option>
                          </select>
                        </label>
                        <button type="button" class="primary" onclick={() => saveEdit(f.path)}>Save</button>
                      </div>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}
          {:else if decl.kind === "enum"}
            {#if decl.variants.length === 0}
              <p class="empty">(no variants)</p>
            {:else}
              <ul>
                {#each decl.variants as v (v.zigName)}
                  <li>
                    <button type="button" class="row" onclick={() => onJump(decl.path)}>
                      <code class="field">{v.zigName}</code>
                      <span class="reason">observed {v.observedCount}× — value <code>{v.rawValue}</code></span>
                      {#if v.renamed}
                        <span class="rename">renamed from <code>{v.rawValue}</code></span>
                      {/if}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          {:else}
            {#if decl.variants.length === 0}
              <p class="empty">(no variants)</p>
            {:else}
              <ul>
                {#each decl.variants as v (v.zigName)}
                  <li>
                    <button type="button" class="row" onclick={() => onJump(decl.path)}>
                      <code class="field">{v.zigName}</code>
                      <span class="reason">tag <code>{decl.tagField}</code> = <code>{v.tagValue}</code> · observed {v.observedCount}×</span>
                      {#if v.renamed}
                        <span class="rename">renamed from <code>{v.tagValue}</code></span>
                      {/if}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          {/if}
        </details>
      {/each}
    </div>
  </section>
{/if}

<style>
  .inspector { margin-top: 1.5rem; }
  .header { display: flex; align-items: baseline; gap: 1rem; }
  .header h2 { font-size: 0.9rem; margin: 0 0 0.5rem; }
  .clear-all {
    background: none;
    border: 0;
    color: #2a6;
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0;
    text-decoration: underline;
  }
  .decls details {
    margin-bottom: 0.5rem;
    background: #fff;
    border: 1px solid #e3e3e3;
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
  }
  summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    font-size: 0.85rem;
  }
  summary::-webkit-details-marker { display: none; }
  summary::before {
    content: "▸";
    font-size: 0.7rem;
    color: #888;
  }
  details[open] summary::before { content: "▾"; }
  .kind {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888;
    background: #f0f0f0;
    padding: 0 0.35rem;
    border-radius: 2px;
  }
  .struct { font-weight: 600; }
  .path { color: #888; font-size: 0.75rem; font-family: ui-monospace, monospace; }
  ul { list-style: none; padding: 0; margin: 0.5rem 0 0; }
  li {
    border-radius: 3px;
    padding: 0;
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
  }
  li.open { background: #f7faff; }
  li button.row {
    flex: 1 1 auto;
    text-align: left;
    background: none;
    border: 0;
    padding: 0.35rem 0.5rem;
    cursor: pointer;
    font: inherit;
    color: inherit;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
  }
  li button.row:hover { background: #f3f6ff; }
  .actions {
    display: flex;
    gap: 0.4rem;
    padding: 0 0.5rem;
  }
  .actions .link {
    background: none;
    border: 0;
    color: #2a6;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0;
    text-decoration: underline;
  }
  .field { font-family: ui-monospace, monospace; font-size: 0.85rem; }
  .type { color: #555; font-size: 0.85rem; }
  .default { color: #888; font-size: 0.85rem; }
  .badge {
    background: #fff3d3;
    color: #8b6a00;
    border-radius: 2px;
    padding: 0 0.3rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .badge.alias { background: #e6f4ff; color: #205085; }
  .reason { color: #666; font-size: 0.75rem; flex: 1 1 auto; }
  .reason code { background: #eef; padding: 0 0.25rem; border-radius: 2px; }
  .breakdown {
    color: #466;
    font-size: 0.7rem;
    font-family: ui-monospace, monospace;
    background: #f0f7f3;
    padding: 0.05rem 0.4rem;
    border-radius: 2px;
  }
  .rename { font-size: 0.75rem; color: #2a6; }
  .rename code { background: #eef9f0; padding: 0 0.25rem; border-radius: 2px; }
  .empty { color: #888; font-size: 0.8rem; margin: 0.25rem 0 0; }
  .editor {
    flex: 1 1 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: end;
    padding: 0.5rem;
    background: #f7faff;
    border-top: 1px solid #e3e6f3;
    border-radius: 0 0 3px 3px;
  }
  .editor label {
    display: flex;
    flex-direction: column;
    font-size: 0.7rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .editor input,
  .editor select {
    margin-top: 0.2rem;
    padding: 0.3rem 0.5rem;
    font-size: 0.85rem;
    text-transform: none;
    color: #222;
    border: 1px solid #ccc;
    border-radius: 3px;
    background: #fff;
    min-width: 9rem;
  }
  .editor button.primary {
    padding: 0.35rem 0.85rem;
    font-size: 0.85rem;
    border: 1px solid #6c8aff;
    background: #6c8aff;
    color: #fff;
    border-radius: 3px;
    cursor: pointer;
  }
  .editor button.primary:hover { filter: brightness(1.05); }
</style>
