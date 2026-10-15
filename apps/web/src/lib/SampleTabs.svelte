<script lang="ts">
  type Props = {
    samples: string[];
    activeIndex: number;
    /** Tabs whose sample failed to parse; marked with a dot. */
    errorTabs?: Set<number>;
    onSelect: (i: number) => void;
    onAdd: () => void;
    onRemove: (i: number) => void;
  };

  let { samples, activeIndex, errorTabs = new Set(), onSelect, onAdd, onRemove }: Props = $props();

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next = (activeIndex + step + samples.length) % samples.length;
    onSelect(next);
    const tabs = (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("[role=tab]");
    tabs[next]?.focus();
  }
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<div class="tabs" role="tablist" aria-label="Samples" onkeydown={onKeydown}>
  {#each samples as _, i (i)}
    <div class="tab" class:active={i === activeIndex}>
      <button
        type="button"
        role="tab"
        aria-selected={i === activeIndex}
        tabindex={i === activeIndex ? 0 : -1}
        onclick={() => onSelect(i)}
      >
        {samples.length === 1 ? "Sample" : `Sample ${i + 1}`}
        {#if errorTabs.has(i)}<span class="dot" title="Has parse errors"></span>{/if}
      </button>
      {#if samples.length > 1}
        <button
          type="button"
          class="remove"
          aria-label="Remove sample {i + 1}"
          title="Remove sample"
          onclick={() => onRemove(i)}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
        </button>
      {/if}
    </div>
  {/each}
  <button type="button" class="add" onclick={onAdd} title="Add another sample of the same payload">
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
    <span>Add sample</span>
  </button>
</div>

<style>
  .tabs {
    display: flex;
    align-items: stretch;
    gap: 2px;
    min-width: 0;
    height: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tabs::-webkit-scrollbar {
    display: none;
  }
  .tab {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex: none;
  }
  .tab::after {
    content: "";
    position: absolute;
    left: 6px;
    right: 6px;
    bottom: -1px;
    height: 2px;
    border-radius: 2px 2px 0 0;
    background: transparent;
  }
  .tab.active::after {
    background: var(--accent);
  }
  .tab button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 100%;
    padding: 0 8px;
    border: 0;
    background: transparent;
    color: var(--text-3);
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
  }
  .tab button:hover,
  .tab.active button {
    color: var(--text);
  }
  .tab .remove {
    padding: 0 6px 0 0;
    margin-left: -4px;
    color: var(--text-3);
    opacity: 0;
  }
  .tab:hover .remove,
  .tab.active .remove,
  .tab .remove:focus-visible {
    opacity: 1;
  }
  .tab .remove:hover {
    color: var(--error);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--error);
  }
  .add {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    padding: 0 8px;
    border: 0;
    background: transparent;
    color: var(--text-3);
    font-size: 12.5px;
    cursor: pointer;
  }
  .add:hover {
    color: var(--text);
  }
  @media (hover: none) {
    .tab .remove {
      opacity: 1;
    }
  }
</style>
