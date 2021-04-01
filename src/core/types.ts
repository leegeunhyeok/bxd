/* eslint-disable @typescript-eslint/no-explicit-any */
import { TransactionTask } from './task';

// Follow defined IDB APIs types
export type IDBData = any;
export type IDBValue = any;

// Available types
export enum BoxDataTypes {
  BOOLEAN = '1',
  NUMBER = '2',
  STRING = '3',
  DATE = '4',
  ARRAY = '5',
  OBJECT = '6',
  REGEXP = '7',
  FILE = '8',
  BLOB = '9',
  ANY = '10',
}

export enum BoxCursorDirections {
  ASC = 'next',
  ASC_UNIQUE = 'nextunique',
  DESC = 'prev',
  DESC_UNIQUE = 'prevunique',
}

export interface BoxOption {
  autoIncrement?: boolean;
  force?: boolean;
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

export type OptionalBoxData<S extends BoxScheme> = Partial<BoxData<S>>;

export type UncheckedData = {
  [field: string]: any;
};

// BoxModel
export interface BoxModelMeta {
  name: string;
  scheme: ConfiguredBoxScheme;
  keyPath: string;
  autoIncrement: boolean;
  index: BoxIndexConfig[];
  force: boolean;
}

export interface BoxIndexConfig {
  keyPath: string;
  unique: boolean;
}

export interface BoxModel<S extends BoxScheme> extends BoxHandler<S> {
  new (initalData?: BoxData<S>): BoxData<S>;
  task: BoxTask<S>;
}

export interface BoxHandler<S extends BoxScheme> {
  getName(): string;
  getVersion(): number;
  add(value: BoxData<S>, key?: IDBValidKey): Promise<void>;
  get(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): Promise<BoxData<S>>;
  put(value: BoxData<S>, key?: IDBValidKey): Promise<void>;
  delete(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): Promise<void>;
  find(filter?: CursorQuery<S>): BoxCursorHandler<S>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

// BoxModel.task = BoxTask
export interface BoxTask<S extends BoxScheme> {
  add(value: BoxData<S>, key?: IDBValidKey): TransactionTask;
  put(value: BoxData<S>, key?: IDBValidKey): TransactionTask;
  delete(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): TransactionTask;
  find(filter?: CursorQuery<S>): BoxCursorTask<S>;
}

// BoxModel.find = () => BoxCursorHandler
export interface BoxCursorHandler<S extends BoxScheme> {
  get(order?: IDBCursorDirection, limit?: number): Promise<BoxData<S>[]>;
  update(value: OptionalBoxData<S>): Promise<void>;
  delete(): Promise<void>;
}

// BoxModel.task.find = () => BoxCursorTask
export interface BoxCursorTask<S extends BoxScheme> {
  update(value: OptionalBoxData<S>): TransactionTask;
  delete(): TransactionTask;
}

// Key of IDB cursor
export type CursorKey =
  | string
  | number
  | Date
  | ArrayBufferView
  | ArrayBuffer
  | IDBArrayKey
  | IDBKeyRange;

// CursorQuery (using IDBKeyRange)
export interface CursorCondition<S extends BoxScheme> {
  target?: Extract<keyof S, string>;
  value: IDBKeyRange;
}

// Filter function
export type EvalFunction<S extends BoxScheme> = (value: OptionalBoxData<S>) => boolean;

export type CursorQuery<S extends BoxScheme> = CursorCondition<S> | EvalFunction<S>[];
export interface CursorOptions<S extends BoxScheme> {
  // IDBKeyRange or filter functions
  filter?: CursorQuery<S>;
  // For update value
  value?: OptionalBoxData<S>;
  // Cursor direction
  direction?: IDBCursorDirection;
  // Record limit
  limit?: number;
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
