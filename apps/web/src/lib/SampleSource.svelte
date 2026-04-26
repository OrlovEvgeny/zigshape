<script lang="ts">
  type Props = {
    onAddSamples: (texts: string[]) => void;
  };

  let { onAddSamples }: Props = $props();

  let urlValue = $state("");
  let urlError = $state<string | null>(null);
  let urlLoading = $state(false);
  let dragOver = $state(false);

  async function readFiles(files: FileList | File[]) {
    const list = files instanceof FileList ? Array.from(files) : files;
    const texts = await Promise.all(list.map((f) => f.text()));
    if (texts.length > 0) onAddSamples(texts);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const dt = e.dataTransfer;
    if (!dt) return;
    if (dt.files && dt.files.length > 0) void readFiles(dt.files);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function onDragLeave() {
    dragOver = false;
  }

  function onPick(e: Event) {
    const t = e.currentTarget as HTMLInputElement;
    if (t.files && t.files.length > 0) void readFiles(t.files);
    t.value = "";
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
    } catch (e) {
      urlError =
        (e instanceof Error && e.message.startsWith("HTTP "))
          ? e.message
          : "URL didn’t allow cross-origin fetch — paste the body instead.";
    } finally {
      urlLoading = false;
    }
  }
</script>

<div
  class="source"
  class:drag-over={dragOver}
  ondrop={onDrop}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  role="region"
  aria-label="Add sample"
>
  <div class="row">
    <label class="upload">
      <input type="file" multiple onchange={onPick} accept=".json,.yaml,.yml,.toml,.xml,application/json,text/plain,text/yaml,application/xml" />
      <span>Upload file(s)</span>
    </label>

    <span class="or">or drop files</span>

    <span class="spacer"></span>

    <form
      class="url-form"
      onsubmit={(e) => {
        e.preventDefault();
        void fetchUrl();
      }}
    >
      <input
        type="url"
        placeholder="Fetch URL (CORS only)"
        bind:value={urlValue}
        spellcheck="false"
        autocomplete="off"
      />
      <button type="submit" disabled={urlLoading || urlValue.trim() === ""}>
        {urlLoading ? "Fetching…" : "Fetch"}
      </button>
    </form>
  </div>

  {#if urlError}
    <p class="error">{urlError}</p>
  {/if}
  <p class="privacy">Fetched and dropped content stays in your browser.</p>
</div>

<style>
  .source {
    border: 1px dashed #ccc;
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
    background: #fafafa;
    transition: border-color 0.15s, background 0.15s;
  }
  .source.drag-over {
    border-color: #6c8aff;
    background: #eef2ff;
  }
  .row {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .upload {
    position: relative;
    display: inline-flex;
    cursor: pointer;
  }
  .upload input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .upload span {
    padding: 0.35rem 0.7rem;
    font-size: 0.85rem;
    border: 1px solid #ccc;
    background: #fff;
    border-radius: 4px;
  }
  .upload:hover span { background: #f3f3f3; }
  .or { color: #888; font-size: 0.8rem; }
  .spacer { flex: 1 1 auto; }
  .url-form { display: flex; gap: 0.35rem; }
  .url-form input {
    padding: 0.35rem 0.5rem;
    font-size: 0.85rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    min-width: 14rem;
  }
  .url-form button {
    padding: 0.35rem 0.85rem;
    font-size: 0.85rem;
    border: 1px solid #ccc;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
  }
  .url-form button:disabled { opacity: 0.4; cursor: not-allowed; }
  .url-form button:hover:not(:disabled) { background: #f3f3f3; }
  .error {
    margin: 0.4rem 0 0;
    color: #b00;
    font-size: 0.8rem;
  }
  .privacy {
    margin: 0.4rem 0 0;
    color: #888;
    font-size: 0.75rem;
  }
</style>
