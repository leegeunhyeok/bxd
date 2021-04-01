import { TransactionTask, TransactionType, TransactionMode, TaskArguments } from './task';
import { IDBData, CursorOptions } from './types';
import { BoxDBError } from './errors';

interface IDBReference {
  value: IDBDatabase;
}

export default class BoxTransaction {
  // Keep idb reference
  private _idb: IDBReference = { value: null };

  /**
   * Recive reference of idb instance
   *
   * @param idb IDBDatabase
   */
  init(idb: IDBDatabase): void {
    this._idb.value = idb;
  }

  /**
   * Reset idb instance
   */
  close(): void {
    this._idb.value = null;
  }

  /**
   * Fulfill multiple tasks on transaction
   *
   * @param tasks Transaction tasks
   */
  private _run(tasks: TransactionTask[]): Promise<void | IDBData | IDBData[]> {
    if (this._idb.value === null) {
      throw new BoxDBError('database not ready');
    }

    const needResponse =
      tasks.length === 1 &&
      (tasks[0].action === TransactionType.GET || tasks[0].action === TransactionType.$GET);
    let res = null;

    // Get store names from tasks
    const storeNames = Object.keys(
      tasks
        .map((task) => task.storeName)
        .reduce((set, curr) => {
          // In loop: Add key into object
          // After: get keys from object
          set[curr] = void 0;
          return set;
        }, {}),
    );

    // Check all tasks transaction mode
    const mode = tasks.every((task) => task.mode === TransactionMode.READ)
      ? TransactionMode.READ
      : TransactionMode.WRITE;

    return new Promise((resolve, reject) => {
      // Open transaction
      const tx = this._idb.value.transaction(storeNames, mode);

      // Do each tasks
      // abort transaction if error occurs during task
      tasks.forEach((task) => {
        const { action, storeName, args } = task.valueOf();

        if (action === TransactionType.INTERRUPT) {
          // interrupt manually
          tx.abort();
        } else if (
          action === TransactionType.$GET ||
          action === TransactionType.$UPDATE ||
          action === TransactionType.$DELETE
        ) {
          // using cursor
          const objectStore = tx.objectStore(storeName);
          this._cursor(objectStore, task).then((records) => (res = records));
        } else {
          // get, add, put, delete, clear
          const objectStore = tx.objectStore(storeName);
          // Dodge ts type checking
          const request = objectStore[action].call(objectStore, ...args) as IDBRequest;
          request.onsuccess = () => (res = request.result);
        }
      });

      const errorHandler = (event: Event) => {
        reject(tx.error || (event.target as IDBRequest).error);
      };

      // On complete
      tx.oncomplete = () => resolve(needResponse ? res ?? null : void 0);

      // On error/abort event will bubbled to idb
      tx.onerror = errorHandler;
    });
  }

  /**
   * Handling cursor task with helpers
   *
   * @param objectStore Target object store object
   * @param task Current task
   */
  private _cursor(
    objectStore: IDBObjectStore,
    task: TransactionTask,
  ): Promise<void | IDBData | IDBData[]> {
    const { filter, direction, value, limit } = task.cursorOption();
    const res = [];

    // Filter function
    const pass = (() => {
      return Array.isArray(filter) ? (value) => filter.every((f) => f(value)) : () => true;
    })();

    let request: IDBRequest<IDBCursorWithValue> = null;
    if (filter && 'value' in filter) {
      // Using IDBKeyRange + IDBCursorDirection
      if (filter.target) {
        if (!objectStore.indexNames.contains(filter.target)) {
          throw new BoxDBError(`${filter.target} field is not an index`);
        }
        // Using named index
        request = objectStore.index(filter.target).openCursor(filter.value, direction);
      } else {
        // Using in-line-key
        request = objectStore.openCursor(filter.value, direction);
      }
    } else {
      // Using custom filter functions(no index) + IDBCursorDirection
      request = objectStore.openCursor(null, direction);
    }

    return new Promise((resolve, reject) => {
      let rows = 0;
      let running = true;
      const limitHandler = () => limit === null || (limit !== null && limit > rows++);
      const cursorTaskRequestHandler = (request: IDBRequest) => {
        request.onerror = (event) => (running = void reject(event));
      };

      request.onsuccess = () => {
        const cursor = request.result;

        if (running && cursor && limitHandler()) {
          const record = cursor.value;

          switch (task.action) {
            case TransactionType.$GET:
              pass(record) && res.push(record);
              break;

            case TransactionType.$UPDATE:
              pass(record) &&
                cursorTaskRequestHandler(
                  cursor.update({
                    ...record,
                    ...(value ? value : null),
                  }),
                );
              break;

            case TransactionType.$DELETE:
              pass(record) && cursorTaskRequestHandler(cursor.delete());
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
   * Create single task and do transaction task
   *
   * @param type Transaction type
   * @param storeName Object store name
   * @param order Cursor direction
   * @param args arguments that  IDB API
   * @returns Result of transaction task
   */
  request(
    type: TransactionType,
    storeName: string,
    cursorOption: CursorOptions<IDBData>,
    args: TaskArguments = [],
  ): Promise<void | IDBData | IDBData[][]> {
    return this._run([new TransactionTask(type, storeName, cursorOption, args)]);
  }

  /**
   * Do multiple transaction tasks
   *
   * @param tasks transacktion tasks
   */
  transaction(tasks: TransactionTask[]): Promise<void> {
    return this._run(tasks);
  }
}
