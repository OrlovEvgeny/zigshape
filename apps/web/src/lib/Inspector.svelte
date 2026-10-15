<script lang="ts">
  import type { Decl, FieldOverride, Overrides, ZigField } from "@zigshape/core";
  import { renderZigType, suggestAlternatives } from "@zigshape/core";

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
    if (editingPath === f.path) {
      editingPath = null;
      return;
    }
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

  function applyAlternative(f: ZigField, alt: string) {
    const ov = overrides[f.path] ?? {};
    onSetOverride(f.path, { ...ov, type: alt });
    editingPath = null;
  }

  function presence(f: ZigField): { label: string; detail: string | null } {
    const optional = f.defaultExpr === "null";
    if (!optional) return { label: "required", detail: null };
    const missing = f.parentTotal - f.observedCount;
    switch (f.optionalReason) {
      case "missing":
        return { label: "optional", detail: `missing in ${missing}` };
      case "null":
        return { label: "optional", detail: "null seen" };
      case "missing-and-null":
        return { label: "optional", detail: `null seen, missing in ${missing}` };
      default:
        return { label: "optional", detail: null };
    }
  }

  function kinds(f: ZigField): [string, number][] {
    const out: [string, number][] = [];
    if (f.kindCounts) {
      for (const [k, c] of Object.entries(f.kindCounts)) if (c > 0) out.push([k, c]);
    }
    return out;
  }

  function wireKeys(f: ZigField): string[] {
    const keys: string[] = [];
    if (f.renamed && f.originalKey) keys.push(f.originalKey);
    if (f.aliases) keys.push(...f.aliases);
    return keys;
  }

  function fieldCount(d: Decl): string {
    if (d.kind === "struct") return `${d.fields.length} field${d.fields.length === 1 ? "" : "s"}`;
    return `${d.variants.length} variant${d.variants.length === 1 ? "" : "s"}`;
  }

  const overrideCount = $derived(Object.keys(overrides).length);
</script>

