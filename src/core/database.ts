/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types, BoxScheme, ConfiguredBoxScheme, BoxModel, generateModel } from './model';
import { BoxDBError } from './errors';
import getTaskMapper, { TransactionTask } from './task';

export interface BoxOption {
  autoIncrement?: boolean;
}

export type BoxModelRegister = <S extends BoxScheme>(
  storeName: string,
  scheme: S,
  options?: BoxOption,
) => BoxModel<S>;

interface ModelMap {
  [version: number]: {
    [objectStoreName: string]: BoxModelMeta;
  };
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
interface ModelIndex {
  [objectStoreName: string]: number[];
}

interface BoxIndexConfig {
  keyPath: string;
  unique: boolean;
}

enum BoxModelActionType {
  CREATE,
  DROP,
  UPDATE,
}

enum BasicTransactionAction {
  ADD = 'add',
  GET = 'get',
  PUT = 'put',
  DELETE = 'delete',
  CLEAR = 'clear',
}

class BoxDB {
  public static Types = Types;
  private _ready = false;
  private _databaseName: string;
  private _version: number;
  private _modelVersionMap: ModelMap = {};
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
    return this._ready;
  }

  private _isPrepared() {
    if (!this._ready) throw new BoxDBError('BoxDB not ready');
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
      // Filter versions (< currentVersion)
      const filtedIndex = modelVersionIndex.filter((version) => version < baseVersion);

      // Get last version's model metadata
      // or if not exist, returns null
      if (filtedIndex.length) {
        const indexedVersion = filtedIndex[filtedIndex.length - 1];
        const previousModel = this._modelVersionMap[indexedVersion][storeName];

        // If model was dropped, returns null (need a create new one)
        return previousModel.action === BoxModelActionType.DROP ? null : previousModel;
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
    this._modelVersionMap[targetVersion][name] = modelMeta;

    // If not exist model version index array, create new one
    if (!this._modelVersionIndex[name]) {
      this._modelVersionIndex[name] = [];
    }
    this._modelVersionIndex[name].push(targetVersion);
    this._modelVersionIndex[name].sort((a, b) => a - b);
  }

  private _isRegistered(targetVersion: number, storeName: string): boolean {
    const versionMap = this._modelVersionMap[targetVersion];
    return !!(versionMap && storeName in versionMap);
  }

  /**
   * Model exist checking and regist new model scheme
   *
   * @param targetVersion target idb version
   * @param storeName object store name
   * @param scheme scheme object
   */
  private _registModel<S extends BoxScheme>(model: BoxModel<S>, options?: BoxOption): void {
    if (this._ready) {
      throw new BoxDBError('database already opened');
    }

    const targetVersion = model.prototype.__targetVersion__;
    const storeName = model.prototype.__storeName__;
    const scheme = model.prototype.__scheme__;

    // Assign new object literal if version map is not exist
    if (!this._modelVersionMap[targetVersion]) {
      this._modelVersionMap[targetVersion] = {};
    }

    let primaryKeyPath: string = null;
    const previousModel = this._getPreviousModel(targetVersion, storeName);
    const indexList: BoxIndexConfig[] = [];

    // Change autoIncrement option not available
    if (previousModel && previousModel.autoIncrement !== !!options?.autoIncrement) {
      throw new BoxDBError(`Can not change ${storeName} model's autoIncrement option`);
    }

    const boxScheme = Object.entries(scheme).reduce((prev, [k, v]) => {
      if (typeof v === 'string') {
        prev[k] = { type: v };
      } else {
        // If this field use to object store keyPath(primary key)
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
   * @param targetVersion Target version
   * @param storeName Object store name for unregistration
   */
  private _unregistModel(targetVersion: number, storeName: string) {
    const dropped = Object.keys(this._modelVersionMap)
      .map((version) => parseInt(version))
      .filter((version) => targetVersion >= version)
      .sort((a, b) => a - b)
      .some((filteredVersion) => {
        const targetVersionModels = this._modelVersionMap[filteredVersion];
        if (storeName in targetVersionModels) {
          // Add new metadata into targetVersion map
          this._modelVersionMap[targetVersion][storeName] = {
            ...targetVersionModels[storeName],
            targetVersion,
            action: BoxModelActionType.DROP,
          };

          // Remove all of previous versions from index (<= targetVersion)
          this._modelVersionIndex[storeName] = this._modelVersionIndex[storeName]
            .filter((version) => version > targetVersion)
            .sort((a, b) => a - b);

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
    Object.keys(this._modelVersionMap)
      .map((k) => parseInt(k)) // Version keys to integer
      .filter((version) => version <= this._version) // Filtering (<= Current idb version)
      .sort((a, b) => a - b) // Sort by ascending
      .forEach((targetVersion) => {
        // Get target version models
        const currentVersionModels = this._modelVersionMap[targetVersion];

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
   * Basic handler for object store single task
   * - Supports: `add`, `get`, `put`, `delete`, `clear`
   *
   * @param storeName target object store name
   * @param action object store transaction type
   * @param mode transaction mode
   * @param args transaction arguments
   */
  private _basicTransactionHandler(
    storeName: string,
    action: BasicTransactionAction,
    mode: IDBTransactionMode,
    ...args: any[]
  ): Promise<any> {
    this._isPrepared();

    return new Promise((resolve, reject) => {
      const tx = this._idb.transaction(storeName, mode);
      const objectStore = tx.objectStore(storeName);
      const request = objectStore[action].call(objectStore, ...args) as IDBRequest;

      // On complete
      tx.oncomplete = () => resolve(request.result);

      // On error
      tx.onerror = () => reject(tx.error || request.error);
    });
  }

  /**
   * Fulfill multiple tasks on transaction
   *
   * @param tasks Transaction tasks
   */
  private _taskTransactionHandler(tasks: TransactionTask[]): Promise<void> {
    this._isPrepared();

    // Get store names from tasks
    const storeNames = Object.keys(
      tasks
        .map((task) => task.storeName)
        .reduce((set, curr) => {
          set[curr] = undefined || set;
          return set;
        }, {}),
    );

    return new Promise((resolve, reject) => {
      // Open transaction
      const tx = this._idb.transaction(storeNames, 'readwrite');

      // Do each tasks
      tasks.forEach((task) => {
        const { type, storeName, args } = task.valueOf();
        const objectStore = tx.objectStore(storeName);
        const request = objectStore[type].call(objectStore, ...args) as IDBRequest;

        // Abort transaction if error occurs during task
        request.onerror = () => tx.abort();
      });

      const errorHandler = (event: Event) => {
        reject(tx.error || (event.target as IDBRequest).error);
      };

      // On complete
      tx.oncomplete = () => resolve();

      // On abord & error
      tx.onabort = errorHandler;
      tx.onerror = errorHandler;
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
      options?: BoxOption,
    ): BoxModel<S> => {
      if (this._isRegistered(targetVersion, storeName)) {
        throw new BoxDBError(`${storeName} model already registered in version: ${targetVersion}`);
      }
      const Model = generateModel(targetVersion, storeName, scheme);

      /**
       * @static Model's static methods
       */
      Model.add = (value, key) => this._mustAvailable(Model) && this._add(storeName, value, key);
      Model.get = (key) => this._mustAvailable(Model) && this._get(storeName, key);
      Model.put = (value, key) => this._mustAvailable(Model) && this._put(storeName, value, key);
      Model.drop = (targetVersion) => this._drop(targetVersion, storeName);
      Model.task = getTaskMapper(storeName);

      this._registModel(Model, options);

      return Model;
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
        this._ready = true;
        this._idb = openRequest.result;
        resolve(event);
      };

      openRequest.onupgradeneeded = (event) => this._update(openRequest, event);

      // Error occurs
      openRequest.onerror = (event) => reject(event);
    });
  }

  async transaction(tasks: TransactionTask[]): Promise<void> {
    if (!tasks.every((task) => task instanceof TransactionTask)) {
      throw new BoxDBError('transaction() tasks must be TransactionTask instance');
    }
    return this._taskTransactionHandler(tasks);
  }

  /**
   * Check about model is available (droped/updated)
   *
   * @param targetModel Target model
   */
  available<S extends BoxScheme>(targetModel: BoxModel<S>): boolean {
    const currentStoreIndex = this._modelVersionIndex[targetModel.prototype.__storeName__];
    return (
      currentStoreIndex[currentStoreIndex.length - 1] === targetModel.prototype.__targetVersion__
    );
  }

  /**
   * Target model must be available.
   * If not available, throws exception
   *
   * @param targetModel Target model
   */
  private _mustAvailable<S extends BoxScheme>(targetModel: BoxModel<S>): true | never {
    if (!this.available(targetModel)) throw new BoxDBError('This model is not available');
    return true;
  }

  /**
   * Add new record into target object store
   *
   * @param storeName object store name for open transaction
   * @param value object to store
   * @param key optional key
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  private async _add(storeName: string, value: any, key?: IDBValidKey): Promise<any> {
    return await this._basicTransactionHandler(
      storeName,
      BasicTransactionAction.ADD,
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
  private async _get(storeName: string, key: any): Promise<any> {
    return await this._basicTransactionHandler(
      storeName,
      BasicTransactionAction.GET,
      'readonly',
      key,
    ).then((data) => data || null);
  }

  /**
   * Update record or create new one to target object store
   *
   * @param storeName object store name for open transaction
   * @param value object to store
   * @param key optional key
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  private async _put(storeName: string, value: any, key?: IDBValidKey): Promise<any> {
    return await this._basicTransactionHandler(
      storeName,
      BasicTransactionAction.PUT,
      'readwrite',
      value,
      key,
    );
  }

  /**
   * Register drop object store task
   *
   * @param targetVersion Target version of object store
   * @param storeName Object store name to delete
   */
  private _drop(targetVersion: number, storeName: string): void {
    if (this._ready) {
      throw new BoxDBError('Can not drop model after open()');
    } else {
      this._unregistModel(targetVersion, storeName);
    }
  }
}

export default BoxDB;
