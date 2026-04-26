<script lang="ts">
  import type { StructDecl, ZigField } from "@zigshape/core";
  import { renderZigType } from "@zigshape/core";

  type Props = {
    decls: StructDecl[];
    onJump: (path: string) => void;
  };

  let { decls, onJump }: Props = $props();

  function reasonText(f: ZigField): string {
    if (!f.optional) return `${f.observedCount}/${f.parentTotal} samples — required`;
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
</script>

{#if decls.length > 0}
  <section class="inspector">
    <h2>Field decisions</h2>
    <div class="decls">
      {#each decls as decl (decl.name)}
        <details open>
          <summary>
            <span class="struct">{decl.name}</span>
            <span class="path">{decl.path}</span>
          </summary>
          {#if decl.fields.length === 0}
            <p class="empty">(no fields)</p>
          {:else}
            <ul>
              {#each decl.fields as f (f.name)}
                <li>
                  <button type="button" onclick={() => onJump(f.path)}>
                    <code class="field">{f.name}</code>
                    <span class="type">: {renderZigType(f.type)}</span>
                    {#if f.defaultExpr !== undefined}<span class="default"> = {f.defaultExpr}</span>{/if}
                    <span class="reason">{reasonText(f)}</span>
                    {#if f.renamed}
                      <span class="rename">renamed from <code>{f.originalKey}</code></span>
                    {/if}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </details>
      {/each}
    </div>
  </section>
{/if}

<style>
  .inspector { margin-top: 1.5rem; }
  .inspector h2 { font-size: 0.9rem; margin: 0 0 0.5rem; }
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
  .struct { font-weight: 600; }
  .path { color: #888; font-size: 0.75rem; font-family: ui-monospace, monospace; }
  ul { list-style: none; padding: 0; margin: 0.5rem 0 0; }
  li button {
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    padding: 0.35rem 0.5rem;
    border-radius: 3px;
    cursor: pointer;
    font: inherit;
    color: inherit;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
  }
  li button:hover { background: #f3f6ff; }
  .field { font-family: ui-monospace, monospace; font-size: 0.85rem; }
  .type { color: #555; font-size: 0.85rem; }
  .default { color: #888; font-size: 0.85rem; }
  .reason { color: #666; font-size: 0.75rem; flex: 1 1 auto; }
  .rename { font-size: 0.75rem; color: #2a6; }
  .rename code { background: #eef9f0; padding: 0 0.25rem; border-radius: 2px; }
  .empty { color: #888; font-size: 0.8rem; margin: 0.25rem 0 0; }
</style>
