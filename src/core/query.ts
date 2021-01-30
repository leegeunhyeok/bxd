/* eslint-disable @typescript-eslint/no-explicit-any */
import { BoxScheme, OptionalBoxData, CursorKey, CursorQuery, EvalFunction } from './types';
import { TransactionMode, TransactionTask, TransactionType } from './transaction';

type ObjectStoreKey = any;

export default class BoxQuery {
  constructor(private _idb: IDBDatabase) {}

  /**
   * Basic handler for object store single task
   * - Supports: `add`, `get`, `put`, `delete`, `clear`
   *
   * @param storeName target object store name
   * @param action object store transaction type
   * @param mode transaction mode
   * @param args transaction arguments
   */
  private _basicTransactionHandler(task: TransactionTask): Promise<any> {
    return new Promise((resolve, reject) => {
      const { action, storeName, mode, args } = task;
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
        const { action, storeName, args } = task.valueOf();
        const objectStore = tx.objectStore(storeName);
        const request = objectStore[action].call(objectStore, ...args) as IDBRequest;

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

  get(storeName: string, key: ObjectStoreKey): Promise<any> {
    return this._basicTransactionHandler(
      new TransactionTask(TransactionType.GET, storeName, TransactionMode.READ, [key]),
    );
  }

  add(storeName: string, value: ObjectStoreKey, key?: IDBValidKey): Promise<any> {
    return this._basicTransactionHandler(
      new TransactionTask(TransactionType.ADD, storeName, TransactionMode.WRITE, [value, key]),
    );
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  put(storeName: string, value: any, key?: IDBValidKey): Promise<void> {
    return this._basicTransactionHandler(
      new TransactionTask(TransactionType.PUT, storeName, TransactionMode.WRITE, [value, key]),
    );
  }

  delete(storeName: string, key: ObjectStoreKey): Promise<void> {
    return this._basicTransactionHandler(
      new TransactionTask(TransactionType.DELETE, storeName, TransactionMode.WRITE, [key]),
    );
  }

  transaction(tasks: TransactionTask[]): Promise<void> {
    return this._taskTransactionHandler(tasks);
  }

  cursor<S extends BoxScheme>(
    transactionType: TransactionType,
    storeName: string,
    filter: CursorQuery<S> | EvalFunction<S>[],
    updateValue: OptionalBoxData<S>,
  ): Promise<any> {
    // Filter function
    const pass = (value: any) => {
      if (Array.isArray(filter)) {
        return filter.every((f) => f(value));
      } else {
        return true;
      }
    };

    const query: { index: string; value: CursorKey } = {
      index: null,
      value: null,
    };

    if (!Array.isArray(filter)) {
      query.index = Object.keys(filter)[0];
      query.value = filter[query.index];
    }

    return new Promise((resolve, reject) => {
      const tx = this._idb.transaction(storeName, 'readonly'); // TODO: From args
      const objectStore = tx.objectStore(storeName);
      const res = [];

      let request: IDBRequest<IDBCursorWithValue> = null;
      if (query.index) {
        request = objectStore.index(query.index).openCursor(query.value);
      } else {
        request = objectStore.openCursor();
      }

      request.onsuccess = () => {
        const cursor = request.result;

        if (cursor) {
          const value = cursor.value;

          switch (transactionType) {
            case TransactionType.GET:
              pass(value) && res.push(value);
              break;

            case TransactionType.PUT:
              pass(value) &&
                cursor.update({
                  ...value,
                  ...(updateValue ? updateValue : null),
                });
              break;

            case TransactionType.DELETE:
              pass(value) && cursor.delete();
              break;
          }

          cursor.continue();
        }
      };

      // On complete
      tx.oncomplete = () => resolve(transactionType === TransactionType.GET ? res : void null);

      // On error
      tx.onerror = () => reject(tx.error || request.error);
    });
  }
}
