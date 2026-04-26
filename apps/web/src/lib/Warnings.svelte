<script lang="ts">
  import type { Diagnostic } from "@zigshape/core";

  type Props = {
    warnings: Diagnostic[];
    onJump: (d: Diagnostic) => void;
  };

  let { warnings, onJump }: Props = $props();
</script>

{#if warnings.length > 0}
  <section class="warnings">
    <h2>Diagnostics ({warnings.length})</h2>
    <ul>
      {#each warnings as w, i (i)}
        <li class={w.severity}>
          <button
            type="button"
            onclick={() => onJump(w)}
            disabled={!w.src}
            title={w.src ? `Jump to sample ${w.src.sample + 1}` : "No source location"}
          >
            <span class="sev">{w.severity}</span>
            {#if w.path}<code class="path">{w.path}</code>{/if}
            <span class="msg">{w.message}</span>
            <code class="code">{w.code}</code>
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .warnings { margin-top: 1.5rem; }
  .warnings h2 { font-size: 0.9rem; margin: 0 0 0.5rem; }
  .warnings ul { list-style: none; padding: 0; margin: 0; }
  .warnings li {
    margin-bottom: 0.25rem;
    border-left: 3px solid;
    background: #fff;
    border-radius: 0 4px 4px 0;
  }
  .warnings li.warning { border-color: #b8860b; }
  .warnings li.error { border-color: #c00; }
  .warnings li.info { border-color: #888; }
  .warnings li button {
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    padding: 0.5rem 0.75rem;
    font: inherit;
    color: inherit;
    cursor: pointer;
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .warnings li button:disabled { cursor: default; opacity: 0.85; }
  .warnings li button:hover:not(:disabled) { background: #f3f3f3; }
  .sev {
    display: inline-block;
    min-width: 4rem;
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .path { background: #eef2ff; padding: 0 0.3rem; border-radius: 2px; font-size: 0.8rem; }
  .msg { flex: 1 1 auto; font-size: 0.85rem; }
  .code { color: #999; font-size: 0.7rem; }
</style>
