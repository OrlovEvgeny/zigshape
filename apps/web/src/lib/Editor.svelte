<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { json } from "@codemirror/lang-json";
  import { xml } from "@codemirror/lang-xml";
  import { yaml } from "@codemirror/lang-yaml";
  import { Compartment, EditorSelection, EditorState, StateEffect, StateField } from "@codemirror/state";
  import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
  import { basicSetup } from "codemirror";

  export type HighlightRange = { from: number; length: number; nonce: number };
  export type EditorLanguage = "json" | "yaml" | "toml" | "xml" | "plain";

  type Props = {
    value: string;
    language?: EditorLanguage;
    readonly?: boolean;
    highlight?: HighlightRange | null;
  };

  let {
    value = $bindable(""),
    language = "json",
    readonly = false,
    highlight = null,
  }: Props = $props();

  let host: HTMLDivElement;
  let view: EditorView | undefined;
  let lastInternal = "";
  const langCompartment = new Compartment();

  const setHighlight = StateEffect.define<{ from: number; to: number } | null>();
  const highlightField = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(decos, tr) {
      decos = decos.map(tr.changes);
      for (const e of tr.effects) {
        if (e.is(setHighlight)) {
          if (e.value === null) {
            decos = Decoration.none;
          } else {
            const { from, to } = e.value;
            const safeFrom = Math.max(0, Math.min(from, tr.newDoc.length));
            const safeTo = Math.max(safeFrom, Math.min(to, tr.newDoc.length));
            decos =
              safeFrom === safeTo
                ? Decoration.none
                : Decoration.set([
                    Decoration.mark({ class: "cm-zigshape-highlight" }).range(safeFrom, safeTo),
                  ]);
          }
        }
      }
      return decos;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  function languageExtension(lang: EditorLanguage) {
    if (lang === "json") return json();
    if (lang === "yaml") return yaml();
    if (lang === "xml") return xml();
    return [];
  }

  onMount(() => {
    const extensions = [
      basicSetup,
      EditorView.lineWrapping,
      EditorState.readOnly.of(readonly),
      highlightField,
      langCompartment.of(languageExtension(language)),
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !readonly) {
          const text = u.state.doc.toString();
          lastInternal = text;
          value = text;
        }
      }),
    ];

    view = new EditorView({
      doc: value,
      extensions,
      parent: host,
    });
    lastInternal = value;
  });

  onDestroy(() => view?.destroy());

  $effect(() => {
    if (!view) return;
    if (value === lastInternal) return;
    const cur = view.state.doc.toString();
    if (cur === value) return;
    view.dispatch({ changes: { from: 0, to: cur.length, insert: value } });
    lastInternal = value;
  });

  // Hot-swap the language extension when the prop changes.
  $effect(() => {
    if (!view) return;
    view.dispatch({ effects: langCompartment.reconfigure(languageExtension(language)) });
  });

  $effect(() => {
    if (!view || !highlight) return;
    const { from, length } = highlight;
    void highlight.nonce;
    const docLen = view.state.doc.length;
    const safeFrom = Math.max(0, Math.min(from, docLen));
    const safeTo = Math.max(safeFrom, Math.min(from + length, docLen));
    view.dispatch({
      effects: [
        setHighlight.of({ from: safeFrom, to: safeTo }),
        EditorView.scrollIntoView(EditorSelection.range(safeFrom, safeTo), { y: "center" }),
      ],
    });
    const handle = setTimeout(() => {
      view?.dispatch({ effects: setHighlight.of(null) });
    }, 1800);
    return () => clearTimeout(handle);
  });
</script>

<div bind:this={host} class="cm-host" class:readonly></div>

<style>
  .cm-host {
    height: 100%;
    min-height: 0;
    display: flex;
  }
  .cm-host :global(.cm-editor) {
    flex: 1 1 auto;
    height: 100%;
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
  }
  .cm-host :global(.cm-scroller) {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.85rem;
    line-height: 1.45;
  }
  .cm-host :global(.cm-content) { padding: 0.5rem 0; }
  .cm-host :global(.cm-zigshape-highlight) {
    background: rgba(255, 213, 79, 0.55);
    border-radius: 2px;
    box-shadow: 0 0 0 1px rgba(180, 130, 0, 0.45);
  }
  .cm-host.readonly :global(.cm-editor) {
    background: #1e1e1e;
    border-color: #1e1e1e;
  }
  .cm-host.readonly :global(.cm-content),
  .cm-host.readonly :global(.cm-line) {
    color: #d4d4d4;
    caret-color: transparent;
  }
  .cm-host.readonly :global(.cm-gutters) {
    background: #1e1e1e;
    border-color: #2a2a2a;
    color: #666;
  }
  .cm-host.readonly :global(.cm-zigshape-highlight) {
    background: rgba(255, 213, 79, 0.3);
    box-shadow: 0 0 0 1px rgba(255, 213, 79, 0.6);
  }
  .cm-host.readonly :global(.cm-activeLineGutter),
  .cm-host.readonly :global(.cm-activeLine) {
    background: transparent;
  }
</style>
