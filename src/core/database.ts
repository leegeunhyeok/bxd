/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types, BoxScheme, ConfiguredBoxScheme, BoxModel, generateModel } from './model';
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
  autoIncrement?: boolean;
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
  action: BoxModelActionType;
}

enum BoxModelActionType {
  CREATE,
  DROP,
  UPDATE,
}

type BoxModelRegister = <S extends BoxScheme>(
  storeName: string,
  scheme: S,
  options?: BoxOptions,
) => BoxModel<S>;

enum BasicTransactionActions {
  ADD = 'add',
  GET = 'get',
  PUT = 'put',
  DELETE = 'delete',
  CLEAR = 'clear',
}

class BoxDB {
  public static Types = Types;
  private _init = false;
  private _databaseName: string;
  private _version: number;
  private _models: ModelMap = {};
  private _modelVersionIndex: ModelIndex = {};
  private _idb: IDBDatabase = null;

  /**
   * @constructor
   * @param databaseName idb name
   * @param version idb version
   */
  constructor(databaseName: string, version: number) {
    if (typeof databaseName !== 'string') throw new BoxDBError('databaseName must be string');
    if (typeof version !== 'number') throw new BoxDBError('version must be version');
    this._databaseName = databaseName;
    this._version = version;
  }

  get databaseName(): string {
    return this._databaseName;
  }

  get version(): number {
    return this._version;
  }

  get ready(): boolean {
    return this._init;
  }

  private _isPrepared() {
    if (!this._init) throw new BoxDBError('BoxDB not ready');
  }

  /**
   * Get model metadata based on current idb version
   *
   * @param storeName object store name
   */
  private _getCurrentModel(storeName: string): BoxModelMeta {
    return this._models[this._version][storeName];
  }

  /**
   * Get previous model metadata
   *
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
        const index = orderedIndex[orderedIndex.length - 1];
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
   *
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
   * Model exist checking and regist new model scheme
   *
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

    // Change keyPath not available
    if (previousModel && previousModel.keyPath !== primaryKeyPath) {
      throw new BoxDBError(
        `Can not change ${storeName} model's keyPath. (exist: ${previousModel.keyPath})`,
      );
    }

    this._addModel({
      name: storeName,
      scheme: boxScheme,
      keyPath: primaryKeyPath,
      autoIncrement: !!options?.autoIncrement,
      index: indexList,
      targetVersion,
      action: previousModel ? BoxModelActionType.UPDATE : BoxModelActionType.CREATE,
    });
  }

  /**
   * Update object store action to BoxModelActionType.DROP (for delete object store)
   *
   * @param storeName Object store name for unregistration
   */
  private _unregistModel(storeName: string) {
    const dropped = Object.keys(this._models)
      .map((version) => parseInt(version))
      .filter((version) => this._version >= version)
      .sort((a, b) => a - b)
      .some((filteredVersion) => {
        const targetVersionModels = this._models[filteredVersion];
        if (storeName in targetVersionModels) {
          // Add new metadata into targetVersion map
          this._models[1][storeName] = {
            ...targetVersionModels[storeName],
            targetVersion: 1,
            action: BoxModelActionType.DROP,
          };
          return true;
        } else {
          return false;
        }
      });

    // If target object store not found in any version
    if (!dropped) {
      throw new BoxDBError(`Can not drop ${storeName} because target object store not registered`);
    }
  }

  /**
   * Create new object store in this idb
   *
   * @param openRequest
   * @param boxMeta
   */
  private _createObjectStore(openRequest: IDBOpenDBRequest, boxMeta: BoxModelMeta) {
    const idb = openRequest.result;

    // Create object store
    const objectStore = idb.createObjectStore(boxMeta.name, {
      autoIncrement: boxMeta.autoIncrement,
      ...(boxMeta.keyPath ? { keyPath: boxMeta.keyPath } : null),
    });

    // Create index with configuration
    Object.values(boxMeta.index).forEach(({ keyPath, unique }) => {
      objectStore.createIndex(keyPath, keyPath, { unique });
    });
  }

