/* eslint-disable @typescript-eslint/no-explicit-any */
import { TransactionTask } from './task';
import BoxTransaction from './transaction';

// Available types
export enum BoxDataTypes {
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  STRING = 'string',
  DATE = 'date',
  ARRAY = 'array',
  OBJECT = 'object',
  REGEXP = 'regexp',
  FILE = 'file',
  BLOB = 'blob',
  ANY = 'any',
}

export enum BoxCursorDirections {
  ASC = 'next',
  ASC_UNIQUE = 'nextunique',
  DESC = 'prev',
  DESC_UNIQUE = 'prevunique',
}

// BoxModel scheme
export interface BoxScheme {
  [field: string]: ConfiguredType | BoxDataTypes;
}

export interface ConfiguredBoxScheme {
  [field: string]: ConfiguredType;
}

// BoxData based on BoxScheme
export type BoxData<S extends BoxScheme> = {
  [field in keyof S]: AsType<PickType<S[field]>>;
};

export type OptionalBoxData<S extends BoxScheme> = {
  [field in keyof S]?: AsType<PickType<S[field]>>;
};

export type UncheckedData = {
  [field: string]: any;
};

// BoxModel
export interface BoxModel<S extends BoxScheme> extends BoxHandler<S> {
  readonly name: string;
  readonly version: number;
  readonly __init: (tx: BoxTransaction) => void;
  new (initalData?: BoxData<S>): BoxData<S>;
  drop: (targetVersion: number) => void;
  task: BoxTask<S>;
  prototype: BoxModelPrototype;
}

export interface BoxHandler<S extends BoxScheme> {
  add: (this: BoxModel<S>, value: BoxData<S>, key?: IDBValidKey) => Promise<void>;
  get: (
    this: BoxModel<S>,
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ) => Promise<BoxData<S>>;
  put: (this: BoxModel<S>, value: BoxData<S>, key?: IDBValidKey) => Promise<void>;
  delete(
    this: BoxModel<S>,
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): Promise<void>;
  find: (this: BoxModel<S>, filter?: BoxModelFilter<S>) => BoxCursorHandler<S>;
  clear: (this: BoxModel<S>) => Promise<void>;
}

// BoxModel.task = BoxTask
export interface BoxTask<S extends BoxScheme> {
  __ctx__: BoxModelPrototype;
  add: (this: BoxTask<S>, value: BoxData<S>, key?: IDBValidKey) => TransactionTask;
  put: (this: BoxTask<S>, value: BoxData<S>, key?: IDBValidKey) => TransactionTask;
  delete: (
    this: BoxTask<S>,
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ) => TransactionTask;
  find: (this: BoxTask<S>, filter?: BoxModelFilter<S>) => BoxCursorTask<S>;
}

// BoxModel.find = () => BoxCursorModel
export interface BoxCursorHandler<S extends BoxScheme> {
  get: () => Promise<BoxData<S>[]>;
  update: (value: OptionalBoxData<S>) => Promise<void>;
  delete: () => Promise<void>;
}

// BoxModel.task.find = () => BoxTaskCursorModel
export interface BoxCursorTask<S extends BoxScheme> {
  update: (value: OptionalBoxData<S>) => TransactionTask;
  delete: () => TransactionTask;
}

// BoxModel Prototype
export interface BoxModelPrototype {
  readonly __tx__: BoxTransaction;
  readonly __targetVersion__: number;
  readonly __storeName__: string;
  readonly __available__: boolean;
  readonly __scheme__: BoxScheme;
  readonly __validate: (target: UncheckedData) => boolean;
  readonly __mustAvailable: () => true | never;
  toString: () => string;
}

// Filters for BoxModel.find()
export type BoxModelFilter<S extends BoxScheme> = EvalFunction<S>[] | CursorQuery<S>;

// Key of IDB cursor
export type CursorKey =
  | string
  | number
  | Date
  | ArrayBufferView
  | ArrayBuffer
  | IDBArrayKey
  | IDBKeyRange;

export interface CursorQuery<S extends BoxScheme> {
  field: Extract<keyof S, string>;
  key: CursorKey;
  direction?: BoxCursorDirections;
}

// Filter function
export type EvalFunction<S extends BoxScheme> = (value: OptionalBoxData<S>) => boolean;

export interface CursorOptions<S extends BoxScheme> {
  filter?: CursorQuery<S> | EvalFunction<S>[];
  updateValue?: OptionalBoxData<S>;
}

// type with other options (configured)
export type ConfiguredType = {
  type: BoxDataTypes;
  key?: boolean;
  index?: boolean;
  unique?: boolean;
};

// Pick type from type configuration
type PickType<P> = P extends ConfiguredType ? P['type'] : P extends BoxDataTypes ? P : never;

// BoxDataTypes enum values to type
type AsType<T extends BoxDataTypes> = T extends BoxDataTypes.BOOLEAN
  ? boolean
  : T extends BoxDataTypes.NUMBER
  ? number
  : T extends BoxDataTypes.STRING
  ? string
  : T extends BoxDataTypes.DATE
  ? Date
  : T extends BoxDataTypes.ARRAY
  ? any[]
  : T extends BoxDataTypes.OBJECT
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    object
  : T extends BoxDataTypes.REGEXP
  ? RegExp
  : T extends BoxDataTypes.FILE
  ? File
  : T extends BoxDataTypes.BLOB
  ? Blob
  : T extends BoxDataTypes.ANY
  ? any
  : never;
