import Database, { ModelOption } from '../types/database';
import BoxBuilder, { Box, rangeBuilder } from './box';
import BoxTransaction, { BoxTask, CursorDirection } from './transaction';
import { toBoxMeta, createTask } from '../utils';
import { BoxDBError } from './errors';
import { Schema, ConfiguredSchema, DataType, TransactionType } from '../types';

export interface BoxOption extends ModelOption {
  autoIncrement?: boolean;
  force?: boolean;
}

export type BoxIndexConfig = {
  keyPath: string;
  unique: boolean;
};

export type BoxMeta = {
  name: string;
  schema: ConfiguredSchema | null;
  inKey: string | null;
  outKey: boolean;
  index: BoxIndexConfig[];
  force: boolean;
};

interface BoxMetaMap {
  [storeName: string]: BoxMeta;
}

export default class BoxDB extends Database<IDBDatabase> {
  public static Types = DataType;
  public static Order = CursorDirection;
  public static Range = rangeBuilder;
  public db: IDBDatabase | null = null;
  public tx: BoxTransaction;
  public ready = false;
  public name: string;
  public version: number;
  private meta: BoxMetaMap = {};
  private builder: BoxBuilder;

  /**
   * @constructor
   * @param databaseName IDB name
   * @param version IDB version
   */
  constructor(databaseName: string, version: number) {
    super();
    this.name = databaseName;
    this.version = version;
    this.tx = new BoxTransaction();
    this.builder = new BoxBuilder(this.tx);
  }

  getDB(): IDBDatabase | null {
    return this.db;
  }

  getName(): string {
    return this.name;
  }

  getVersion(): number {
    return this.version;
  }

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Returns interrupt task for abort transaction
   */
  static interrupt(): BoxTask {
    return createTask(TransactionType.INTERRUPT, ''); // empty object store name
  }

  /**
   * Create/update object stores and open IDB
   */
  open(): Promise<Event> {
    return new Promise((resolve, reject) => {
      const openRequest = self.indexedDB.open(this.name, this.version);
      const close = () => {
        openRequest.result && openRequest.result.close();
      };

      openRequest.onsuccess = (event) => {
        this.ready = true;
        this.db = openRequest.result;
        this.tx.init(openRequest.result);
        resolve(event);
      };

      openRequest.onupgradeneeded = () => {
        try {
          this.update(openRequest);
        } catch (e) {
          close();
          reject(e);
        }
      };

      openRequest.onblocked = () => {
        reject(new BoxDBError('Can not upgrade because the database is already opened'));
      };
      openRequest.onerror = (event) => {
        close();
        reject(event);
      };
    });
  }

  /**
   * Create new box (model)
   *
   * @param storeName object store name
   * @param schema model schema
   * @param options box options
   */
  box<S extends Schema>(storeName: string, schema: S, option?: BoxOption): Box<S> {
    if (this.ready) {
      throw new BoxDBError('Cannot define box after database opened');
    }

    if (!option?.force && this.meta[storeName]) {
      throw new BoxDBError(storeName + ' box already defined');
    }

    this.meta[storeName] = this.toMeta(storeName, schema, option);
    return this.builder.build(this.version, storeName, schema);
  }

  /**
   * Execute mutiple tasks in single transaction
   *
   * @param tasks Transaction tasks
   */
  transaction(...tasks: BoxTask[]): Promise<void> {
    return this.tx.run(...tasks).then(() => void 0);
  }

  /**
   * Close database connection
   */
  close(): void {
    if (!this.ready || !this.db) {
      throw new BoxDBError('Database not ready');
    }
    this.tx.close();
    this.db.close();
    this.ready = false;
  }

