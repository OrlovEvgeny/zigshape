<script lang="ts">
  import type { Diagnostic } from "@zigshape/core";

  type Props = {
    warnings: Diagnostic[];
    samples: string[];
    onJump: (d: Diagnostic) => void;
  };

  let { warnings, samples, onJump }: Props = $props();

  const counts = $derived.by(() => {
    const c = { error: 0, warning: 0, info: 0 };
    for (const w of warnings) c[w.severity]++;
    return c;
  });

  // Errors first, then warnings, then info; stable within a severity.
  const ordered = $derived.by(() => {
    const rank = { error: 0, warning: 1, info: 2 } as const;
    return warnings
      .map((w, i) => ({ w, i }))
      .sort((a, b) => rank[a.w.severity] - rank[b.w.severity] || a.i - b.i)
      .map(({ w }) => w);
  });

  function location(d: Diagnostic): string | null {
    if (!d.src) return null;
    const text = samples[d.src.sample];
    if (text === undefined) return null;
    const before = text.slice(0, d.src.offset);
    const line = before.split("\n").length;
    const col = d.src.offset - before.lastIndexOf("\n");
    const tab = samples.length > 1 ? `S${d.src.sample + 1} ` : "";
    return `${tab}${line}:${col}`;
  }

  function plural(n: number, word: string) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
  }
</script>

{#if warnings.length > 0}
  <section class="diagnostics" aria-labelledby="diag-title">
    <header>
      <h2 id="diag-title">Diagnostics</h2>
      <span class="summary">
        {#if counts.error}<span class="sev-error">{plural(counts.error, "error")}</span>{/if}
        {#if counts.warning}<span class="sev-warning">{plural(counts.warning, "warning")}</span>{/if}
        {#if counts.info}<span class="sev-info">{counts.info} info</span>{/if}
      </span>
    </header>
    <ul>
      {#each ordered as w, i (i)}
        {@const loc = location(w)}
        <li>
          <button
            type="button"
            class="row {w.severity}"
            onclick={() => onJump(w)}
            disabled={!w.src}
            title={w.src ? "Show in input" : "No source location"}
          >
            <span class="sev"><span class="mark"></span>{w.severity}</span>
            <span class="body">
              <span class="msg">{w.message}</span>
              <span class="meta">
                {#if w.path}<code>{w.path}</code>{/if}
                <code class="code">{w.code}</code>
              </span>
            </span>
            {#if loc}<span class="loc">{loc}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .diagnostics {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-2);
  }
  h2 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }
  .summary {
    display: inline-flex;
    gap: 10px;
    font-size: 12px;
  }
  .sev-error {
    color: var(--error);
  }
  .sev-warning {
    color: var(--warn);
  }
  .sev-info {
    color: var(--info);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  .row {
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 12px;
    width: 100%;
    padding: 9px 14px;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }
  .row:hover:not(:disabled) {
    background: var(--surface-hover);
  }
  .row:disabled {
    cursor: default;
  }
  .sev {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--text-2);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .mark {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--info);
  }
  .row.warning .mark {
    background: var(--warn);
  }
  .row.error .mark {
    background: var(--error);
  }
  .row.error .sev {
    color: var(--error);
  }
  .body {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    min-width: 0;
  }
  .msg {
    color: var(--text);
    font-size: 13px;
  }
  .meta {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .meta code {
    color: var(--text-2);
    font-size: 11.5px;
  }
  .meta .code {
    color: var(--text-3);
  }
  .loc {
    color: var(--text-3);
    font-family: var(--font-mono);
    font-size: 11.5px;
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    .row {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .body {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }
</style>
