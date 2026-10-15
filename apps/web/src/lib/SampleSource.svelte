<script lang="ts">
  // Upload and fetch-from-URL controls for the input panel header.  Drag
  // and drop is handled by the panel itself so the whole editor is a drop
  // target.
  import { tick } from "svelte";

  type Props = {
    onAddSamples: (texts: string[]) => void;
  };

  let { onAddSamples }: Props = $props();

  let urlOpen = $state(false);
  let urlValue = $state("");
  let urlError = $state<string | null>(null);
  let urlLoading = $state(false);
  let root: HTMLDivElement;
  let urlInput = $state<HTMLInputElement>();

  function onPick(e: Event) {
    const t = e.currentTarget as HTMLInputElement;
    if (t.files && t.files.length > 0) void readFiles(t.files, onAddSamples);
    t.value = "";
  }

  async function toggleUrl() {
    urlOpen = !urlOpen;
    urlError = null;
    if (urlOpen) {
      await tick();
      urlInput?.focus();
    }
  }

  function onWindowPointer(e: PointerEvent) {
    if (urlOpen && !root.contains(e.target as Node)) urlOpen = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && urlOpen) urlOpen = false;
  }

  async function fetchUrl() {
    const url = urlValue.trim();
    if (!url) return;
    urlError = null;
    urlLoading = true;
    try {
      // CORS-only.  If the URL doesn't allow cross-origin reads, fetch will
      // throw — surface a friendly hint rather than the raw "TypeError: Failed
      // to fetch" the browser emits.
      const r = await fetch(url, { mode: "cors" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      onAddSamples([text]);
      urlValue = "";
      urlOpen = false;
    } catch (e) {
      urlError =
        e instanceof Error && e.message.startsWith("HTTP ")
          ? `Request failed with ${e.message}.`
          : "The server doesn't allow cross-origin reads. Paste the response body instead.";
    } finally {
      urlLoading = false;
    }
  }
</script>

<script lang="ts" module>
  export async function readFiles(files: FileList | File[], add: (texts: string[]) => void) {
    const list = files instanceof FileList ? Array.from(files) : files;
    const texts = await Promise.all(list.map((f) => f.text()));
    if (texts.length > 0) add(texts);
  }
</script>

<svelte:window onpointerdown={onWindowPointer} onkeydown={onKeydown} />

<div class="source" bind:this={root}>
  <label class="btn ghost sm upload" title="Add files as samples">
    <input
      type="file"
      multiple
      onchange={onPick}
      accept=".json,.ndjson,.jsonl,.yaml,.yml,.toml,.xml,application/json,text/plain,text/yaml,application/xml"
    />
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 8V1.5M3.5 4L6 1.5 8.5 4M1.5 8.5v2h9v-2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
    <span>Upload</span>
  </label>
  <button type="button" class="btn ghost sm" aria-expanded={urlOpen} onclick={toggleUrl} title="Fetch a sample from a URL">
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M5 7a2.5 2.5 0 0 0 3.5 0l1.75-1.75a2.47 2.47 0 0 0-3.5-3.5L6 2.5M7 5a2.5 2.5 0 0 0-3.5 0L1.75 6.75a2.47 2.47 0 0 0 3.5 3.5L6 9.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
    <span>URL</span>
  </button>

  {#if urlOpen}
    <form
      class="url-pop"
      onsubmit={(e) => {
        e.preventDefault();
        void fetchUrl();
      }}
    >
      <div class="row">
        <input
          bind:this={urlInput}
          class="input mono"
          type="url"
          placeholder="https://api.example.com/users/1"
          bind:value={urlValue}
          spellcheck="false"
          autocomplete="off"
          aria-label="Sample URL"
        />
        <button type="submit" class="btn primary" disabled={urlLoading || urlValue.trim() === ""}>
          {urlLoading ? "Fetching…" : "Fetch"}
        </button>
      </div>
      {#if urlError}
        <p class="error">{urlError}</p>
      {:else}
        <p class="hint">Fetched from your browser. Works only when the server sends CORS headers.</p>
      {/if}
    </form>
  {/if}
</div>

<style>
  .source {
    position: relative;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .upload {
    position: relative;
    overflow: hidden;
  }
  .upload input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .upload:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .url-pop {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 30;
    width: 380px;
    max-width: calc(100vw - 32px);
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-pop);
    animation: pop-in 0.12s ease-out;
  }
  @keyframes pop-in {
    from {
      opacity: 0;
      transform: translateY(-3px);
    }
  }
  .row {
    display: flex;
    gap: 6px;
  }
  .row .input {
    flex: 1;
    min-width: 0;
    font-size: 12px;
  }
  .hint,
  .error {
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.4;
  }
  .hint {
    color: var(--text-3);
  }
  .error {
    color: var(--error);
  }
</style>
