import * as vscode from "vscode";
import {
  generateZig,
  runPipeline,
  type AliasStrategy,
  type Format,
  type IntStrategy,
  type ZigshapeOptions,
} from "@zigshape/core";
import { serdeDecorator } from "@zigshape/serde-zig";

type Target = "plain" | "serde-zig";
type Preset = "api" | "strict" | "loose";

const PRESET_OPTIONS: Record<Preset, Partial<ZigshapeOptions>> = {
  api: { intStrategy: "smallest", enums: "auto", unions: "off", defaultsFromSamples: false },
  strict: { intStrategy: "u64", enums: "off", unions: "off", defaultsFromSamples: true },
  loose: { intStrategy: "u64", enums: "off", unions: "off", defaultsFromSamples: false },
};

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("zigshape.pasteAsZig", pasteAsZig),
    vscode.commands.registerCommand("zigshape.generateFromCurrentFile", generateFromCurrentFile),
    vscode.commands.registerCommand("zigshape.updateFromSamples", updateFromSamples),
  );
}

export function deactivate(): void {}

function pickFormat(): "auto" | Format {
  return "auto";
}

type Settings = {
  target: Target;
  preset: Preset;
  rootName: string;
  intStrategy: IntStrategy;
  aliases: AliasStrategy;
  denyUnknownFields: boolean;
};

function readSettings(): Settings {
  const cfg = vscode.workspace.getConfiguration("zigshape");
  return {
    target: cfg.get<Target>("target", "plain"),
    preset: cfg.get<Preset>("preset", "api"),
    rootName: cfg.get<string>("rootName", "Root"),
    intStrategy: cfg.get<IntStrategy>("intStrategy", "smallest"),
    aliases: cfg.get<AliasStrategy>("aliases", "auto"),
    denyUnknownFields: cfg.get<boolean>("denyUnknownFields", false),
  };
}

function generate(samples: string[], s: Settings): { code: string; warnings: string[] } | { error: string } {
  const inferOptions: Partial<ZigshapeOptions> = {
    ...PRESET_OPTIONS[s.preset],
    intStrategy: s.intStrategy,
    aliases: s.aliases,
    format: pickFormat(),
  };
  const { normalized, warnings } = runPipeline({
    samples,
    rootName: s.rootName,
    inferOptions,
  });
  if (!normalized) {
    return { error: warnings.map((w) => `${w.severity}: ${w.message}`).join("\n") || "no parseable samples" };
  }
  const opts = s.target === "serde-zig"
    ? serdeDecorator(normalized, { denyUnknownFields: s.denyUnknownFields })
    : {};
  const code = generateZig(normalized, opts);
  return {
    code,
    warnings: warnings
      .filter((w) => w.severity !== "error")
      .map((w) => `${w.path ? w.path + " " : ""}${w.message} [${w.code}]`),
  };
}

async function showOutput(code: string, warnings: string[]): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({ language: "zig", content: code });
  await vscode.window.showTextDocument(doc, { preview: false });
  for (const w of warnings) vscode.window.showWarningMessage(`ZigShape: ${w}`);
}

async function insertAtCursor(code: string): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("ZigShape: no active editor — open a file first.");
    return;
  }
  await editor.edit((e) => e.insert(editor.selection.active, code));
}

async function pasteAsZig(): Promise<void> {
  const text = await vscode.env.clipboard.readText();
  if (!text || text.trim() === "") {
    vscode.window.showErrorMessage("ZigShape: clipboard is empty.");
    return;
  }
  const settings = readSettings();
  const result = generate([text], settings);
  if ("error" in result) {
    vscode.window.showErrorMessage(`ZigShape: ${result.error}`);
    return;
  }
  await insertAtCursor(result.code);
  for (const w of result.warnings) vscode.window.showWarningMessage(`ZigShape: ${w}`);
}

async function generateFromCurrentFile(uri?: vscode.Uri): Promise<void> {
  // Invoked from command palette → uri undefined; from explorer/editor menu →
  // uri is the selected resource.
  const target = uri ?? vscode.window.activeTextEditor?.document.uri;
  if (!target) {
    vscode.window.showErrorMessage("ZigShape: no file selected.");
    return;
  }
  let text: string;
  try {
    const data = await vscode.workspace.fs.readFile(target);
    text = new TextDecoder().decode(data);
  } catch (e) {
    vscode.window.showErrorMessage(`ZigShape: cannot read ${target.fsPath}: ${(e as Error).message}`);
    return;
  }
  const settings = readSettings();
  const result = generate([text], settings);
  if ("error" in result) {
    vscode.window.showErrorMessage(`ZigShape: ${result.error}`);
    return;
  }
  await showOutput(result.code, result.warnings);
}

async function updateFromSamples(): Promise<void> {
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: true,
    canSelectFiles: true,
    canSelectFolders: false,
    title: "ZigShape: pick samples to merge",
    filters: {
      "Data files": ["json", "jsonc", "yaml", "yml", "toml", "xml"],
      "All files": ["*"],
    },
  });
  if (!picked || picked.length === 0) return;

  const samples: string[] = [];
  for (const uri of picked) {
    try {
      const data = await vscode.workspace.fs.readFile(uri);
      samples.push(new TextDecoder().decode(data));
    } catch (e) {
      vscode.window.showWarningMessage(`ZigShape: skipping ${uri.fsPath}: ${(e as Error).message}`);
    }
  }
  if (samples.length === 0) {
    vscode.window.showErrorMessage("ZigShape: no readable samples.");
    return;
  }
  const settings = readSettings();
  const result = generate(samples, settings);
  if ("error" in result) {
    vscode.window.showErrorMessage(`ZigShape: ${result.error}`);
    return;
  }
  await showOutput(result.code, result.warnings);
}
