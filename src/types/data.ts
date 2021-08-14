import { Schema, ConfiguredType } from './schema';

export enum DataType {
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

type AsType<T extends DataType, V = unknown> = T extends DataType.BOOLEAN
  ? boolean
  : T extends DataType.NUMBER
  ? number
  : T extends DataType.STRING
  ? string
  : T extends DataType.DATE
  ? Date
  : T extends DataType.ARRAY
  ? V[]
  : T extends DataType.OBJECT
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    object
  : T extends DataType.REGEXP
  ? RegExp
  : T extends DataType.FILE
  ? File
  : T extends DataType.BLOB
  ? Blob
  : T extends DataType.ANY
  ? V
  : never;

// Pick type from type configuration
type PickType<P> = P extends ConfiguredType ? P['type'] : P extends DataType ? P : never;

export type Data<S extends Schema> = {
  [field in keyof S]: AsType<PickType<S[field]>>;
};

export type NullableData<S extends Schema> = {
  [field in keyof S]: AsType<PickType<S[field]>> | null;
};

export type OptionalData<S extends Schema> = Partial<Data<S>>;
