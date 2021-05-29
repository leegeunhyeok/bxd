export * from './task';

// Follows defined IDB APIs types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IDBData = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IDBValue = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IDBArgument = [any, any?];

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
  ANY = '0',
}

export enum BoxCursorDirections {
  ASC = 'next',
  ASC_UNIQUE = 'nextunique',
  DESC = 'prev',
  DESC_UNIQUE = 'prevunique',
}

export interface BoxOptions {
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
  [field: string]: IDBValue;
};

// BoxModel
export interface BoxModelMeta {
  name: string;
  scheme: ConfiguredBoxScheme;
  inKey: string;
  outKey: boolean;
  index: BoxIndexConfig[];
  force: boolean;
}

export interface BoxIndexConfig {
  keyPath: string;
  unique: boolean;
}
// CursorQuery (using IDBKeyRange)
export interface BoxRange<S extends BoxScheme> {
  target?: Extract<keyof S, string>;
  value: IDBKeyRange | IDBValue;
}

// Filter function
export type BoxFilterFunction<S extends BoxScheme> = (value: BoxData<S>) => boolean;

export type CursorQuery<S extends BoxScheme> = BoxRange<S> | BoxFilterFunction<S>[];
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
