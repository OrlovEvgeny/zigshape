export type Convention = "camel_case" | "pascal_case" | "kebab_case";

export const ALL_CONVENTIONS: Convention[] = ["camel_case", "pascal_case", "kebab_case"];

/** Convert a snake_case Zig field name into the chosen wire convention. */
export function fromSnake(name: string, c: Convention): string {
  const parts = name.split("_");
  switch (c) {
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
