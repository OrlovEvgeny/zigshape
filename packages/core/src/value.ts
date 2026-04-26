export type SrcRef = {
  sample: number;
  offset: number;
  length: number;
};

export type ZNull = { kind: "null"; src: SrcRef };
export type ZBool = { kind: "bool"; value: boolean; src: SrcRef };
export type ZInt = { kind: "int"; value: bigint; src: SrcRef };
export type ZFloat = { kind: "float"; value: number; src: SrcRef };
export type ZString = { kind: "string"; value: string; src: SrcRef };
export type ZArray = { kind: "array"; items: ZValue[]; src: SrcRef };
export type ZObject = { kind: "object"; fields: Map<string, ZField>; src: SrcRef };

export type ZField = {
  key: string;
  keySrc: SrcRef;
  value: ZValue;
  /** XML-specific tag, set only by the XML parser.  "attribute" → emit
   *  `xml_attribute` in the serde block; "text" → text-node fallback with
   *  a TODO comment.  Other parsers leave it undefined. */
  xml?: { kind: "attribute" | "text" };
};

export type ZValue = ZNull | ZBool | ZInt | ZFloat | ZString | ZArray | ZObject;

/** Walk a ZValue and build a `path → SrcRef` map.  Path syntax matches the
 *  one used by `observeSamples` (`$`, `$.key`, `$.list[*]`).  Object keys
 *  contribute the *value* range, not the key range, so highlighting moves to
 *  the value the inspector is talking about.
 *
 *  TOML and XML (and any future format that emits whole-document ranges) end
 *  up with the whole-document range for every entry — same precision as
 *  before, but exposed via a single uniform lookup rather than a per-format
 *  shim.  YAML and JSON emit precise per-node ranges. */
export function pathSrcMap(root: ZValue): Map<string, SrcRef> {
  const map = new Map<string, SrcRef>();
  walk(root, "$", map);
  return map;
}

function walk(value: ZValue, path: string, out: Map<string, SrcRef>): void {
  if (!out.has(path)) out.set(path, value.src);
  switch (value.kind) {
    case "object":
      for (const [k, f] of value.fields) walk(f.value, path + "." + k, out);
      break;
    case "array":
      for (const item of value.items) walk(item, path + "[*]", out);
      break;
    default:
      break;
  }
}
