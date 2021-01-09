import { STORE_NAME, SCHEME } from '../constant';

type DataTypes = any;

interface FieldConfig {
  unique?: boolean;
}

interface Scheme {
  [key: string]: any;
}

export class Model {
  type;
  options;
  indexing = false;
  indexOption: IDBIndexParameters = null;

  constructor(type: DataTypes, options: FieldConfig) {
    this.type = type;
    this.options = options;
  }

  index(options?: IDBIndexParameters) {
    this.indexing = true;
    this.indexOption = options;
  }

  /**
   * Check data type
   * @param value Field data
   */
  __typeValidation(value: any) {
    return this.type.prototype === value.__proto__;
  }
}

export class Item {
  [STORE_NAME]: string = null;
  [SCHEME]: Scheme = null;

  update(targetVersion: number, newScheme: Scheme) {
    console.log(targetVersion);
    console.log(newScheme);
    this[SCHEME] = newScheme;
  }
}
