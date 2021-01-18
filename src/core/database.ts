import { generateModel, BoxScheme, BoxModel } from './model';
import { BoxDBError } from './errors';

interface ModelMap {
  [key: number]: {
    [key: string]: BoxModelMeta;
  };
}
interface BoxModelMeta {
  scheme: BoxScheme;
  targetVersion: number;
}

type BoxModelRegister = <S extends BoxScheme>(storeName: string, scheme: S) => BoxModel<S>;

class BoxDB {
  private _init = false;
  private _databaseName: string;
  private _version: number;
  private _models: ModelMap = {};

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
   * regist new model scheme with exist checking
   * @param targetVersion target idb version
   * @param storeName object store name
   * @param scheme scheme object
   */
  private _registModel<S extends BoxScheme>(
    targetVersion: number,
    storeName: string,
    scheme: S,
  ): void {
    if (this._init) {
      throw new BoxDBError('database already open');
    }

    // create new object(for map) if version map is not exist
    if (!this._models[targetVersion]) {
      this._models[targetVersion] = {};
    }

    const versionMap = this._models[targetVersion];
    if (versionMap[storeName]) {
      throw new BoxDBError(
        `${storeName} model already registered on targetVersion: ${targetVersion})`,
      );
    }
    versionMap[storeName] = { scheme, targetVersion };
  }

  private _update(idb: IDBDatabase, event: IDBVersionChangeEvent) {
    Object.keys(this._models)
      .map((k) => parseInt(k))
      .sort((a, b) => a - b)
      .forEach((targetVersion) => {
        const models = this._models[targetVersion];
        Object.entries(models).forEach(([objectStoreName, scheme]) => {
          console.log(targetVersion, objectStoreName, scheme);
        });
      });
  }

  /**
   * regist data model for create object store
   * @param targetVersion target idb version
   */
  model(targetVersion: number): BoxModelRegister {
    /**
     * regist data model for create object store
     * @param storeName object store name
     * @param scheme object store data structure
     */
    return <S extends BoxScheme>(storeName: string, scheme: S): BoxModel<S> => {
      this._registModel(targetVersion, storeName, scheme);
      return generateModel(this, storeName, scheme);
    };
  }

  // TEST
  test(name: string): void {
    console.log('from ' + name);
  }

  /**
   * create/update object stores and open idb
   */
  async open(): Promise<Event> {
    return new Promise((resolve, reject) => {
      const openRequest = self.indexedDB.open(this._databaseName, this._version);

      // IDB Open successfully
      openRequest.onsuccess = (event) => {
        this._init = true;
        resolve(event);
      };

      openRequest.onupgradeneeded = (event) => this._update(openRequest.result, event);

      // Error occurs
      openRequest.onerror = (event) => reject(event);
    });
  }
}

export default BoxDB;
