import { generateModel, BoxScheme, BoxModel, ConfiguredBoxScheme } from './model';
import { BoxDBError } from './errors';

interface ModelMap {
  [version: number]: {
    [objectStoreName: string]: BoxModelMeta;
  };
}

interface ModelIndex {
  [objectStoreName: string]: number[];
}

interface BoxOptions {
  autoIncreament?: boolean;
}

interface BoxIndexConfig {
  keyPath: string;
  unique: boolean;
}

interface BoxModelMeta {
  name: string;
  scheme: ConfiguredBoxScheme;
  keyPath: string;
  autoIncrement: boolean;
  index: BoxIndexConfig[];
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
  private _modelVersionIndex: ModelIndex = {};

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
   * Get model metadata based on current idb version
   * @param storeName object store name
   */
  private _getCurrentModel(storeName: string): BoxModelMeta {
    return this._models[this._version][storeName];
  }

  /**
   * Get previous model metadata
   * @param baseVersion base idb version
   * @param storeName object store name
   */
  private _getPreviousModel(baseVersion: number, storeName: string): null | BoxModelMeta {
    const modelVersionIndex = this._modelVersionIndex[storeName];
    if (modelVersionIndex) {
      // Filter and sort versions (< currentVersion)
      const orderedIndex = modelVersionIndex
        .filter((version) => version < baseVersion)
        .sort((a, b) => a - b);

      // Get last version's model metadata
      // or if not exist, returns null
      if (orderedIndex.length) {
        const index = orderedIndex[modelVersionIndex.length - 1];
        return this._models[index][storeName];
      } else {
        return null;
      }
    } else {
      // If not has index, returns null
      return null;
    }
  }

  /**
   * Save model metadata, and version indexing for search
   * @param modelMeta model metadata for save
   */
  private _addModel(modelMeta: BoxModelMeta): void {
    const { targetVersion, name } = modelMeta;
    this._models[targetVersion][name] = modelMeta;

    // If not exist model version index array, create new one
    if (!this._modelVersionIndex[name]) {
      this._modelVersionIndex[name] = [];
    }
    this._modelVersionIndex[name].push(targetVersion);
  }

  /**
   * Regist new model scheme with exist checking
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

    // Assign new object literal if version map is not exist
    if (!this._models[targetVersion]) {
      this._models[targetVersion] = {};
    }

    const versionMap = this._models[targetVersion];
    if (versionMap[storeName]) {
      throw new BoxDBError(`${storeName} model already registered. (in version: ${targetVersion})`);
    }

    let primaryKeyPath: string = null;
    const previousModel = this._getPreviousModel(targetVersion, storeName);
    const indexList: BoxIndexConfig[] = [];
    const boxScheme = Object.entries(scheme).reduce((prev, [k, v]) => {
      if (typeof v === 'string') {
        prev[k] = { type: v };
      } else {
        // If this field use to object store keyPath
        if (v.key) {
          // Change keyPath not available
          if (previousModel && previousModel.keyPath !== k) {
            throw new BoxDBError(
              `Can not change ${storeName} model's keyPath. (exist: ${previousModel.keyPath})`,
            );
          }

          // Multiple keyPath not available
          if (primaryKeyPath) {
            throw new BoxDBError(
              `Can not define multiple keyPath in ${storeName} model. (exist: ${previousModel.keyPath})`,
            );
          }

          primaryKeyPath = k;
        }

        // If this field is index
        if (v.index) {
          indexList.push({
            keyPath: k,
            unique: !!v.unique,
          });
        }
        prev[k] = v;
      }

      return prev;
    }, {} as ConfiguredBoxScheme);

    this._addModel({
      name: storeName,
      scheme: boxScheme,
      keyPath: primaryKeyPath,
      autoIncrement: !!options?.autoIncreament,
      index: indexList,
      targetVersion,
    });
  }

  private _update(idb: IDBDatabase, event: IDBVersionChangeEvent) {
    Object.keys(this._models)
      .map((k) => parseInt(k))
      .sort((a, b) => a - b)
      .forEach((targetVersion) => {
        // Get target version models
        const currentVersionModels = this._models[targetVersion];

        console.log(currentVersionModels);

        Object.values(currentVersionModels).forEach((boxMeta) => {
          if (event.oldVersion < boxMeta.targetVersion && boxMeta.targetVersion <= this._version) {
            const objectStoreOptions: IDBObjectStoreParameters = {
              autoIncrement: boxMeta.autoIncrement,
              ...(boxMeta.keyPath ? { keyPath: boxMeta.keyPath } : null),
            };

            // Create object store
            const objectStore = idb.createObjectStore(boxMeta.name, objectStoreOptions);

            // Create index with configuration
            Object.values(boxMeta.index).forEach(({ keyPath, unique }) => {
              objectStore.createIndex(keyPath, keyPath, { unique });
            });
          }
        });
      });
  }

  /**
   * Regist data model for create object store
   * @param targetVersion target idb version
   */
  model(targetVersion: number): BoxModelRegister {
    /**
     * Regist data model for create object store
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
   * Create/update object stores and open idb
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
