export class BoxField {
  public type: DataTypes;
  public options: IDBIndexParameters;

  constructor(type: DataTypes, options?: IDBIndexParameters) {
    this.type = type;
    this.options = options;
  }

  /**
   * check data type
   * @param value field data
   */
  __typeValidation(value: any): boolean {
    return this.type.prototype === value.__proto__;
  }
}

export interface BoxScheme {
  [key: string]: BoxField;
}

// TODO: update to storeable types
// ref: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
type DataTypes = any;

// change the type
type BoxData<Base> = {
  [key in keyof Base]: DataTypes;
};

// instance type
export type BoxModel<S> = InstanceType<{
  get: <T>(id: T) => void;
  new (): BoxData<S>;
}>;

export const generateModel = <S extends BoxScheme>(storeName: string, scheme: S): BoxModel<S> => {
  function Model() {
    // create scheme based empty(null) object
    Object.keys(scheme).forEach((k) => (this[k] = null));
  }
  Model.prototype.__storeName__ = storeName;
  Model.prototype.get = function <T>(id: T) {
    // sample
    console.log('get', id);
  };
  return (Model as unknown) as BoxModel<S>;
};
