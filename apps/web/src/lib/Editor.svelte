<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { json } from "@codemirror/lang-json";
  import { xml } from "@codemirror/lang-xml";
  import { yaml } from "@codemirror/lang-yaml";
  import { Annotation, Compartment, EditorSelection, EditorState, StateEffect, StateField } from "@codemirror/state";
  import { Decoration, EditorView, placeholder as placeholderExt, type DecorationSet } from "@codemirror/view";
  import { basicSetup } from "codemirror";
  import { codeHighlighting } from "$lib/highlight";
  import { zig } from "$lib/zig-lang";

  export type HighlightRange = { from: number; length: number; nonce: number };
  export type EditorLanguage = "json" | "yaml" | "toml" | "xml" | "zig" | "plain";

  type Props = {
    value: string;
    onChange?: (text: string) => void;
    language?: EditorLanguage;
    readonly?: boolean;
    highlight?: HighlightRange | null;
    placeholder?: string;
    label?: string;
  };

  let {
    value,
    onChange,
    language = "json",
    readonly = false,
    highlight = null,
    placeholder = "",
    label,
  }: Props = $props();

  let host: HTMLDivElement;
  let view = $state.raw<EditorView | undefined>();
  const langCompartment = new Compartment();
  // Marks transactions that mirror the `value` prop, so they don't echo
  // back through `onChange` as if the user had typed them.
  const fromProp = Annotation.define<boolean>();

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

  // Every colour is a CSS variable from app.css so the editor follows the
  // page theme (light/dark) without reconfiguration.
  const theme = EditorView.theme({
    "&": {
      height: "100%",
      backgroundColor: "var(--editor-bg)",
      color: "var(--text)",
      fontSize: "12.5px",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.65" },
    ".cm-content": { padding: "12px 0", caretColor: "var(--text)" },
    ".cm-line": { padding: "0 16px 0 4px" },
    ".cm-gutters": {
      backgroundColor: "var(--editor-bg)",
      color: "var(--editor-gutter)",
      border: "none",
    },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 14px", minWidth: "40px" },
    ".cm-foldGutter .cm-gutterElement": { color: "var(--text-3)", padding: "0 2px" },
    ".cm-activeLine": { backgroundColor: "var(--editor-active)" },
    ".cm-activeLineGutter": { backgroundColor: "var(--editor-active)", color: "var(--text-2)" },
    "&:not(.cm-focused) .cm-activeLine, &:not(.cm-focused) .cm-activeLineGutter": {
      backgroundColor: "transparent",
    },
    "&:not(.cm-focused) .cm-activeLineGutter": { color: "var(--editor-gutter)" },
    "&:not(.cm-focused) .cm-matchingBracket": { backgroundColor: "transparent" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--text)" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: "var(--editor-selection)" },
    ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
      backgroundColor: "var(--accent-soft)",
      outline: "none",
    },
    ".cm-selectionMatch": { backgroundColor: "var(--accent-soft)" },
    ".cm-placeholder": { color: "var(--text-3)" },
    ".cm-foldPlaceholder": {
      backgroundColor: "var(--surface-hover)",
      border: "1px solid var(--border)",
      color: "var(--text-2)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-sm)",
      boxShadow: "var(--shadow-pop)",
    },
    ".cm-panels": { backgroundColor: "var(--surface-2)", color: "var(--text)" },
    ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--border)" },
    ".cm-searchMatch": { backgroundColor: "var(--editor-mark)" },
    ".cm-zigshape-highlight": {
      backgroundColor: "var(--editor-mark)",
      borderRadius: "2px",
      boxShadow: "0 0 0 1px var(--editor-mark)",
    },
  });

  // The output pane is for reading and selecting, not editing: no caret,
  // no active-line band.
  const readonlyTheme = EditorView.theme({
    ".cm-cursor": { display: "none" },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent" },
    ".cm-activeLineGutter": { color: "var(--editor-gutter)" },
  });

  function languageExtension(lang: EditorLanguage) {
    if (lang === "json") return json();
    if (lang === "yaml") return yaml();
    if (lang === "xml") return xml();
    if (lang === "zig") return zig();
    return [];
  }

  onMount(() => {
    // Earlier themes win, so the readonly tweaks go first.
    const extensions = [
      readonly ? readonlyTheme : [],
      basicSetup,
      theme,
      codeHighlighting,
      EditorView.lineWrapping,
      EditorState.readOnly.of(readonly),
      highlightField,
      langCompartment.of(languageExtension(language)),
      EditorView.updateListener.of((u) => {
        if (!u.docChanged || readonly) return;
        if (u.transactions.some((tr) => tr.annotation(fromProp))) return;
        onChange?.(u.state.doc.toString());
      }),
    ];
    if (placeholder) extensions.push(placeholderExt(placeholder));
    if (label) extensions.push(EditorView.contentAttributes.of({ "aria-label": label }));

    view = new EditorView({ doc: value, extensions, parent: host });
  });

  onDestroy(() => view?.destroy());

  // Push external value changes (tab switch, example load, curl rewrite)
  // into the editor.  Edits that originated in the editor already match.
  $effect(() => {
    const next = value;
    if (!view) return;
    const cur = view.state.doc.toString();
    if (cur === next) return;
    view.dispatch({
      changes: { from: 0, to: cur.length, insert: next },
      annotations: fromProp.of(true),
    });
  });

  // Hot-swap the language extension when the prop changes.
  $effect(() => {
    const ext = languageExtension(language);
    if (!view) return;
    view.dispatch({ effects: langCompartment.reconfigure(ext) });
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

<div bind:this={host} class="cm-host"></div>

<style>
  .cm-host {
    height: 100%;
    min-height: 0;
    display: flex;
  }
  .cm-host :global(.cm-editor) {
    flex: 1 1 auto;
    min-width: 0;
  }
</style>
