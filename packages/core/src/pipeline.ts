import { DiagnosticBag, type Diagnostic } from "./diagnostics";
import { infer } from "./infer";
import { normalize, type NormalizeResult } from "./normalize";
import { observeSamples } from "./observe";
import { withDefaults, type ZigshapeOptions } from "./options";
import { detectFormat, parseSample } from "./parse";
import type { ZValue } from "./value";

export type PipelineInput = {
  samples: string[];
  rootName: string;
  inferOptions?: Partial<ZigshapeOptions>;
};

export type PipelineResult = {
  normalized: NormalizeResult | null;
  warnings: Diagnostic[];
};

/** Run parse → observe → infer → normalize, collecting diagnostics from every stage.
 *  When all samples fail to parse, normalized is null and warnings carry the errors. */
export function runPipeline({ samples, rootName, inferOptions }: PipelineInput): PipelineResult {
  const all = new DiagnosticBag();
  const values: ZValue[] = [];
  const options = withDefaults(inferOptions);
  const formatOpt = options.format;
  const detectedFormats = new Set<string>();
  const xmlRoots: string[] = [];

  for (let i = 0; i < samples.length; i++) {
    const sampleText = samples[i] ?? "";
    if (formatOpt === "auto") {
      detectedFormats.add(detectFormat(sampleText).format);
    }
    const r = parseSample(sampleText, i, formatOpt);
    for (const d of r.diagnostics.toArray()) all.push(d);
    if (r.value && !r.diagnostics.hasErrors()) values.push(r.value);
    if (r.xmlRoot !== undefined) xmlRoots.push(r.xmlRoot);
  }

  let xmlRootElement: string | undefined;
  if (xmlRoots.length > 0) {
    const unique = new Set(xmlRoots);
    if (unique.size === 1) {
      xmlRootElement = xmlRoots[0];
    } else {
      all.warn(
        "pipeline.xml_mixed_root",
        `Samples have different XML root elements (${[...unique].join(", ")}); xml_root decoration omitted`,
      );
    }
  }

  if (formatOpt === "auto" && detectedFormats.size > 1) {
    all.warn(
      "pipeline.mixed_formats",
      `Samples appear to be in different formats (${[...detectedFormats].join(", ")}); results may be inconsistent`,
    );
  }

  if (values.length === 0) {
    return { normalized: null, warnings: all.toArray() };
  }

  const observations = observeSamples(values);
  const { root, diagnostics: inferDiag } = infer(observations, options);
  for (const d of inferDiag.toArray()) all.push(d);

  const normalized = normalize(root, {
    rootName,
    intStrategy: options.intStrategy,
    defaultsFromSamples: options.defaultsFromSamples,
    observations,
    xmlRootElement,
  });
  return { normalized, warnings: all.toArray() };
}
