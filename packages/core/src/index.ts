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
export { pathSrcMap } from "./value";
export {
  parseSample,
  parseJson,
  parseYaml,
  parseToml,
  detectFormat,
  SUPPORTED_FORMATS,
  type Format,
  type ParseResult,
  type DetectResult,
} from "./parse";
export { DiagnosticBag, type Diagnostic, type Severity } from "./diagnostics";
export { observeSamples, ROOT_PATH, type Observation, type ObservationMap, type ValueKind } from "./observe";
export { infer, type InferenceResult, type InferOptions } from "./infer";
export type { Shape, FieldShape, EnumVariant, UnionVariant, UnknownReason } from "./shape";
export { shapesEqual } from "./shape";
export {
  normalize,
  type NormalizeResult,
  type NormalizeOptions,
  type StructDecl,
  type EnumDecl,
  type EnumDeclVariant,
  type UnionDecl,
  type UnionDeclVariant,
  type Decl,
  type ZigField,
} from "./normalize";
export { renderZigType, type ZigType, type ZigIntWidth, pickIntWidth } from "./zig/types";
export { escapeZigString, sanitizeFieldName, sanitizeStructName, toSnakeCase, toPascalCase, singularize } from "./zig/identifier";
export { generateZig, type GenerateOptions } from "./generate";
export { runPipeline, type PipelineInput, type PipelineResult } from "./pipeline";
export {
  type ZigshapeOptions,
  type IntStrategy,
  type EnumStrategy,
  type UnionStrategy,
  type AliasStrategy,
  type StringStrategy,
  type MapStrategy,
  DEFAULT_OPTIONS,
  withDefaults,
} from "./options";
export { buildReport, type SchemaReport, type ReportField, type ReportDecl } from "./report";
export {
  diffReports,
  formatDrift,
  type DriftEntry,
  type DriftReport,
  type DriftSeverity,
} from "./drift";
