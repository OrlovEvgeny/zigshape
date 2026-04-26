import { DiagnosticBag, type Diagnostic } from "./diagnostics";
import { infer, type InferOptions } from "./infer";
import { normalize, type NormalizeResult } from "./normalize";
import { observeSamples } from "./observe";
import { parseSample } from "./parse";
import type { ZValue } from "./value";

export type PipelineInput = {
  samples: string[];
  rootName: string;
  inferOptions?: Partial<InferOptions>;
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

  for (let i = 0; i < samples.length; i++) {
    const r = parseSample(samples[i] ?? "", i);
    for (const d of r.diagnostics.toArray()) all.push(d);
    if (r.value && !r.diagnostics.hasErrors()) values.push(r.value);
  }

  if (values.length === 0) {
    return { normalized: null, warnings: all.toArray() };
  }

  const observations = observeSamples(values);
  const { root, diagnostics: inferDiag } = infer(observations, inferOptions);
  for (const d of inferDiag.toArray()) all.push(d);

  const normalized = normalize(root, { rootName });
  return { normalized, warnings: all.toArray() };
}
