import { STORE_NAME, SCHEME } from '../constant';

type DataTypes = any;

interface Scheme {
  [key: string]: any;
}

export class Field {
  public type: DataTypes;
  public options: IDBIndexParameters;

  constructor(type: DataTypes, options: IDBIndexParameters) {
    this.type = type;
    this.options = options;
  }

  /**
   * Check data type
   * @param value Field data
   */
  __typeValidation(value: any) {
    return this.type.prototype === value.__proto__;
  }
}

export class Model {
  [STORE_NAME]: string = null;
  [SCHEME]: Scheme = null;

  update(targetVersion: number, newScheme: Scheme) {
    console.log(targetVersion);
    console.log(newScheme);
    this[SCHEME] = newScheme;
  }
}
