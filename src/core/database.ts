import BoxTransaction from './transaction';
import BoxModelBuilder, { rangeBuilder } from './model';
import { TransactionTask, TransactionType } from './task';
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
import { BoxDBError } from './errors';

export interface BoxModelOption {
  autoIncrement?: boolean;
  force?: boolean;
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
export type BoxDBEvent = 'versionchange' | 'error' | 'abort' | 'close';
export type BoxDBEventListener = (event: Event) => void;

export type BoxDBType = typeof BoxDB;
class BoxDB {
  public static Types = BoxDataTypes;
  public static Order = BoxCursorDirections;
  public static Range = rangeBuilder;
  private _ready = false;
  private _name: string;
  private _version: number;
  private _boxMetaMap: BoxMetaMap = {};
  private _events: ListenerMap = {
    versionchange: [],
    error: [],
    abort: [],
    close: [],
  };
  private _idb: IDBDatabase = null;
  private _tx: BoxTransaction;
  private _model: BoxModelBuilder;

  /**
   * @constructor
   * @param databaseName idb name
   * @param version idb version
   */
  constructor(databaseName: string, version: number) {
    if (typeof databaseName !== 'string') throw new BoxDBError('databaseName must be string');
    if (typeof version !== 'number') throw new BoxDBError('version must be number');
    this._name = databaseName;
    this._version = version;
    this._tx = new BoxTransaction();
    this._model = BoxModelBuilder.get(this._tx);
  }

  get idb(): IDBDatabase {
    return this._idb;
  }

  get name(): string {
    return this._name;
  }

  get version(): number {
    return this._version;
  }

  get ready(): boolean {
    return this._ready;
  }

  /**
   * Returns interrupt transaction task
   */
  static interrupt(): TransactionTask {
    return new TransactionTask(TransactionType.INTERRUPT, null, null);
  }

  /**
   * Create/update object stores and open idb
   */
  open(): Promise<Event> {
    return new Promise((resolve, reject) => {
      const openRequest = self.indexedDB.open(this._name, this._version);
      const close = () => {
        openRequest.result && openRequest.result.close();
      };

      // IDB Open successfully
      openRequest.onsuccess = (event) => {
        this._ready = true;
        this._idb = openRequest.result;
        this._tx.init(openRequest.result);

        // IDB event listener
        this._idb.onversionchange = (event) => {
          this._events['versionchange'].forEach((f) => f(event));
        };
        this._idb.onabort = (event) => {
          this._events['abort'].forEach((f) => f(event));
        };
        this._idb.onerror = (event) => {
          this._events['error'].forEach((f) => f(event));
        };
        this._idb.onclose = (event) => {
          this._events['close'].forEach((f) => f(event));
        };
        resolve(event);
      };

      openRequest.onupgradeneeded = () => {
        try {
          this._update(openRequest);
        } catch (e) {
          close();
          reject(e);
        }
      };

      openRequest.onblocked = () => {
        reject(new BoxDBError('Can not upgrade database because the database is already opened'));
      };
      openRequest.onerror = (event) => {
        close();
        reject(event);
      };
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
      throw new BoxDBError('Can not define model after database opened');
    }

    if (this._boxMetaMap[storeName]) {
      throw new BoxDBError(`${storeName} model already defined`);
    } else {
      this._boxMetaMap[storeName] = this._convert(storeName, scheme, options);
    }

    return this._model.build(this._version, storeName, scheme);
  }

  /**
   * Returns model names on this database
   *
   * @returns Registred model names (object store names)
   */
  modelNames(): string[] {
    return Object.keys(this._boxMetaMap);
  }

  /**
   * Add idb global event listener
   *
   * @param type BoxDBEvent
   * @param listener
   */
  on(type: BoxDBEvent, listener: BoxDBEventListener): void {
    this._events[type].push(listener);
  }

  /**
   * Remove registed event listener
   *
   * @param type BoxDBEvent
   * @param listener
   */
  off(type: BoxDBEvent, listener: BoxDBEventListener): void {
    const listenerIdx = this._events[type].indexOf(listener);
    if (~listenerIdx) return;
    this._events[type].splice(listenerIdx, 1);
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
      throw new BoxDBError('Tasks must be TransactionTask');
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this._ready) {
      this._tx.close();
      this._idb.close();
      this._ready = false;
    } else {
      throw new BoxDBError('database not ready');
    }
  }

