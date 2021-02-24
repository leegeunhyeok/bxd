import BoxTransaction from './transaction';
import { TransactionMode, TransactionTask, TransactionType } from './task';
import { createModel } from './model';
import { BoxDBError } from './errors';
import {
  BoxScheme,
  BoxModel,
  ConfiguredBoxScheme,
  BoxDataTypes,
  BoxCursorDirections,
} from './types';

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

type ListenerMap = {
  [key in BoxDBEvent]: BoxDBEventListener[];
};
type BoxDBEvent = 'versionchange' | 'error' | 'abort' | 'close';
type BoxDBEventListener = (event: Event) => void;

export type BoxDBType = typeof BoxDB;
class BoxDB {
  public static Types = BoxDataTypes;
  public static Order = BoxCursorDirections;
  private _ready = false;
  private _databaseName: string;
  private _version: number;
  private _modelVersionMap: ModelMap = {};
  private _modelVersionIndex: ModelIndex = {};
  private _preparedModel: BoxModel<BoxScheme>[] = [];
  private _eventListener: ListenerMap = {
    versionchange: [],
    error: [],
    abort: [],
    close: [],
  };
  private _idb: IDBDatabase = null;
  private _tx: BoxTransaction = null;

  /**
   * @constructor
   * @param databaseName idb name
   * @param version idb version
   */
  constructor(databaseName: string, version: number) {
    if (typeof databaseName !== 'string') throw new BoxDBError('databaseName must be string');
    if (typeof version !== 'number') throw new BoxDBError('version must be number');
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

  /**
   * Get metadata of previous model (latest metadata)
   * and also check about dropped history
   *
   * @param baseVersion base idb version
   * @param storeName object store name
   */
  private _getPreviousModel(baseVersion: number, storeName: string): null | BoxModelMeta {
    const modelVersionIndex = this._modelVersionIndex[storeName];
    if (modelVersionIndex) {
      // Filter versions (< currentVersion)
      const filtedIndex = modelVersionIndex.filter((version) => version < baseVersion);

      // Get model metadata of last version
      // or if not exist, returns null
      if (filtedIndex.length) {
        const indexedVersion = filtedIndex[filtedIndex.length - 1];
        const previousModel = this._modelVersionMap[indexedVersion][storeName];

        // If previous model was dropped, returns null (need a create new one)
        return previousModel.action === BoxModelActionType.DROP ? null : previousModel;
      } else {
        return null;
      }
    } else {
      // If not exist model metadata in index, returns null
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

  /**
   * Check about object store name in target version
   *
   * @param targetVersion
   * @param storeName
   */
  private _isRegistered(targetVersion: number, storeName: string): boolean {
    const versionMap = this._modelVersionMap[targetVersion];
    return !!(versionMap && storeName in versionMap);
  }

  /**
   * Check about out-of-line key changes (autoIncrement)
   *
   * @param previousModel
   * @param options
   */
  private _outOfLineKeyChanged(previousModel: BoxModelMeta, options: BoxOption) {
    return previousModel && previousModel.autoIncrement !== !!options?.autoIncrement;
  }

  /**
   * Check about unique index
   *
   * @param scheme Model scheme
   */
  private _checkUniqueIndex<S extends BoxScheme>(scheme: S): void {
    // unique option must be with index option
    for (const config of Object.values(scheme)) {
      // Is ConfiguredType
      if (typeof config !== 'string') {
        // unique option must be with index option
        if (config.unique && !config.index) {
          throw new BoxDBError('unique option must with index option');
        }
      }
    }
  }

  /**
   * Model exist checking and regist new model scheme
   *
   * @param targetVersion target idb version
   * @param storeName object store name
   * @param scheme scheme object
   */
  private _registModel<S extends BoxScheme>(model: BoxModel<S>, options?: BoxOption): void {
    const targetVersion = model.prototype.__targetVersion__;
    const storeName = model.prototype.__storeName__;
    const scheme = model.prototype.__scheme__;

    // Assign new object literal if version map is not exist
    if (!this._modelVersionMap[targetVersion]) {
      this._modelVersionMap[targetVersion] = {};
    }

    // Get previous model and checking
    const previousModel = this._getPreviousModel(targetVersion, storeName);
    const indexList: BoxIndexConfig[] = [];
    let primaryKeyPath: string = null;

    // autoIncrement option changes not available
    if (this._outOfLineKeyChanged(previousModel, options)) {
      throw new BoxDBError(`Can not change out-of-line key of ${storeName}`);
    }

    // Check about unique index configs
    this._checkUniqueIndex(scheme);

    // Convert user scheme to ConfiguredBoxScheme
    const boxScheme = Object.entries(scheme).reduce((prev, [field, type]) => {
      // Is BoxDataTypes
      if (typeof type === 'string') {
        prev[field] = { type };
      } else {
        // Is ConfiguredType
        // If this field use to object store keyPath(primary key)
        if (type.key) {
          // Multiple in-line-key(object store keyPath) not available
          if (primaryKeyPath) {
            throw new BoxDBError(
              `Can not define multiple in-line-key in ${storeName} model. (exist: ${previousModel.keyPath})`,
            );
          }

          // Set this field name to in-line-key path
          primaryKeyPath = field;
        }

        // If this field is index
        if (type.index) {
          indexList.push({
            keyPath: field,
            unique: !!type.unique,
          });
        }

        prev[field] = type;
      }

      return prev;
    }, {} as ConfiguredBoxScheme);

    // Change keyPath not available
    if (previousModel && previousModel.keyPath !== primaryKeyPath) {
      throw new BoxDBError(
        `Can not change in-line-key of ${storeName} (exist: ${previousModel.keyPath})`,
      );
    }

    // Add model metadata to BoxDB instance
    this._addModel({
      name: storeName,
      scheme: boxScheme,
      keyPath: primaryKeyPath,
      autoIncrement: !!options?.autoIncrement,
      index: indexList,
      targetVersion,
      // Do update object store if previous model exist
      action: previousModel ? BoxModelActionType.UPDATE : BoxModelActionType.CREATE,
    });
    this._preparedModel.push(model);
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
    // Create object store
    const objectStore = openRequest.result.createObjectStore(boxMeta.name, {
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
    openRequest.result.deleteObjectStore(boxMeta.name);
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
   * Returns interrupt transaction task
   *
   * @param doInterrupt Do interrupt flag (default: true)
   */
  static interrupt(doInterrupt = true): TransactionTask {
    const transactionType =
      doInterrupt || doInterrupt === undefined ? TransactionType.INTERRUPT : TransactionType.NONE;
    return new TransactionTask(transactionType, '', TransactionMode.READ, []);
  }

  /**
   * Generate new model and register to model history
   *
   * @param targetVersion
   * @param storeName
   * @param scheme
   * @param options
   */
  private _modelRegister<S extends BoxScheme>(
    targetVersion: number,
    storeName: string,
    scheme: S,
    options?: BoxOption,
  ): BoxModel<S> {
    if (this._ready) {
      throw new BoxDBError('Database already opened');
    }

    if (this._isRegistered(targetVersion, storeName)) {
      throw new BoxDBError(`${storeName} model already registered in version: ${targetVersion}`);
    }

    const Model = createModel(targetVersion, storeName, scheme);

    /**
     * @static Model's static methods
     */
    Model.drop = (targetVersion) => this._drop(targetVersion, storeName);

    this._registModel(Model, options);

    return Model;
  }
  /**
   * Check about model is available (droped/updated)
   *
   * @param targetModel Target model
   */
  private _available<S extends BoxScheme>(targetModel: BoxModel<S>): boolean {
    const currentStoreIndex = this._modelVersionIndex[targetModel.prototype.__storeName__];
    return (
      currentStoreIndex[currentStoreIndex.length - 1] === targetModel.prototype.__targetVersion__
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

  /**
   * Create/update object stores and open idb
   */
  open(): Promise<Event> {
    return new Promise((resolve, reject) => {
      const openRequest = self.indexedDB.open(this._databaseName, this._version);

      // IDB Open successfully
      openRequest.onsuccess = (event) => {
        this._ready = true;
        this._idb = openRequest.result;
        this._tx = new BoxTransaction(this._idb);

        // Global event listener
        this._idb.onversionchange = (event) => {
          this._eventListener['versionchange'].forEach((f) => f(event));
        };
        this._idb.onabort = (event) => {
          this._eventListener['abort'].forEach((f) => f(event));
        };
        this._idb.onerror = (event) => {
          this._eventListener['error'].forEach((f) => f(event));
        };
        this._idb.onclose = (event) => {
          this._eventListener['close'].forEach((f) => f(event));
        };

        this._preparedModel.forEach((model) => {
          if (this._available(model)) {
            model.prototype.__tx__ = this._tx;
            model.prototype.__available__ = true;
          }
        });
        this._preparedModel = [];

        resolve(event);
      };

      openRequest.onupgradeneeded = (event) => this._update(openRequest, event);

      // Error occurs
      openRequest.onerror = (event) => reject(event);
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
      return this._modelRegister(targetVersion, storeName, scheme, options);
    };
  }

  /**
   * Add idb global event listener
   *
   * @param type BoxDBEvent
   * @param listener
   */
  on(type: BoxDBEvent, listener: BoxDBEventListener): void {
    this._eventListener[type].push(listener);
  }

  /**
   * Remove registed event listener
   *
   * @param type BoxDBEvent
   * @param listener
   */
  off(type: BoxDBEvent, listener: BoxDBEventListener): void {
    const listenerIdx = this._eventListener[type].indexOf(listener);
    if (~listenerIdx) return;
    this._eventListener[type].splice(listenerIdx, 1);
  }

  /**
   * Tasks are performed as transactions
   *
   * @param tasks Transaction tasks
   */
  transaction(tasks: TransactionTask[]): Promise<void> {
    if (tasks.every((task) => task instanceof TransactionTask)) {
      return this._tx.transaction(tasks).then(() => void 0);
    } else {
      throw new BoxDBError('Argument elements must be TransactionTask instance');
    }
  }
}

export default BoxDB;