  /**
   * Update object store of idb
   *
   * @param openRequest
   * @param boxMeta
   */
  private _updateObjectStore(openRequest: IDBOpenDBRequest, boxMeta: BoxModelMeta) {
    const indexNameExtractor = (indexConfig) => indexConfig.keyPath;
    const previousModel = this._getPreviousModel(boxMeta.targetVersion, boxMeta.name);
    const previousIndexNameList = previousModel.index.map(indexNameExtractor);
    const currentIndexNameList = boxMeta.index.map(indexNameExtractor);
    const objectStore = openRequest.transaction.objectStore(boxMeta.name);

    // Delete old index if index not found in current scheme
    previousIndexNameList.forEach(
      (keyPath) => ~currentIndexNameList.indexOf(keyPath) || objectStore.deleteIndex(keyPath),
    );

    // Create new index if not exist in old scheme
    boxMeta.index.forEach(({ keyPath, unique }) => {
      !~previousIndexNameList.indexOf(keyPath) &&
        objectStore.createIndex(keyPath, keyPath, { unique });
    });
  }

  /**
   * Delete object store
   *
   * @param openRequest
   * @param boxMeta
   */
  private _deleteObjectStore(openRequest: IDBOpenDBRequest, boxMeta: BoxModelMeta) {
    const idb = openRequest.result;
    idb.deleteObjectStore(boxMeta.name);
  }

  /**
   * Update defined object stores
   *
   * @param openRequest IDBOpenRequest
   * @param event Event from onupgradeneeded event
   */
  private _update(openRequest: IDBOpenDBRequest, event: IDBVersionChangeEvent) {
    Object.keys(this._models)
      .map((k) => parseInt(k)) // Version keys to integer
      .filter((version) => version <= this._version) // Filtering (<= Current idb version)
      .sort((a, b) => a - b) // Sort by ascending
      .forEach((targetVersion) => {
        // Get target version models
        const currentVersionModels = this._models[targetVersion];

        Object.values(currentVersionModels).forEach((boxMeta) => {
          if (event.oldVersion < boxMeta.targetVersion) {
            switch (boxMeta.action) {
              case BoxModelActionType.CREATE:
                this._createObjectStore(openRequest, boxMeta);
                break;

              case BoxModelActionType.UPDATE:
                this._updateObjectStore(openRequest, boxMeta);
                break;

              case BoxModelActionType.DROP:
                this._deleteObjectStore(openRequest, boxMeta);
                break;
            }
          }
        });
      });
  }

  /**
   * Basic handler for object store transactions
   *
   * - Supports: `add`, `get`, `put`, `delete`, `clear`
   *
   * @param storeName target object store name
   * @param action object store transaction type
   * @param mode transaction mode
   * @param args transaction arguments
   */
  private _basicTransactionHandler(
    storeName: string,
    action: BasicTransactionActions,
    mode: IDBTransactionMode,
    ...args: any[]
  ): Promise<any> {
    this._isPrepared();

    return new Promise((resolve, reject) => {
      const tx = this._idb.transaction(storeName, mode);
      const objectStore = tx.objectStore(storeName);
      const request = objectStore[action].call(objectStore, ...args);

      // On success
      request.onsuccess = () => resolve(request.result);

      // On error
      tx.onerror = () => reject(new BoxDBError(tx.error.message));
    });
  }

  /**
   * Regist data model for create object store
   *
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

  /**
   * Create/update object stores and open idb
   */
  async open(): Promise<Event> {
    return new Promise((resolve, reject) => {
      const openRequest = self.indexedDB.open(this._databaseName, this._version);

      // IDB Open successfully
      openRequest.onsuccess = (event) => {
        this._init = true;
        this._idb = openRequest.result;
        resolve(event);
      };

      openRequest.onupgradeneeded = (event) => this._update(openRequest, event);

      // Error occurs
      openRequest.onerror = (event) => reject(event);
    });
  }

  /**
   * Add new record into target object store
   *
   * @param storeName object store name for open transaction
   * @param value idb object store keyPath value
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async add(storeName: string, value: any, key?: IDBValidKey): Promise<any> {
    return await this._basicTransactionHandler(
      storeName,
      BasicTransactionActions.ADD,
      'readwrite',
      value,
      key,
    );
  }

  /**
   * Get data from object store
   *
   * If data is not exist, returns `null`
   *
   * @param storeName object store name for open transaction
   * @param key idb object store keyPath value
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async get(storeName: string, key: any): Promise<any> {
    return await this._basicTransactionHandler(
      storeName,
      BasicTransactionActions.GET,
      'readonly',
      key,
    ).then((data) => data || null);
  }

  drop(storeName: string): void {
    if (!this._init) {
      this._unregistModel(storeName);
    } else {
      throw new BoxDBError('Can not drop model after opened');
    }
  }
}

export default BoxDB;