  /**
   * Create BoxModelMeta object
   *
   * @param name
   * @param scheme
   * @param keyPath
   * @param autoIncrement
   * @param index
   * @param force
   * @returns
   */
  private _meta(
    name: string,
    scheme: ConfiguredBoxScheme,
    keyPath: string,
    autoIncrement: boolean,
    index: BoxIndexConfig[],
    force: boolean,
  ): BoxModelMeta {
    return { name, scheme, keyPath, autoIncrement, index, force };
  }

  /**
   * IDBObjectStore to BoxModelMeta
   *
   * @param objectStore target object store
   */
  private _toMeta(objectStore: IDBObjectStore): BoxModelMeta {
    return this._meta(
      objectStore.name,
      null,
      Array.isArray(objectStore.keyPath) ? objectStore.keyPath[0] : objectStore.keyPath,
      objectStore.autoIncrement,
      Array.from(objectStore.indexNames).map((name) => {
        const idx = objectStore.index(name);
        return { keyPath: idx.keyPath, unique: idx.unique } as BoxIndexConfig;
      }),
      false,
    );
  }

  /**
   * Convert model scheme object to BoxModelMeta
   *
   * @param storeName object store name
   * @param scheme model scheme
   */
  private _convert(storeName: string, scheme: BoxScheme, options?: BoxOption): BoxModelMeta {
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
          throw new BoxDBError('unique option requires index option');
        }

        // If this field configured for using index
        type.index && indexList.push({ keyPath: field, unique: Boolean(type.unique) });
        prev[field] = type;
      }

      return prev;
    }, {} as ConfiguredBoxScheme);

    return this._meta(
      storeName,
      configuredScheme,
      primaryKeyPath,
      Boolean(options?.autoIncrement),
      indexList,
      Boolean(options?.force),
    );
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
    // Object store names in IDB
    const objectStoreNames = Array.from(db.objectStoreNames);
    // defined model(object store) names
    const modelStoreNames = Object.keys(this._boxMetaMap);
    // Helper function that get metadata of defined model
    const getBoxMeta = (name: string) => this._boxMetaMap[name];

    objectStoreNames.forEach((name, idx) => {
      // Update exist object store
      if (modelStoreNames.includes(name)) {
        const { keyPath, autoIncrement, index, force } = getBoxMeta(name);
        const objectStore = tx.objectStore(name);
        const objectStoreMeta = this._toMeta(objectStore);

        // Delete exist object store
        if (force) {
          db.deleteObjectStore(name);
          objectStoreNames.splice(idx, 1); // This object store will be created
          return;
        }

        if (objectStoreMeta.keyPath !== keyPath) {
          throw new BoxDBError(
            `Can not change in-line-key of ${name} (key: ${objectStoreMeta.keyPath})`,
          );
        }

        if (objectStoreMeta.autoIncrement !== autoIncrement) {
          throw new BoxDBError(`Can not change out-of-line key of ${name}`);
        }

        // Update indexes
        const getKeyPath = (indexConfig) => indexConfig.keyPath;
        const idbKeyPaths = objectStoreMeta.index.map(getKeyPath);
        const modelKeyPaths = index.map(getKeyPath);

        // (1/3) Update unique option of index
        objectStoreMeta.index.forEach((objectStoreIndex) => {
          const modelIndex = index.find(({ keyPath }) => keyPath === objectStoreIndex.keyPath);
          const originKeyPath = objectStoreIndex.keyPath;

          // Index option updated
          if (modelIndex && objectStoreIndex.unique !== modelIndex.unique) {
            // Change unique option true -> false is available
            if (objectStoreIndex.unique === true) {
              // Delete exist index and re-create
              objectStore.deleteIndex(originKeyPath);
              objectStore.createIndex(originKeyPath, originKeyPath, {
                unique: modelIndex.unique,
              });
            } else {
              throw new BoxDBError(
                `Can not change unique option to true (field: ${originKeyPath})`,
              );
            }
          }
        });

        // (2/3) Delete index if index not found in scheme of target model
        idbKeyPaths.forEach((keyPath) => {
          !modelKeyPaths.includes(keyPath) && objectStore.deleteIndex(keyPath);
        });

        // (3/3) Create new index if index not exist in object store
        index.forEach(({ keyPath, unique }) => {
          !idbKeyPaths.includes(keyPath) && objectStore.createIndex(keyPath, keyPath, { unique });
        });
      } else {
        // Delete object store (model not defined)
        db.deleteObjectStore(name);
      }
    });

    // Create new object stores
    modelStoreNames
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
}

export default BoxDB;
