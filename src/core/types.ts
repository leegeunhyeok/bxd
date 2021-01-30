/* eslint-disable @typescript-eslint/no-explicit-any */
import { TransactionTask } from './task';

// Available types
export enum BoxDataTypes {
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  STRING = 'string',
  ARRAY = 'array',
  OBJECT = 'object',
  ANY = 'any',
}

// BoxModel scheme
export interface BoxScheme {
  [key: string]: ConfiguredType | BoxDataTypes;
}

export interface ConfiguredBoxScheme {
  [key: string]: ConfiguredType;
}

// BoxData based on BoxScheme
export type BoxData<S extends BoxScheme> = {
  [key in keyof S]: AsType<PickType<S[key]>> | null;
};

export type OptionalBoxData<S extends BoxScheme> = {
  [key in keyof S]?: AsType<PickType<S[key]>> | null;
};

export type UncheckedData = {
  [key: string]: any;
};

// BoxModel
export interface BoxModel<S extends BoxScheme> {
  new (initalData?: BoxData<S>): BoxData<S>;
  add: (value: BoxData<S>, key?: IDBValidKey) => Promise<void>;
  get: (
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ) => Promise<BoxData<S>>;
  put: (value: BoxData<S>, key?: IDBValidKey) => Promise<void>;
  delete(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): Promise<void>;
  find: (filter?: BoxModelFilter<S>) => BoxCursorModel<S>;
  drop: (targetVersion: number) => void;
  task: BoxTask<S>;
  name: string;
  prototype: BoxModelPrototype;
}

// BoxModel.task = BoxTask
export interface BoxTask<S extends BoxScheme> {
  add: (value: BoxData<S>, key?: IDBValidKey) => TransactionTask;
  put: (value: BoxData<S>, key?: IDBValidKey) => TransactionTask;
  delete: (
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ) => TransactionTask;
  find: (filter?: BoxModelFilter<S>) => BoxTaskCursorModel;
}

// BoxModel.find = () => BoxCursorModel
export interface BoxCursorModel<S extends BoxScheme> {
  get: () => Promise<S[]>;
  update: (value: any) => Promise<void>;
  delete: () => Promise<void>;
}

// BoxModel.task.find = () => BoxTaskCursorModel
export interface BoxTaskCursorModel {
  update: (value: any) => TransactionTask;
  delete: () => TransactionTask;
}

// BoxModel Prototype
export interface BoxModelPrototype {
  readonly __targetVersion__: number;
  readonly __storeName__: string;
  readonly __scheme__: BoxScheme;
  readonly __validate: (target: UncheckedData) => boolean;
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

export type CursorQuery<S extends BoxScheme> = {
  [key in keyof S]?: CursorKey;
};

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
  : T extends BoxDataTypes.ARRAY
  ? any[]
  : T extends BoxDataTypes.OBJECT
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    object
  : T extends BoxDataTypes.ANY
  ? any
  : never;
