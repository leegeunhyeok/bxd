import { generateModel, BoxScheme, BoxModel, ConfiguredBoxScheme } from './model';
import { BoxDBError } from './errors';

interface ModelMap {
  [key: number]: {
    [key: string]: BoxModelMeta;
  };
}

interface BoxOptions {
  autoIncreament?: boolean;
}
interface BoxModelMeta {
  scheme: ConfiguredBoxScheme;
  autoIncrement: boolean;
  targetVersion: number;
}

type BoxModelRegister = <S extends BoxScheme>(
  storeName: string,
  scheme: S,
  options?: BoxOptions,
) => BoxModel<S>;

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
    options: BoxOptions,
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
        `${storeName} model already registered on (targetVersion: ${targetVersion})`,
      );
    }

    const boxScheme = Object.entries(scheme).reduce((prev, [k, v]) => {
      prev[k] = typeof v === 'string' ? { type: v } : v;
      return prev;
    }, {} as ConfiguredBoxScheme);

    versionMap[storeName] = {
      scheme: boxScheme,
      targetVersion,
      autoIncrement: options?.autoIncreament || false,
    };
  }

  private _update(idb: IDBDatabase, event: IDBVersionChangeEvent) {
    Object.keys(this._models)
      .map((k) => parseInt(k))
      .sort((a, b) => a - b)
      .forEach((targetVersion) => {
        // get target version models
        const models = this._models[targetVersion];

        Object.entries(models).forEach(([objectStoreName, boxMeta]) => {
          if (event.oldVersion < boxMeta.targetVersion) {
            // find keyPath
            const keyPath = Object.keys(boxMeta.scheme).find((k) => boxMeta.scheme[k].key);
            const objectStoreOptions: IDBObjectStoreParameters = {
              autoIncrement: boxMeta.autoIncrement,
              ...(keyPath ? { keyPath } : null),
            };

            // create object store
            const objectStore = idb.createObjectStore(objectStoreName, objectStoreOptions);

            // create index with configuration
            Object.keys(boxMeta.scheme)
              .filter((k) => boxMeta.scheme[k].index)
              .forEach((k) => {
                objectStore.createIndex(k, k, {
                  unique: boxMeta.scheme[k].unique,
                });
              });
          }
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
    return <S extends BoxScheme>(
      storeName: string,
      scheme: S,
      options?: BoxOptions,
    ): BoxModel<S> => {
      this._registModel(targetVersion, storeName, scheme, options);
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
