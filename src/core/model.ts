/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BoxDBError } from './errors';
import { Operator } from './operations';
import { TransactionTask } from './query';

// BoxData based on BoxScheme
export type BoxData<S extends BoxScheme> = {
  [key in keyof S]: AsType<PickType<S[key]>> | null;
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
  find: (filter?: BoxModelFilter<S>) => BoxData<S>;
  drop: (targetVersion: number) => void;
  task: BoxTask<S>;
  name: string;
  prototype: BoxModelPrototype;
}

export interface BoxTask<S extends BoxScheme> {
  add: (value: BoxData<S>, key?: IDBValidKey) => TransactionTask;
  get: (
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ) => TransactionTask;
  put: (value: BoxData<S>, key?: IDBValidKey) => TransactionTask;
  delete: (
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ) => TransactionTask;
}

// BoxModel Prototype

export interface BoxModelPrototype {
  readonly __targetVersion__: number;
  readonly __storeName__: string;
  readonly __scheme__: BoxScheme;
  readonly __validate: (target: UncheckedData) => boolean;
}

// Filter type
export type BoxModelFilter<S extends BoxScheme> = {
  [key in keyof S]?: Operator;
};

export type ConfiguredType = {
  type: Types;
  key?: boolean;
  index?: boolean;
  unique?: boolean;
};

export interface BoxScheme {
  [key: string]: ConfiguredType | Types;
}

export interface ConfiguredBoxScheme {
  [key: string]: ConfiguredType;
}

// Check available types
export enum Types {
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  STRING = 'string',
  ARRAY = 'array',
  OBJECT = 'object',
  ANY = 'any',
}

type AsType<T extends Types> = T extends Types.BOOLEAN
  ? boolean
  : T extends Types.NUMBER
  ? number
  : T extends Types.STRING
  ? string
  : T extends Types.ARRAY
  ? any[]
  : T extends Types.OBJECT
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    object
  : T extends Types.ANY
  ? any
  : never;

type UncheckedData = {
  [key: string]: any;
};

// Pick type from type configuration
type PickType<P> = P extends ConfiguredType ? P['type'] : P extends Types ? P : never;

/**
 * Check about target value has same type with type identifier
 *
 * @param type Type identifier (from enum)
 * @param value Value for check
 */
const typeValidator = (type: Types, value: any): boolean => {
  const targetPrototype = value.__proto__;

  switch (type) {
    case Types.BOOLEAN:
      return targetPrototype === Boolean.prototype;
    case Types.NUMBER:
      return targetPrototype === Number.prototype;
    case Types.STRING:
      return targetPrototype === String.prototype;
    case Types.ARRAY:
      return targetPrototype === Array.prototype;
    case Types.OBJECT:
      return targetPrototype === Object.prototype;
    case Types.ANY:
      return true; // any
    default:
      return false;
  }
};

/**
 * Check object keys matching and data types
 *
 * 1. Target's key length is same with model scheme's key length
 * 2. Check target's keys in scheme
 * 3. Target's value types are correct with scheme
 *
 * @param this Model
 * @param target target data
 */
const schemeValidator = function (this: BoxModelPrototype, target: UncheckedData): boolean {
  const schemeKeys = Object.keys(this.__scheme__);
  const targetKeys = Object.keys(target);

  return (
    schemeKeys.length === targetKeys.length &&
    schemeKeys.every((k) => ~targetKeys.indexOf(k)) &&
    Object.entries(this.__scheme__).every(([k, v]) =>
      typeValidator(typeof v === 'string' ? v : v.type, target[k]),
    )
  );
};

const mergeObject = <T>(baseObject: T, targetObject?: T): T => {
  Object.keys(baseObject).forEach((k) => {
    baseObject[k] = (targetObject && targetObject[k]) || null;
  });
  return baseObject;
};

/**
 * Generate new model
 *
 * @param storeName Object store name
 * @param scheme Data scheme
 */
export const generateModel = <S extends BoxScheme>(
  targetVersion: number,
  storeName: string,
  scheme: S,
): BoxModel<S> => {
  const Model = (function Model(this: BoxModelPrototype, initalData?: BoxData<S>) {
    // Check scheme if initial data provided
    if (initalData && !this.__validate(initalData)) {
      throw new BoxDBError('data not valid');
    }

    // Create empty(null) object or initalData based on scheme
    Object.assign(this, mergeObject(scheme, initalData));
  } as unknown) as BoxModel<S>;

  // Model prototype
  Object.assign(Model.prototype, {
    __targetVersion__: targetVersion,
    __storeName__: storeName,
    __scheme__: scheme,
    __validate: schemeValidator.bind(Model.prototype),
  });

  // Model static fields
  Object.defineProperty(Model, 'name', { value: storeName });

  return Model;
};
