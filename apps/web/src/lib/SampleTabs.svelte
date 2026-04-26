<script lang="ts">
  type Props = {
    samples: string[];
    activeIndex: number;
    onSelect: (i: number) => void;
    onAdd: () => void;
    onRemove: (i: number) => void;
  };

  let { samples, activeIndex, onSelect, onAdd, onRemove }: Props = $props();
</script>

<div class="tabs" role="tablist">
  {#each samples as _, i (i)}
    <div class="tab" class:active={i === activeIndex}>
      <button
        type="button"
        role="tab"
        aria-selected={i === activeIndex}
        onclick={() => onSelect(i)}
      >Sample {i + 1}</button>
      {#if samples.length > 1}
        <button
          type="button"
          class="remove"
          aria-label="Remove sample {i + 1}"
          onclick={() => onRemove(i)}
        >×</button>
      {/if}
    </div>
  {/each}
  <button type="button" class="add" onclick={onAdd} aria-label="Add sample">+ sample</button>
</div>

<style>
  .tabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid #ddd;
    padding-bottom: 0.25rem;
    flex-wrap: wrap;
  }
  .tab {
    display: inline-flex;
    align-items: center;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
    overflow: hidden;
  }
  .tab.active {
    border-color: #6c8aff;
    background: #eef2ff;
  }
  .tab button {
    background: transparent;
    border: 0;
    padding: 0.3rem 0.7rem;
    font-size: 0.85rem;
    cursor: pointer;
    color: inherit;
  }
  .tab button.remove {
    padding: 0.3rem 0.55rem;
    border-left: 1px solid #ddd;
    color: #888;
  }
  .tab button.remove:hover { color: #c00; }
  .add {
    border: 1px dashed #ccc;
    background: transparent;
    padding: 0.3rem 0.7rem;
    border-radius: 4px;
    font-size: 0.85rem;
    color: #555;
    cursor: pointer;
  }
  .add:hover { border-color: #888; color: #222; }
</style>
