import { DataType } from './data';

export type ConfiguredType = {
  type: DataType;
  key?: boolean;
  index?: boolean;
  unique?: boolean;
};

export type ConfiguredSchema = {
  [field: string]: ConfiguredType;
};

export type Schema = {
  readonly [field: string]: ConfiguredType | DataType;
};