{#if decls.length > 0}
  <section class="inspector" aria-labelledby="inspector-title">
    <header class="head">
      <div>
        <h2 id="inspector-title">Field decisions</h2>
        <p>Why each field got its type. Click a row to see it in the input; edit to override.</p>
      </div>
      {#if overrideCount > 0}
        <button type="button" class="btn sm" onclick={onClearAll}>
          Clear {overrideCount} override{overrideCount === 1 ? "" : "s"}
        </button>
      {/if}
    </header>

    {#each decls as decl (decl.name)}
      <details open class="decl">
        <summary>
          <svg class="caret" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M2 1l4 3-4 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
          <span class="kind">{decl.kind}</span>
          <code class="decl-name">{decl.name}</code>
          <code class="decl-path">{decl.path}</code>
          <span class="count">{fieldCount(decl)}</span>
        </summary>

        {#if decl.kind === "struct"}
          {#if decl.fields.length === 0}
            <p class="empty">No fields observed.</p>
          {:else}
            <div class="table">
              <div class="tr th" aria-hidden="true">
                <span>Field</span>
                <span>Type</span>
                <span>Presence</span>
                <span>Observed</span>
                <span>Wire key</span>
                <span></span>
              </div>
              {#each decl.fields as f (f.name)}
                {@const p = presence(f)}
                {@const keys = wireKeys(f)}
                {@const ratio = f.parentTotal > 0 ? f.observedCount / f.parentTotal : 0}
                <div class="group" class:open={editingPath === f.path}>
                  <div class="tr">
                    <button type="button" class="cell-main" onclick={() => onJump(f.path)} title="Show in input">
                      <span class="c-field">
                        <code>{f.name}</code>
                        {#if f.overridden}<span class="tag accent">override</span>{/if}
                      </span>
                      <span class="c-type">
                        <code>{renderZigType(f.type)}</code>
                        {#if f.defaultExpr !== undefined}<code class="default">= {f.defaultExpr}</code>{/if}
                      </span>
                      <span class="c-presence">
                        <span class="meter" aria-hidden="true"><span style:width="{Math.round(ratio * 100)}%"></span></span>
                        <span class="ratio">{f.observedCount}/{f.parentTotal}</span>
                        <span class="plabel" class:optional={p.label === "optional"}>{p.label}</span>
                        {#if p.detail}<span class="pdetail">{p.detail}</span>{/if}
                      </span>
                      <span class="c-kinds">
                        {#each kinds(f) as [k, c] (k)}
                          <span class="kindcount">{k}<b>{c}</b></span>
                        {:else}
                          <span class="muted">—</span>
                        {/each}
                      </span>
                      <span class="c-wire">
                        {#if keys.length > 0}
                          {#each keys as k, i (k)}<code class:alias={i > 0 || !f.renamed}>{k}</code>{/each}
                        {:else}
                          <span class="muted">same</span>
                        {/if}
                      </span>
                    </button>
                    <span class="c-actions">
                      {#if f.overridden}
                        <button type="button" class="btn ghost sm" onclick={() => resetField(f.path)}>Reset</button>
                      {/if}
                      <button
                        type="button"
                        class="btn ghost sm"
                        aria-expanded={editingPath === f.path}
                        onclick={() => startEdit(f)}
                      >Edit</button>
                    </span>
                  </div>

                  {#if editingPath === f.path}
                    {@const alts = suggestAlternatives(f.type)}
                    <div class="editor">
                      {#if alts.length > 0}
                        <div class="alts">
                          <span class="label">Alternatives</span>
                          {#each alts as alt (alt)}
                            <button type="button" class="alt" onclick={() => applyAlternative(f, alt)} title="Apply as override">
                              <code>{alt}</code>
                            </button>
                          {/each}
                        </div>
                      {/if}
                      <form
                        class="form"
                        onsubmit={(e) => {
                          e.preventDefault();
                          saveEdit(f.path);
                        }}
                      >
                        <label>
                          <span class="label">Type (raw Zig)</span>
                          <input class="input mono" bind:value={draftType} placeholder={renderZigType(f.type)} spellcheck="false" />
                        </label>
                        <label>
                          <span class="label">Name</span>
                          <input class="input mono" bind:value={draftName} placeholder={f.name} spellcheck="false" />
                        </label>
                        <label>
                          <span class="label">Optional</span>
                          <select class="select" bind:value={draftOptionalMode}>
                            <option value="inferred">inferred</option>
                            <option value="true">force optional</option>
                            <option value="false">force required</option>
                          </select>
                        </label>
                        <span class="form-actions">
                          <button type="button" class="btn ghost" onclick={cancelEdit}>Cancel</button>
                          <button type="submit" class="btn primary">Apply</button>
                        </span>
                      </form>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {:else if decl.kind === "enum"}
          {#if decl.variants.length === 0}
            <p class="empty">No variants observed.</p>
          {:else}
            <div class="table variants">
              <div class="tr th" aria-hidden="true">
                <span>Variant</span>
                <span>Wire value</span>
                <span>Observed</span>
              </div>
              {#each decl.variants as v (v.zigName)}
                <button type="button" class="tr vrow" onclick={() => onJump(decl.path)}>
                  <span><code>{v.zigName}</code></span>
                  <span><code class="wire">"{v.rawValue}"</code></span>
                  <span class="muted">{v.observedCount}×</span>
                </button>
              {/each}
            </div>
          {/if}
        {:else}
          {#if decl.variants.length === 0}
            <p class="empty">No variants observed.</p>
          {:else}
            <div class="table variants">
              <div class="tr th" aria-hidden="true">
                <span>Variant</span>
                <span>Discriminator</span>
                <span>Observed</span>
              </div>
              {#each decl.variants as v (v.zigName)}
                <button type="button" class="tr vrow" onclick={() => onJump(decl.path)}>
                  <span><code>{v.zigName}</code></span>
                  <span><code class="wire">{decl.tagField} = "{v.tagValue}"</code></span>
                  <span class="muted">{v.observedCount}×</span>
                </button>
              {/each}
            </div>
          {/if}
        {/if}
      </details>
    {/each}
  </section>
{/if}

<style>
  .inspector {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    overflow: hidden;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-2);
  }
  .head h2 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }
  .head p {
    margin: 1px 0 0;
    color: var(--text-3);
    font-size: 12px;
  }

  .decl + .decl {
    border-top: 1px solid var(--border);
  }
  summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    list-style: none;
    cursor: pointer;
    user-select: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary:hover {
    background: var(--surface-hover);
  }
  .caret {
    color: var(--text-3);
    transition: transform 0.12s;
  }
  details[open] .caret {
    transform: rotate(90deg);
  }
  .kind {
    color: var(--text-3);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .decl-name {
    color: var(--syn-type);
    font-size: 13px;
    font-weight: 500;
  }
  .decl-path {
    color: var(--text-3);
    font-size: 12px;
  }
  .count {
    margin-left: auto;
    color: var(--text-3);
    font-size: 12px;
  }
  .empty {
    margin: 0;
    padding: 4px 14px 14px 32px;
    color: var(--text-3);
    font-size: 12.5px;
  }

  /* Field table: one grid template shared by header and rows. */
  .table {
    --cols: minmax(130px, 1.1fr) minmax(130px, 1.3fr) minmax(170px, 1.3fr) minmax(110px, 1fr) minmax(90px, 0.9fr);
    padding: 0 6px 8px;
  }
  .tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }
  .th {
    grid-template-columns: var(--cols) 92px;
    padding: 2px 8px 6px 26px;
    color: var(--text-3);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .group {
    border-radius: var(--radius-sm);
  }
  .group.open {
    background: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--border);
  }
  .cell-main {
    display: grid;
    grid-template-columns: var(--cols);
    align-items: center;
    min-width: 0;
    padding: 7px 8px 7px 26px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: inherit;
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
  }
  .cell-main:hover {
    background: var(--surface-hover);
  }
  .cell-main > span {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    min-width: 0;
    padding-right: 12px;
  }
  .c-field code {
    color: var(--text);
    font-weight: 500;
  }
  .c-type code {
    color: var(--syn-type);
    word-break: break-all;
  }
  .c-type .default {
    color: var(--text-3);
  }
  .c-presence {
    font-size: 12px;
  }
  .meter {
    position: relative;
    width: 34px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    overflow: hidden;
  }
  .meter span {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 2px;
    background: var(--text-2);
  }
  .ratio {
    color: var(--text-2);
    font-family: var(--font-mono);
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
  }
  .plabel {
    color: var(--text-2);
  }
  .plabel.optional {
    color: var(--warn);
  }
  .pdetail {
    color: var(--text-3);
  }
  .kindcount {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    color: var(--text-2);
    font-family: var(--font-mono);
    font-size: 11.5px;
  }
  .kindcount b {
    color: var(--text-3);
    font-weight: 400;
  }
  .c-wire code {
    color: var(--syn-string);
    font-size: 12px;
  }
  .c-wire code.alias {
    color: var(--text-2);
  }
  .muted {
    color: var(--text-3);
  }
  .tag {
    padding: 0 5px;
    border-radius: 3px;
    background: var(--surface-hover);
    color: var(--text-2);
    font-size: 10.5px;
    line-height: 16px;
  }
  .tag.accent {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .c-actions {
    display: inline-flex;
    justify-content: flex-end;
    gap: 2px;
    width: 92px;
    padding-right: 4px;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px 12px 12px 34px;
  }
  .alts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .alts .label {
    margin-right: 4px;
  }
  .alt {
    padding: 2px 7px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
    font-size: 12px;
    cursor: pointer;
  }
  .alt:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .form {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px;
  }
  .form label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .form .input {
    width: 190px;
  }
  .form-actions {
    display: inline-flex;
    gap: 6px;
    margin-left: auto;
  }

  .variants {
    --cols: minmax(130px, 1fr) minmax(160px, 2fr) minmax(80px, 1fr);
  }
  .variants .th {
    grid-template-columns: var(--cols);
  }
  .vrow {
    grid-template-columns: var(--cols);
    width: 100%;
    padding: 7px 8px 7px 26px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: inherit;
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
  }
  .vrow:hover {
    background: var(--surface-hover);
  }
  .vrow code {
    color: var(--text);
  }
  .vrow code.wire {
    color: var(--syn-string);
  }

  @media (max-width: 900px) {
    .th {
      display: none;
    }
    .cell-main {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      row-gap: 6px;
      padding-left: 12px;
    }
    .c-kinds,
    .c-wire {
      font-size: 11.5px;
    }
    .editor {
      padding-left: 12px;
    }
    .vrow {
      padding-left: 12px;
    }
  }
  @media (max-width: 560px) {
    .cell-main {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      padding-right: 0;
    }
    .c-presence {
      grid-column: 1 / -1;
    }
    .c-actions {
      width: auto;
      flex-direction: column;
      align-self: start;
      padding: 4px 4px 0 0;
    }
    .form .input {
      width: 100%;
    }
    .form label {
      flex: 1 1 100%;
    }
    .form-actions {
      margin-left: 0;
    }
  }
</style>
