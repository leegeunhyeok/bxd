/* eslint-disable @typescript-eslint/no-unused-vars */
import BoxDB from './db';
import { BoxDBError } from './errors';

export interface BoxScheme {
  readonly [key: string]: Types;
}

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
  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any[]
  : T extends Types.OBJECT
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    object
  : T extends Types.ANY
  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  : never;

type UncheckedData = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

// change the type
type BoxData<S extends BoxScheme> = {
  [key in keyof S]: AsType<S[key]> | null;
};

// instance type
export interface BoxModel<S extends BoxScheme> {
  new (initalData?: BoxData<S>): BoxData<S>;
  get: <T>(id: T) => BoxData<S>;
}

export interface BoxModelPrototype {
  readonly __context__: BoxDB;
  readonly __storeName__: string;
  readonly __scheme__: BoxScheme;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly __validate: (target: UncheckedData) => boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 * @param this Model
 * @param target target data
 */
const schemeValidator = function (this: BoxModelPrototype, target: UncheckedData): boolean {
  const schemeKeys = Object.keys(this.__scheme__);
  const targetKeys = Object.keys(target);

  return (
    schemeKeys.length === targetKeys.length &&
    schemeKeys.every((k) => ~targetKeys.indexOf(k)) &&
    Object.entries(this.__scheme__).every(([k, v]) => typeValidator(v, target[k]))
  );
};

const actionWrapper = {
  _getModelPrototype<S extends BoxScheme>(model: BoxModel<S>) {
    return model.prototype as BoxModelPrototype;
  },
  test<S extends BoxScheme>(model: BoxModel<S>) {
    return () => {
      const modelPrototype = model.prototype as BoxModelPrototype;
      modelPrototype.__context__.test(modelPrototype.__storeName__);
      return {} as BoxData<S>;
    };
  },
};

/**
 * Generate new model
 * @param storeName Object store name
 * @param scheme Data scheme
 */
export const generateModel = <S extends BoxScheme>(
  context: BoxDB,
  storeName: string,
  scheme: S,
): BoxModel<S> => {
  const Model = (function Model(this: BoxModelPrototype, initalData?: BoxData<S>) {
    if (initalData && !this.__validate(initalData)) {
      throw new BoxDBError('data not valid');
    }

    // create scheme based empty(null) object
    Object.keys(scheme).forEach((k) => (this[k] = initalData ? initalData[k] : null));
  } as unknown) as BoxModel<S>;

  Model.prototype.__context__ = context;
  Model.prototype.__storeName__ = storeName;
  Model.prototype.__scheme__ = scheme;
  Model.prototype.__validate = schemeValidator.bind(Model.prototype);

  // static methods
  Model.get = actionWrapper.test(Model);

  return Model;
};
