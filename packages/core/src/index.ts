export type {
  SrcRef,
  ZValue,
  ZNull,
  ZBool,
  ZInt,
  ZFloat,
  ZString,
  ZArray,
  ZObject,
  ZField,
} from "./value";
export { parseSample, type ParseResult } from "./parse";
export { DiagnosticBag, type Diagnostic, type Severity } from "./diagnostics";
export { observeSamples, ROOT_PATH, type Observation, type ObservationMap, type ValueKind } from "./observe";
export { infer, type InferenceResult, type InferOptions } from "./infer";
export type { Shape, FieldShape, UnknownReason } from "./shape";
export { shapesEqual } from "./shape";
export {
  normalize,
  type NormalizeResult,
  type NormalizeOptions,
  type StructDecl,
  type ZigField,
} from "./normalize";
export { renderZigType, type ZigType } from "./zig/types";
export { escapeZigString, sanitizeFieldName, sanitizeStructName, toSnakeCase, toPascalCase, singularize } from "./zig/identifier";
export { generateZig, type GenerateOptions } from "./generate";
export { runPipeline, type PipelineInput, type PipelineResult } from "./pipeline";
