export type Convention =
  | "snake_case"
  | "camel_case"
  | "pascal_case"
  | "kebab_case"
  | "screaming_snake";

/** Conventions auto-detect considers.  snake_case is the identity from a
 *  Zig-name perspective, so detection only reaches it when every renamed
 *  field round-trips identically — which already implies no rename was
 *  needed.  We still list it for completeness and so the forced-mode path
 *  can use the same Convention type. */
export const ALL_CONVENTIONS: Convention[] = [
  "camel_case",
  "pascal_case",
  "kebab_case",
  "screaming_snake",
];

/** Convert a snake_case Zig field name into the chosen wire convention. */
export function fromSnake(name: string, c: Convention): string {
  const parts = name.split("_");
  switch (c) {
    case "snake_case":
      return name;
    case "screaming_snake":
      return name.toUpperCase();
    case "camel_case":
      return parts
        .map((p, i) => (i === 0 || p === "" ? p : p[0]!.toUpperCase() + p.slice(1)))
        .join("");
    case "pascal_case":
      return parts
        .map((p) => (p === "" ? "" : p[0]!.toUpperCase() + p.slice(1)))
        .join("");
    case "kebab_case":
      return name.replace(/_/g, "-");
  }
}
