/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BoxDBError } from './errors';
import { Operator } from './operations';

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

// BoxData based on BoxScheme
export type BoxData<S extends BoxScheme> = {
  [key in keyof S]: AsType<PickType<S[key]>> | null;
};

//  BoxModel
export interface BoxModel<S extends BoxScheme> {
  new (initalData?: BoxData<S>): BoxData<S>;
  add: <S>(value: S, key?: IDBValidKey) => Promise<any>;
  get: <T>(key: T) => Promise<any>;
  drop: () => void;
  find: <T>(filter?: BoxModelFilter<S>) => BoxData<S>;
}

// BoxModel Prototype

export interface BoxModelPrototype {
  readonly __storeName__: string;
  readonly __scheme__: BoxScheme;
  readonly __validate: (target: UncheckedData) => boolean;
}

// Filter type
export type BoxModelFilter<S extends BoxScheme> = {
  [key in keyof S]?: Operator;
};

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

/**
 * Generate new model
 *
 * @param storeName Object store name
 * @param scheme Data scheme
 */
export const generateModel = <S extends BoxScheme>(storeName: string, scheme: S): BoxModel<S> => {
  const Model = (function Model(this: BoxModelPrototype, initalData?: BoxData<S>) {
    // Check scheme if initial data provided
    if (initalData && !this.__validate(initalData)) {
      throw new BoxDBError('data not valid');
    }

    // Create empty(null) object or initalData based on scheme
    Object.keys(scheme).forEach((k) => (this[k] = initalData ? initalData[k] : null));
  } as unknown) as BoxModel<S>;

  Model.prototype.__storeName__ = storeName;
  Model.prototype.__scheme__ = scheme;
  Model.prototype.__validate = schemeValidator.bind(Model.prototype);

  return Model;
};
