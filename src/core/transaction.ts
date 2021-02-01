/* eslint-disable @typescript-eslint/no-explicit-any */
import { TransactionTask, TransactionType, TransactionMode } from './task';
import {
  BoxScheme,
  OptionalBoxData,
  CursorKey,
  CursorQuery,
  EvalFunction,
  CursorOptions,
} from './types';

type ObjectStoreKey = any;

export default class BoxTransaction {
  constructor(private _idb: IDBDatabase) {}

  /**
   * Fulfill multiple tasks on transaction
   *
   * @param tasks Transaction tasks
   */
  private _taskTransactionHandler(tasks: TransactionTask[]): Promise<any> {
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

    // Check transaction mode
    const isReadonlyMode = tasks.every(
      (task) =>
        task.action === TransactionType.GET ||
        task.action === TransactionType.COUNT ||
        task.action === TransactionType.CURSOR_GET,
    );

    return new Promise((resolve, reject) => {
      // Open transaction
      const tx = this._idb.transaction(
        storeNames,
        isReadonlyMode ? TransactionMode.READ : TransactionMode.WRITE,
      );
      let rejected = false;

      // Do each tasks
      // abort transaction if error occurs during task
      tasks.forEach((task) => {
        const { action, storeName, args } = task.valueOf();
        let objectStore: IDBObjectStore = null;

        if (action === TransactionType.NONE) {
          // do nothing
          return;
        } else if (action === TransactionType.INTERRUPT) {
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
          objectStore = tx.objectStore(storeName);
          const request = objectStore[action].call(objectStore, ...args) as IDBRequest;
          request.onsuccess = () => (res = request.result);
        }
      });

      const errorHandler = (event: Event) => {
        if (!rejected) {
          rejected = true;
          reject(tx.error || (event.target as IDBRequest).error);
        }
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

    if (filter && !Array.isArray(filter)) {
      query.index = Object.keys(filter)[0];
      query.value = filter[query.index];
    }

    let request: IDBRequest<IDBCursorWithValue> = null;
    if (query.index) {
      request = objectStore.index(query.index).openCursor(query.value);
    } else {
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

  get(storeName: string, key: ObjectStoreKey): Promise<any> {
    return this._taskTransactionHandler([
      new TransactionTask(TransactionType.GET, storeName, TransactionMode.READ, [key]),
    ]);
  }

  add(storeName: string, value: ObjectStoreKey, key?: IDBValidKey): Promise<void> {
    return this._taskTransactionHandler([
      new TransactionTask(TransactionType.ADD, storeName, TransactionMode.WRITE, [value, key]),
    ]);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  put(storeName: string, value: any, key?: IDBValidKey): Promise<void> {
    return this._taskTransactionHandler([
      new TransactionTask(TransactionType.PUT, storeName, TransactionMode.WRITE, [value, key]),
    ]);
  }

  delete(storeName: string, key: ObjectStoreKey): Promise<void> {
    return this._taskTransactionHandler([
      new TransactionTask(TransactionType.DELETE, storeName, TransactionMode.WRITE, [key]),
    ]);
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
    return this.transaction([
      new TransactionTask(
        transactionType,
        storeName,
        transactionType === TransactionType.GET ? TransactionMode.READ : TransactionMode.WRITE,
        [{ filter, updateValue }],
      ),
    ]);
  }
}
