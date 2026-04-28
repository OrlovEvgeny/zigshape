import type { SrcRef, ZValue } from "./value";

export type ValueKind = "null" | "bool" | "int" | "float" | "string" | "array" | "object";

export type Observation = {
  path: string;
  total: number;
  countByKind: Map<ValueKind, number>;
  firstSrc?: SrcRef;
  // int kind specifics
  intMin?: bigint;
  intMax?: bigint;
  // array kind specifics
  arrayMinLen?: number;
  arrayMaxLen?: number;
  // object kind specifics
  childKeyOrder: string[];
  childKeysSeen: Set<string>;
  childKeyHasNonIdent: boolean;
  // string kind specifics — used for enum inference.  Capped to avoid memory
  // blow-up on highly variable text fields; the "overflowed" flag tells infer
  // to skip enum suggestion regardless of distinctness ratio.
  stringSamples?: Map<string, number>;
  stringSamplesOverflowed?: boolean;
  stringFirstSrcByValue?: Map<string, SrcRef>;
  // bool kind specifics — used by defaults-from-samples to recognise singleton
  // observations (all true / all false).
  boolTrue?: number;
  boolFalse?: number;
  // XML-specific.  When this observation is for an object, records which
  // child keys were tagged as attributes / text nodes by the XML parser.
  // Read by `infer` to stamp FieldShape.xml so the serde decorator can emit
  // xml_attribute lists.  Attribute mark wins on multi-sample disagreement.
  childKeyXml?: Map<string, "attribute" | "text">;
  /** Documentation comment captured by the parser (currently YAML only).
   *  First non-empty observation wins so multi-sample inputs don't drift
   *  per-run. */
  childKeyDocComment?: Map<string, string>;
  // Object items observed at this path (only populated when this path is an
  // array element).  Used by tagged-union inference, which re-groups items by
  // discriminator value.  Capped to bound memory on huge inputs.
  objectItems?: ZValue[];
  objectItemsOverflowed?: boolean;
  // Per-child set of sample indices the key was seen in.  Used by alias
  // detection: two siblings with identical shapes that never co-occur in the
  // same sample are alias candidates for the same logical field.
  // Keyed off `value.src.sample` — adequate for the common case (top-level or
  // once-per-sample nested objects); a parent observed multiple times within
  // one sample (e.g. array of objects) shares a sample index and so its
  // children correctly fail the mutual-exclusion check.
  childKeyBySample?: Map<string, Set<number>>;
};

export const STRING_SAMPLE_HARD_CAP = 64;
export const ARRAY_ITEM_HARD_CAP = 1000;

export type ObservationMap = Map<string, Observation>;

export const ROOT_PATH = "$";

export function observeSamples(values: ZValue[]): ObservationMap {
  const map: ObservationMap = new Map();
  for (const v of values) observe(v, ROOT_PATH, map);
  return map;
}

function getOrCreate(map: ObservationMap, path: string): Observation {
  let o = map.get(path);
  if (!o) {
    o = {
      path,
      total: 0,
      countByKind: new Map(),
      childKeyOrder: [],
      childKeysSeen: new Set(),
      childKeyHasNonIdent: false,
    };
    map.set(path, o);
  }
  return o;
}

function observe(value: ZValue, path: string, map: ObservationMap): void {
  const o = getOrCreate(map, path);
  o.total += 1;
  o.firstSrc ??= value.src;
  o.countByKind.set(value.kind, (o.countByKind.get(value.kind) ?? 0) + 1);

  switch (value.kind) {
    case "int":
      o.intMin = o.intMin === undefined ? value.value : (value.value < o.intMin ? value.value : o.intMin);
      o.intMax = o.intMax === undefined ? value.value : (value.value > o.intMax ? value.value : o.intMax);
      break;
    case "bool":
      if (value.value) o.boolTrue = (o.boolTrue ?? 0) + 1;
      else o.boolFalse = (o.boolFalse ?? 0) + 1;
      break;
    case "string": {
      o.stringSamples ??= new Map();
      o.stringFirstSrcByValue ??= new Map();
      const existing = o.stringSamples.get(value.value);
      if (existing !== undefined) {
        o.stringSamples.set(value.value, existing + 1);
      } else if (o.stringSamples.size >= STRING_SAMPLE_HARD_CAP) {
        o.stringSamplesOverflowed = true;
      } else {
        o.stringSamples.set(value.value, 1);
        o.stringFirstSrcByValue.set(value.value, value.src);
      }
      break;
    }
    case "array": {
      const len = value.items.length;
      o.arrayMinLen = o.arrayMinLen === undefined ? len : Math.min(o.arrayMinLen, len);
      o.arrayMaxLen = o.arrayMaxLen === undefined ? len : Math.max(o.arrayMaxLen, len);
      const elementPath = path + "[*]";
      const elementObs = getOrCreate(map, elementPath);
      for (const item of value.items) {
        // Save object items at the element path so the union inferrer can
        // re-walk and group by discriminator.  Bounded by ARRAY_ITEM_HARD_CAP.
        if (item.kind === "object") {
          if (!elementObs.objectItems) elementObs.objectItems = [];
          if (elementObs.objectItems.length < ARRAY_ITEM_HARD_CAP) {
            elementObs.objectItems.push(item);
          } else {
            elementObs.objectItemsOverflowed = true;
          }
        }
        observe(item, elementPath, map);
      }
      break;
    }
    case "object": {
      for (const [key, field] of value.fields) {
        if (!o.childKeysSeen.has(key)) {
          o.childKeysSeen.add(key);
          o.childKeyOrder.push(key);
          if (!isPlainIdentifier(key)) o.childKeyHasNonIdent = true;
        }
        if (field.xml) {
          o.childKeyXml ??= new Map();
          // Attribute wins over text on multi-sample disagreement.
          const prev = o.childKeyXml.get(key);
          if (prev !== "attribute") o.childKeyXml.set(key, field.xml.kind);
        }
        if (field.docComment) {
          o.childKeyDocComment ??= new Map();
          // First non-empty doc comment wins so multi-sample runs are
          // deterministic.
          if (!o.childKeyDocComment.has(key)) {
            o.childKeyDocComment.set(key, field.docComment);
          }
        }
        o.childKeyBySample ??= new Map();
        let presence = o.childKeyBySample.get(key);
        if (!presence) {
          presence = new Set();
          o.childKeyBySample.set(key, presence);
        }
        presence.add(field.value.src.sample);
        observe(field.value, childPath(path, key), map);
      }
      break;
    }
    default:
      break;
  }
}

export function childPath(parent: string, key: string): string {
  return parent + "." + key;
}

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
function isPlainIdentifier(key: string): boolean {
  return IDENT_RE.test(key);
}
