/* eslint-disable @typescript-eslint/no-explicit-any */
import { BoxDBError } from './errors';
import { TransactionTask, TransactionType, TransactionMode } from './task';
import {
  BoxScheme,
  BoxData,
  OptionalBoxData,
  CursorQuery,
  EvalFunction,
  CursorOptions,
} from './types';

type ObjectStoreKey = any;

interface IDBReference {
  value: IDBDatabase;
}

export default class BoxTransaction {
  private _idb: IDBReference = { value: null };

  /**
   * Recive idb instance reference
   *
   * @param idb IDBDatabase
   */
  init(idb: IDBDatabase): void {
    this._idb.value = idb;
  }

  getIDB(): IDBDatabase {
    if (this._idb.value) {
      return this._idb.value;
    } else {
      throw new BoxDBError('database not opened');
    }
  }

  /**
   * Fulfill multiple tasks on transaction
   *
   * @param tasks Transaction tasks
   */
  private _run(tasks: TransactionTask[]): Promise<any> {
    if (this._idb.value === null) {
      throw new BoxDBError('database not ready');
    }

    const needResponse =
      (tasks.length === 1 && tasks[0].action === TransactionType.GET) || TransactionType.CURSOR_GET;
    let res = null;

    // Get store names from tasks
    const storeNames = Object.keys(
      tasks
        .map((task) => task.storeName)
        .filter((name) => name)
        .reduce((set, curr) => {
          set[curr] = undefined; // Add key into object
          return set;
        }, {}),
    );

    // Check all tasks transaction mode
    const isReadonlyMode = tasks.every(
      (task) =>
        task.action === TransactionType.GET ||
        task.action === TransactionType.COUNT ||
        task.action === TransactionType.CURSOR_GET,
    );

    return new Promise((resolve, reject) => {
      // Open transaction
      const tx = this._idb.value.transaction(
        storeNames,
        isReadonlyMode ? TransactionMode.READ : TransactionMode.WRITE,
      );

      // Do each tasks
      // abort transaction if error occurs during task
      tasks.forEach((task) => {
        const { action, storeName, args } = task.valueOf();
        let objectStore: IDBObjectStore = null;

        if (action === TransactionType.INTERRUPT) {
          // interrupt manually
          tx.abort();
        } else if (
          action === TransactionType.CURSOR_GET ||
          action === TransactionType.CURSOR_UPDATE ||
          action === TransactionType.CURSOR_DELETE
        ) {
          objectStore = tx.objectStore(storeName);
          this._cursorTaskHelper(objectStore, task).then((records) => (res = records));
        } else {
          // get, add, put, delete, clear
          objectStore = tx.objectStore(storeName);
          const request = objectStore[action].call(objectStore, ...args) as IDBRequest;
          request.onsuccess = () => (res = request.result);
        }
      });

      const errorHandler = (event: Event) => {
        reject(tx.error || (event.target as IDBRequest).error);
      };

      // On complete
      tx.oncomplete = () => resolve(needResponse ? res : undefined);

      // On error / abort event will bubbled to idb
      tx.onerror = errorHandler;
    });
  }

  /**
   * Handling cursor task with helpers
   *
   * @param objectStore Target object store object
   * @param task Current task
   */
  private _cursorTaskHelper(objectStore: IDBObjectStore, task: TransactionTask): Promise<any[]> {
    const options = (task.args[0] || ({} as unknown)) as CursorOptions<any>;
    const filter = options.filter || null;
    const updateValue = options.updateValue;
    const res = [];

    // Filter function
    const pass = (() => {
      return Array.isArray(filter) ? (value) => filter.every((f) => f(value)) : () => true;
    })();

    let request: IDBRequest<IDBCursorWithValue> = null;
    if (filter && !Array.isArray(filter)) {
      // Use IDB CursorKey
      request = objectStore.index(filter.field).openCursor(filter.key, filter.direction || 'next');
    } else {
      // Use filter functions
      request = objectStore.openCursor();
    }

    return new Promise((resolve, reject) => {
      const cursorTaskRequestHandler = (request: IDBRequest) => {
        request.onerror = (event) => reject(event);
      };

      request.onsuccess = () => {
        const cursor = request.result;

        if (cursor) {
          const value = cursor.value;

          switch (task.action) {
            case TransactionType.CURSOR_GET:
              pass(value) && res.push(value);
              break;

            case TransactionType.CURSOR_UPDATE:
              pass(value) &&
                cursorTaskRequestHandler(
                  cursor.update({
                    ...value,
                    ...(updateValue ? updateValue : null),
                  }),
                );
              break;

            case TransactionType.CURSOR_DELETE:
              pass(value) && cursorTaskRequestHandler(cursor.delete());
              break;
          }

          cursor.continue();
        } else {
          resolve(res);
        }
      };
    });
  }

  /**
   * Get data from object store
   *
   * If data is not exist, returns `null`
   *
   * @param storeName object store name for open transaction
   * @param key idb object store keyPath value
   */
  get<S extends BoxScheme>(storeName: string, key: ObjectStoreKey): Promise<BoxData<S>> {
    return this._run([
      new TransactionTask(TransactionType.GET, storeName, TransactionMode.READ, [key]),
    ]).then((data) => data || null);
  }

  /**
   * Add new record into target object store
   *
   * @param storeName object store name for open transaction
   * @param value object to store
   * @param key optional key
   */
  add<S extends BoxScheme>(storeName: string, value: BoxData<S>, key?: IDBValidKey): Promise<void> {
    return this._run([
      new TransactionTask(TransactionType.ADD, storeName, TransactionMode.WRITE, [value, key]),
    ]);
  }

  /**
   * Update record or create new one to target object store
   *
   * @param storeName object store name for open transaction
   * @param value object to store
   * @param key optional key
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  put<S extends BoxScheme>(
    storeName: string,
    value: OptionalBoxData<S>,
    key?: IDBValidKey,
  ): Promise<void> {
    return this._run([
      new TransactionTask(TransactionType.PUT, storeName, TransactionMode.WRITE, [value, key]),
    ]);
  }

  /**
   * Delete data from object store
   *
   * @param storeName object store name for open transaction
   * @param key idb object store keyPath value
   */
  delete(storeName: string, key: ObjectStoreKey): Promise<void> {
    return this._run([
      new TransactionTask(TransactionType.DELETE, storeName, TransactionMode.WRITE, [key]),
    ]);
  }

  /**
   * Clear all records
   *
   * @param storeName object store name
   */
  clear(storeName: string): Promise<void> {
    return this._run([
      new TransactionTask(TransactionType.CLEAR, storeName, TransactionMode.WRITE, []),
    ]);
  }

  /**
   * Tasks in single transaction
   *
   * @param tasks transacktion tasks
   */
  transaction(tasks: TransactionTask[]): Promise<any> {
    return this._run(tasks);
  }

  /**
   *
   * @param transactionType transction type
   * @param storeName object store name
   * @param filter cursor filter
   * @param updateValue for update value (Only type = CURSOR_UPDATE)
   */
  cursor<T extends TransactionType, S extends BoxScheme>(
    transactionType: TransactionType,
    storeName: string,
    filter: CursorQuery<S> | EvalFunction<S>[],
    updateValue: OptionalBoxData<S>,
  ): Promise<T extends TransactionType.CURSOR_GET ? BoxData<S>[] : void> {
    return this.transaction([
      new TransactionTask(
        transactionType,
        storeName,
        transactionType === TransactionType.GET || TransactionType.CURSOR_GET
          ? TransactionMode.READ
          : TransactionMode.WRITE,
        [{ filter, updateValue }],
      ),
    ]);
  }
}
