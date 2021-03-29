import BoxTransaction from './transaction';
import { TransactionMode, TransactionTask, TransactionType } from './task';
import { createModel } from './model';
import { BoxDBError } from './errors';
import {
  BoxScheme,
  BoxDataTypes,
  BoxOption,
  BoxModel,
  BoxModelMeta,
  BoxIndexConfig,
  ConfiguredBoxScheme,
  BoxCursorDirections,
} from './types';

export interface BoxModelOption {
  autoIncrement?: boolean;
}

export type BoxModelRegister = <S extends BoxScheme>(
  storeName: string,
  scheme: S,
  options?: BoxModelOption,
) => BoxModel<S>;

interface BoxMetaMap {
  [storeName: string]: BoxModelMeta;
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
  private _boxMetaMap: BoxMetaMap = {};
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
   * IDBObjectStore to BoxModelMeta
   *
   * @param objectStore target object store
   */
  private _objectStoreToModelMeta(objectStore: IDBObjectStore): BoxModelMeta {
    return {
      name: objectStore.name,
      scheme: null,
      // info: bxd supports only single in-line key
      keyPath: Array.isArray(objectStore.keyPath) ? objectStore.keyPath[0] : objectStore.keyPath,
      autoIncrement: objectStore.autoIncrement,
      index: Array.from(objectStore.indexNames).map((name) => {
        const idx = objectStore.index(name);
        return { keyPath: idx.keyPath, unique: idx.unique } as BoxIndexConfig;
      }),
      force: false,
    };
  }

  /**
   * Convert model scheme object to BoxModelMeta
   *
   * @param storeName object store name
   * @param scheme model scheme
   */
  private _toModelMeta(storeName: string, scheme: BoxScheme, options?: BoxOption): BoxModelMeta {
    let primaryKeyPath = null;
    const indexList = [];

    const configuredScheme = Object.entries(scheme).reduce((prev, [field, type]) => {
      // Is BoxDataTypes
      if (typeof type === 'string') {
        prev[field] = { type };
      } else {
        // Is ConfiguredType
        // If this field use as keyPath(in-line key) for object store
        if (type.key) {
          // info: not available multiple in-line-key in bxd
          if (primaryKeyPath) {
            throw new BoxDBError(`Can not define multiple in-line-key in ${storeName} model`);
          }

          // Set this field to in-line key
          primaryKeyPath = field;
        }

        if (type.unique && !type.index) {
          throw new BoxDBError('unique option must with index option');
        }

        // If this field configured for using index
        type.index && indexList.push({ keyPath: field, unique: Boolean(type.unique) });

        prev[field] = type;
      }

      return prev;
    }, {} as ConfiguredBoxScheme);

    return {
      name: storeName,
      scheme: configuredScheme,
      keyPath: primaryKeyPath,
      autoIncrement: Boolean(options?.autoIncrement),
      index: indexList,
      force: Boolean(options?.force),
    };
  }

  /**
   * Update defined object stores
   *
   * @param openRequest IDBOpenRequest
   * @param event Event from onupgradeneeded event
   */
  private _update(openRequest: IDBOpenDBRequest) {
    const db = openRequest.result;
    const tx = openRequest.transaction;
    // idb's object store names
    const objectStoreNames = Array.from(db.objectStoreNames);
    // defined model(object store) names
    const definedModelNames = Object.keys(this._boxMetaMap);
    // Helper function that get metadata of defined model
    const getBoxMeta = (name: string) => this._boxMetaMap[name];

    objectStoreNames.forEach((name) => {
      const { keyPath, autoIncrement, index } = getBoxMeta(name);
      const objectStore = tx.objectStore(name);

      if (definedModelNames.includes(name)) {
        // Update exist object store
        const existModelMeta = this._objectStoreToModelMeta(objectStore);

        if (existModelMeta.keyPath !== keyPath) {
          throw new BoxDBError(
            `Can not change in-line-key of ${name} (exist: ${existModelMeta.keyPath})`,
          );
        }

        if (existModelMeta.autoIncrement !== autoIncrement) {
          throw new BoxDBError(`Can not change out-of-line key of ${name}`);
        }

        // Update indexes
        const indexNameExtractor = (indexConfig) => indexConfig.keyPath;
        const existIndexNameList = existModelMeta.index.map(indexNameExtractor);
        const definedIndexNameList = index.map(indexNameExtractor);

        // Delete index if index not found in defined model's scheme
        existIndexNameList.forEach(
          (keyPath) => !definedIndexNameList.includes(keyPath) && objectStore.deleteIndex(keyPath),
        );

        // Create new index if not exist in exist object store
        index.forEach(
          ({ keyPath, unique }) =>
            !existIndexNameList.includes(keyPath) &&
            objectStore.createIndex(keyPath, keyPath, { unique }),
        );
      } else {
        // Delete object store (model not defined)
        db.deleteObjectStore(name);
      }
    });

    // Create new object stores
    definedModelNames
      .filter((name) => !objectStoreNames.includes(name))
      .forEach((name) => {
        const { keyPath, autoIncrement, index } = getBoxMeta(name);
        const objectStore = db.createObjectStore(name, {
          ...(keyPath ? { keyPath } : null),
          autoIncrement,
        });

        index.forEach(({ keyPath, unique }) =>
          objectStore.createIndex(keyPath, keyPath, { unique }),
        );
      });
  }

  /**
   * Returns interrupt transaction task
   */
  static interrupt(): TransactionTask {
    return new TransactionTask(TransactionType.INTERRUPT, null, TransactionMode.READ, null);
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

        // IDB event listener
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

        resolve(event);
      };

      openRequest.onupgradeneeded = () => this._update(openRequest);

      // Error occurs
      openRequest.onerror = (event) => reject(event);
    });
  }

  /**
   * Define box model
   *
   * @param storeName
   * @param scheme
   * @param options
   */
  model<S extends BoxScheme>(storeName: string, scheme: S, options?: BoxModelOption): BoxModel<S> {
    if (this._ready) {
      throw new BoxDBError('Cannot define model after database opened');
    }

    if (this._boxMetaMap[storeName]) {
      throw new BoxDBError(`${storeName} model already defined`);
    } else {
      this._boxMetaMap[storeName] = this._toModelMeta(storeName, scheme, options);
    }

    return createModel(this._version, storeName, scheme);
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
