export type SrcRef = {
  sample: number;
  offset: number;
  length: number;
};

export type ZNull = { kind: "null"; src: SrcRef };
export type ZBool = { kind: "bool"; value: boolean; src: SrcRef };
export type ZInt = { kind: "int"; value: bigint; src: SrcRef };
export type ZFloat = { kind: "float"; value: number; src: SrcRef };
export type ZString = { kind: "string"; value: string; src: SrcRef };
export type ZArray = { kind: "array"; items: ZValue[]; src: SrcRef };
export type ZObject = { kind: "object"; fields: Map<string, ZField>; src: SrcRef };

export type ZField = {
  key: string;
  keySrc: SrcRef;
  value: ZValue;
};

export type ZValue = ZNull | ZBool | ZInt | ZFloat | ZString | ZArray | ZObject;
