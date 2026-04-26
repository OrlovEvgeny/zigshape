import type { SrcRef, ZValue } from "./value";

export type ValueKind = "null" | "bool" | "int" | "float" | "string" | "array" | "object";

export type Observation = {
  path: string;
  total: number;
  countByKind: Map<ValueKind, number>;
  firstSrc?: SrcRef;
  // int kind specifics
  intSigned?: boolean;
  // array kind specifics
  arrayMinLen?: number;
  arrayMaxLen?: number;
  // object kind specifics
  childKeyOrder: string[];
  childKeysSeen: Set<string>;
  childKeyHasNonIdent: boolean;
};

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
      if (value.value < 0n) o.intSigned = true;
      else o.intSigned ??= false;
      break;
    case "array": {
      const len = value.items.length;
      o.arrayMinLen = o.arrayMinLen === undefined ? len : Math.min(o.arrayMinLen, len);
      o.arrayMaxLen = o.arrayMaxLen === undefined ? len : Math.max(o.arrayMaxLen, len);
      for (const item of value.items) observe(item, path + "[*]", map);
      break;
    }
    case "object": {
      for (const [key, field] of value.fields) {
        if (!o.childKeysSeen.has(key)) {
          o.childKeysSeen.add(key);
          o.childKeyOrder.push(key);
          if (!isPlainIdentifier(key)) o.childKeyHasNonIdent = true;
        }
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
