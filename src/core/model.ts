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

// change the type
type BoxData<S extends BoxScheme> = {
  [key in keyof S]: AsType<S[key]> | null;
};

// model prototype
type BoxModelPrototype = {
  __storeName__: string;
};

// instance type
export type BoxModel<S extends BoxScheme> = {
  new (): BoxData<S>;
  readonly get: <T>(id: T) => BoxData<S>;
};

export const generateModel = <S extends BoxScheme>(storeName: string, scheme: S): BoxModel<S> => {
  function Model(this: BoxModelPrototype) {
    // create scheme based empty(null) object
    Object.keys(scheme).forEach((k) => (this[k] = null));
  }

  Model.prototype.__storeName__ = storeName;
  Model.get = function <T>(id: T): BoxData<S> {
    // sample
    return Object.keys(scheme).reduce((o, k) => void (o[k] = null) || o, {}) as BoxData<S>;
  };
  return (Model as unknown) as BoxModel<S>;
};
