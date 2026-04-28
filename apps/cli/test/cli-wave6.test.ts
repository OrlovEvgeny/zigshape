import { describe, expect, test } from "bun:test";
import { runCli } from "./_helpers";

describe("--with-doc-comments", () => {
  test("YAML input surfaces comments as /// doc lines", async () => {
    const r = await runCli(
      ["--stdin", "--format", "yaml", "--root", "Cfg", "--with-doc-comments"],
      "# server hostname\nhost: localhost\n# bind port\nport: 80\n",
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("/// server hostname");
    expect(r.stdout).toContain("/// bind port");
  });

  test("default (off) leaves comments stripped", async () => {
    const r = await runCli(
      ["--stdin", "--format", "yaml", "--root", "Cfg"],
      "# server hostname\nhost: localhost\n",
    );
    expect(r.code).toBe(0);
    expect(r.stdout).not.toContain("///");
  });

  test("JSON input ignores the flag (no comments to surface)", async () => {
    const r = await runCli(
      ["--stdin", "--root", "Cfg", "--with-doc-comments"],
      '{"host": "x"}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).not.toContain("///");
  });

  test("composes with --target serde-zig and --rename-all", async () => {
    const r = await runCli(
      [
        "--stdin",
        "--format",
        "yaml",
        "--root",
        "U",
        "--target",
        "serde-zig",
        "--rename-all",
        "camel_case",
        "--with-doc-comments",
      ],
      "# the user's id\nuser_id: 1\n",
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("/// the user's id");
    expect(r.stdout).toContain("rename_all");
  });
});
