import { generateModel, BoxScheme, BoxModel } from './model';
import { BoxDBError } from './errors';

class BoxDB {
  private _init = false;
  private _databaseName: string;
  private _version: number;
  private _models: Map<string, BoxScheme> = new Map();

  /**
   * @constructor
   * @param databaseName idb name
   * @param version idb version
   */
  constructor(databaseName: string, version: number) {
    this._databaseName = databaseName;
    this._version = version;
  }

  get databaseName(): string {
    return this._databaseName;
  }

  get version(): number {
    return this._version;
  }

  /**
   * regist data model for create object store
   * @param storeName object store name
   * @param scheme object store data structure
   */
  model<S extends BoxScheme>(storeName: string, scheme: S): BoxModel<S> {
    if (this._init) {
      throw new BoxDBError('database already open');
    }
    if (this._models.has(storeName)) {
      throw new BoxDBError(`${storeName} model exist`);
    }
    this._models.set(storeName, scheme);
    return generateModel(storeName, scheme);
  }

  /**
   * create/update object stores and open idb
   */
  async open(): Promise<void> {
    this._init = true;
  }
}

export default BoxDB;