  /**
   * Box schema object convert to BoxMeta
   *
   * @param storeName object store name
   * @param schema box schema
   * @param options box option
   */
  private toMeta(storeName: string, schema: Schema, options?: BoxOption): BoxMeta {
    let primaryKeyPath: string | null = null;
    const indexList: { keyPath: string; unique: boolean }[] = [];

    const configuredSchema = Object.entries(schema).reduce((prev, [field, type]) => {
      // Is BoxDataTypes
      if (typeof type === 'string') {
        prev[field] = { type };
      } else {
        // Is ConfiguredType
        // If this field use as keyPath(in-line key) for object store
        if (type.key && primaryKeyPath) {
          // info: not available multiple in-line-key in bxd
          throw new BoxDBError('Cannot define mutiple in-line-key: ' + storeName);
        }

        // Set this field as in-line-key
        type.key && (primaryKeyPath = field);

        if (type.unique && !type.index) {
          throw new BoxDBError('unique option requires index option');
        }

        // If this field configured for using index
        type.index && indexList.push({ keyPath: field, unique: !!type.unique });
        prev[field] = type;
      }

      return prev;
    }, {} as ConfiguredSchema);

    return toBoxMeta({
      name: storeName,
      schema: configuredSchema,
      inKey: primaryKeyPath,
      outKey: !!options?.autoIncrement,
      index: indexList,
      force: !!options?.force,
    });
  }

  /**
   * Update object stores
   *
   * @param openRequest IDBOpenRequest
   */
  private update(openRequest: IDBOpenDBRequest) {
    const db = openRequest.result;
    const tx = openRequest.transaction;

    /* istanbul ignore next */
    if (!tx) return;

    // Object store names in IDB
    const objectStoreNames = Array.from(db.objectStoreNames);
    // defined box(object store) names
    const boxStoreNames = Object.keys(this.meta);
    // Helper function that get metadata of defined box
    const getBoxMeta = (name: string) => this.meta[name];

    objectStoreNames.forEach((name, idx) => {
      // Update exist object store
      if (boxStoreNames.includes(name)) {
        const { inKey, outKey, index, force } = getBoxMeta(name);
        const objectStore = tx.objectStore(name);
        const objectStoreMeta = toBoxMeta({
          name: objectStore.name,
          inKey: objectStore.keyPath as string, // assertion (origin: string[] | string)
          outKey: objectStore.autoIncrement,
          index: Array.from(objectStore.indexNames).map((name) => {
            const idx = objectStore.index(name);
            return { keyPath: idx.keyPath, unique: idx.unique } as BoxIndexConfig;
          }),
        });

        // Delete exist object store
        if (force) {
          db.deleteObjectStore(name);
          objectStoreNames.splice(idx, 1); // This object store will be created
          return;
        }

        if (objectStoreMeta.inKey !== inKey) {
          throw new BoxDBError('In-line-key cannot be changed: ' + name);
        }

        if (objectStoreMeta.outKey !== outKey) {
          throw new BoxDBError('Out-of-line-key cannot be changed: ' + name);
        }

        // Update indexes
        const getKeyPath = (indexConfig) => indexConfig.keyPath;
        const idbKeyPaths = objectStoreMeta.index.map(getKeyPath);
        const boxKeyPaths = index.map(getKeyPath);

        // (1/3) Update unique option of index
        objectStoreMeta.index.forEach((objectStoreIndex) => {
          const boxIndex = index.find(({ keyPath }) => keyPath === objectStoreIndex.keyPath);
          const originKeyPath = objectStoreIndex.keyPath;

          // Index option updated
          if (boxIndex && objectStoreIndex.unique !== boxIndex.unique) {
            // Change unique option true -> false is available
            if (objectStoreIndex.unique === true) {
              // Delete exist index and re-create without unique option
              objectStore.deleteIndex(originKeyPath);
              objectStore.createIndex(originKeyPath, originKeyPath);
            } else {
              throw new BoxDBError('unique option cannot be changed to true: ' + originKeyPath);
            }
          }
        });

        // (2/3) Delete index if index not found in schema
        idbKeyPaths.forEach((keyPath) => {
          !boxKeyPaths.includes(keyPath) && objectStore.deleteIndex(keyPath);
        });

        // (3/3) Create new index if index not exist in object store
        index.forEach(({ keyPath, unique }) => {
          !idbKeyPaths.includes(keyPath) && objectStore.createIndex(keyPath, keyPath, { unique });
        });
      } else {
        // Delete object store (box not defined)
        db.deleteObjectStore(name);
      }
    });

    // Create new object stores
    boxStoreNames
      .filter((name) => !objectStoreNames.includes(name))
      .forEach((name) => {
        const { inKey, outKey, index } = getBoxMeta(name);
        const objectStore = db.createObjectStore(name, {
          ...(inKey ? { keyPath: inKey } : null),
          autoIncrement: outKey,
        });

        index.forEach(({ keyPath, unique }) =>
          objectStore.createIndex(keyPath, keyPath, { unique }),
        );
      });
  }
}
