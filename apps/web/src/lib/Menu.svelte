<script lang="ts">
  // Small dropdown: a trigger button plus a popover of `.menu-item`
  // buttons.  Closes on outside click, Escape, or after an item runs.
  // Arrow keys move between items.
  import type { Snippet } from "svelte";

  type Props = {
    label: string;
    variant?: "" | "ghost" | "primary";
    size?: "" | "sm";
    align?: "start" | "end";
    width?: string;
    icon?: Snippet;
    children: Snippet<[() => void]>;
  };

  let { label, variant = "", size = "", align = "start", width = "260px", icon, children }: Props = $props();

  let open = $state(false);
  let root: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let pop = $state<HTMLDivElement>();

  function close() {
    open = false;
  }

  function items(): HTMLButtonElement[] {
    return pop ? Array.from(pop.querySelectorAll<HTMLButtonElement>(".menu-item:not(:disabled)")) : [];
  }

  function onWindowPointer(e: PointerEvent) {
    if (open && !root.contains(e.target as Node)) open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      open = false;
      trigger.focus();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const list = items();
      if (list.length === 0) return;
      const at = list.indexOf(document.activeElement as HTMLButtonElement);
      const step = e.key === "ArrowDown" ? 1 : -1;
      list[(at + step + list.length) % list.length]?.focus();
    }
  }

  // Run the item's own click handler first, then close.
  function onPopClick(e: MouseEvent) {
    if ((e.target as HTMLElement).closest(".menu-item")) queueMicrotask(close);
  }
</script>

<svelte:window onpointerdown={onWindowPointer} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="menu" bind:this={root} onkeydown={onKeydown}>
  <button
    bind:this={trigger}
    type="button"
    class="btn {variant} {size}"
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    {@render icon?.()}
    <span>{label}</span>
    <svg class="chev" width="9" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </button>
  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="pop" role="menu" tabindex="-1" bind:this={pop} data-align={align} style:width onclick={onPopClick}>
      {@render children(close)}
    </div>
  {/if}
</div>

<style>
  .menu {
    position: relative;
    display: inline-flex;
  }
  .chev {
    color: var(--text-3);
    margin-left: 1px;
  }
  .pop {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 30;
    max-width: calc(100vw - 32px);
    max-height: min(70vh, 480px);
    overflow-y: auto;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-pop);
    animation: pop-in 0.12s ease-out;
  }
  .pop[data-align="end"] {
    left: auto;
    right: 0;
  }
  @keyframes pop-in {
    from {
      opacity: 0;
      transform: translateY(-3px);
    }
  }

  .pop :global(.menu-item) {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    padding: 7px 9px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }
  .pop :global(.menu-item:hover:not(:disabled)),
  .pop :global(.menu-item:focus-visible) {
    background: var(--surface-hover);
    outline: none;
  }
  .pop :global(.menu-item:disabled) {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .pop :global(.menu-item small) {
    color: var(--text-3);
    font-size: 12px;
    line-height: 1.4;
  }
  .pop :global(.menu-sep) {
    height: 1px;
    margin: 4px 2px;
    background: var(--border);
  }
  .pop :global(.menu-heading) {
    padding: 6px 9px 4px;
    color: var(--text-3);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
</style>
