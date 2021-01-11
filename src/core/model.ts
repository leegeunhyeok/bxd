export class BoxField {
  public options: IDBIndexParameters;

  constructor(type: DataTypes, options?: IDBIndexParameters) {
    this.options = options;
  }
}

export interface BoxScheme {
  [key: string]: BoxField;
}

// data types that can be stored in idb
// referance: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
type DataTypes =
  | boolean
  | number
  | string
  | Array<DataTypes>
  | Map<DataTypes, DataTypes>
  | Set<DataTypes>
  // eslint-disable-next-line @typescript-eslint/ban-types
  | object // Record<string, unknown>
  | undefined
  | null
  | RegExp
  | Blob
  | File
  | FileList
  | ArrayBuffer
  | ArrayBufferView
  | ImageBitmap
  | ImageData;

// change the type
type BoxData<Base> = {
  [key in keyof Base]: DataTypes;
};

// model prototype
type BoxModelPrototype = {
  __storeName__: string;
};

// instance type
export type BoxModel<S> = {
  new (): BoxData<S>;
  get: <T>(id: T) => BoxData<S>;
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
