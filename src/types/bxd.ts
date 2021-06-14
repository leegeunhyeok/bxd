import BoxTransaction from '../core/transaction';
import { TaskArguments } from '../utils';

// IDB APIs types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IDBData = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IDBValue = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IDBArgument = [any, any?];

export enum TransactionMode {
  READ = 'readonly',
  WRITE = 'readwrite',
}

export enum TransactionType {
  ADD = 'add',
  GET = 'get',
  PUT = 'put',
  DELETE = 'delete',
  CLEAR = 'clear',
  COUNT = 'count',
  // $ prefix means this task is using cursor
  $GET = '$get',
  $UPDATE = '$update',
  $DELETE = '$delete',
  INTERRUPT = 'interrupt',
}

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
  ANY = '0',
}

export enum BoxCursorDirections {
  ASC = 'next',
  ASC_UNIQUE = 'nextunique',
  DESC = 'prev',
  DESC_UNIQUE = 'prevunique',
}

// Pick type from type configuration
type PickType<P> = P extends ConfiguredType ? P['type'] : P extends BoxDataTypes ? P : never;

// BoxDataTypes to type
type AsType<T extends BoxDataTypes> = T extends BoxDataTypes.BOOLEAN
  ? boolean
  : T extends BoxDataTypes.NUMBER
  ? number
  : T extends BoxDataTypes.STRING
  ? string
  : T extends BoxDataTypes.DATE
  ? Date
  : T extends BoxDataTypes.ARRAY
  ? IDBValue[]
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
  ? IDBValue
  : never;

export type UncheckedData = {
  [field: string]: IDBValue;
};

/**
 * @description Box Types
 */
export interface Box<S extends BoxSchema> extends BoxHandler<S>, BoxTask<S> {
  new (initalData?: OptionalBoxData<S>): BoxData<S>;
}

export interface BoxPrototype {
  tx: BoxTransaction;
  $(type: TransactionType, args?: TaskArguments<BoxSchema>): Promise<void | IDBData | IDBData[]>;
  pass(target: UncheckedData, strict?: boolean): void | never;
  data<T extends BoxSchema>(initalData?: BoxData<T>): BoxData<T>;
}

export interface BoxProperty {
  __name: string;
  __schema: BoxSchema;
  __version: number;
}

export type BoxContext = BoxPrototype & BoxProperty;

export interface BoxSchema {
  readonly [field: string]: ConfiguredType | BoxDataTypes;
}

export interface ConfiguredBoxSchema {
  [field: string]: ConfiguredType;
}

export type ConfiguredType = {
  type: BoxDataTypes;
  key?: boolean;
  index?: boolean;
  unique?: boolean;
};

export interface BoxOptions {
  autoIncrement?: boolean;
  force?: boolean;
}

/**
 * @description Box handler Types
 */
export interface BoxHandler<S extends BoxSchema> {
  getName(): string;
  getVersion(): number;
  add(value: BoxData<S>, key?: IDBValidKey): Promise<IDBValidKey>;
  get(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): Promise<BoxData<S>>;
  put(value: OptionalBoxData<S>, key?: IDBValidKey): Promise<void>;
  delete(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): Promise<void>;
  find(range?: BoxRange<S> | null, ...predicate: BoxFilterFunction<S>[]): BoxCursorHandler<S>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

// Box.$* = BoxTask
export interface BoxTask<S extends BoxSchema> {
  $add(value: BoxData<S>, key?: IDBValidKey): TransactionTask;
  $put(value: OptionalBoxData<S>, key?: IDBValidKey): TransactionTask;
  $delete(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): TransactionTask;
  $find(
    range?: BoxRange<S> | null,
    ...predicate: BoxFilterFunction<S>[]
  ): TransactionCursorHandler<S>;
}

// Box.find = () => BoxCursorHandler
export interface BoxCursorHandler<S extends BoxSchema> {
  get(order?: BoxCursorDirections, limit?: number): Promise<BoxData<S>[]>;
  update(value: OptionalBoxData<S>): Promise<void>;
  delete(): Promise<void>;
}

// Box.$find = () => TransactionCursorHandler
export interface TransactionCursorHandler<S extends BoxSchema> {
  update(value: OptionalBoxData<S>): TransactionTask;
  delete(): TransactionTask;
}

/**
 * @description Transaction Types
 */
export interface TransactionTask {
  type: TransactionType;
  name: string;
  args?: IDBArgument;
}

export interface CursorTransactionTask<S extends BoxSchema> extends TransactionTask {
  direction?: BoxCursorDirections | null;
  filter?: BoxFilterFunction<S>[];
  range?: BoxRange<S> | null;
  target?: IDBKeyPath;
  limit?: number;
  updateValue?: IDBValue;
}

export interface BoxMeta {
  name: string;
  schema: ConfiguredBoxSchema | null;
  inKey: string | null;
  outKey: boolean;
  index: BoxIndexConfig[];
  force: boolean;
}

export interface BoxIndexConfig {
  keyPath: string;
  unique: boolean;
}
export interface BoxRange<S extends BoxSchema> {
  index?: Extract<keyof S, string>;
  value: IDBKeyRange | IDBValue;
}

// Filter function
export type BoxFilterFunction<S extends BoxSchema> = (value: BoxData<S>) => boolean;

// BoxData
export type BoxData<S extends BoxSchema> = {
  [field in keyof S]: AsType<PickType<S[field]>> | null;
};

export type OptionalBoxData<S extends BoxSchema> = Partial<BoxData<S>>;
