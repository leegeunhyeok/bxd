import { BoxDBError } from './errors';

import {
  IDBData,
  BoxScheme,
  TransactionTask,
  CursorTransactionTask,
  TransactionType,
  TransactionMode,
} from '../types';

const READONLY_TYPES = [
  TransactionType.GET,
  TransactionType.COUNT,
  TransactionType.$GET,
  TransactionType.INTERRUPT,
];

const HAS_VALUE_TYPES = [
  TransactionType.GET,
  TransactionType.$GET,
  TransactionType.COUNT,
  TransactionType.ADD,
];

export default class BoxTransaction {
  // Keep idb reference
  private idb: {
    value: IDBDatabase;
  } = { value: null };

  /**
   * Recive reference of idb instance
   *
   * @param idb IDBDatabase
   */
  init(idb: IDBDatabase): void {
    this.idb.value = idb;
  }

  /**
   * Reset idb instance
   */
  close(): void {
    this.idb.value = null;
  }

  /**
   * Fulfill multiple tasks on transaction
   *
   * @param tasks Transaction tasks
   */
  run<S extends BoxScheme, T extends TransactionTask>(
    ...tasks: T[]
  ): Promise<void | IDBData | IDBData[]> {
    if (this.idb.value === null) {
      throw new BoxDBError('Database not ready');
    }

    const firstTaskType = tasks[0].type;
    const needResponse = tasks.length === 1 && HAS_VALUE_TYPES.includes(firstTaskType);
    let res = null;

    // Get store names from tasks
    const storeNamesInTasks = Object.keys(
      tasks.reduce((set, curr) => {
        // Add object key as store name
        curr.name && (set[curr.name] = 0);
        return set;
      }, {}),
    );

    // Get transaction mode
    const mode = tasks.some((task) => !READONLY_TYPES.includes(task.type))
      ? TransactionMode.WRITE
      : TransactionMode.READ;

    return new Promise((resolve, reject) => {
      // Open transaction
      const tx = this.idb.value.transaction(storeNamesInTasks, mode);

      // Do each tasks
      // abort transaction if error occurs during task
      for (const task of tasks) {
        const action = task.type;

        if (action === TransactionType.INTERRUPT) {
          // interrupt manually
          tx.abort();
        } else if (
          action === TransactionType.$GET ||
          action === TransactionType.$UPDATE ||
          action === TransactionType.$DELETE
        ) {
          // using cursor
          const objectStore = tx.objectStore(task.name);
          this.cursor<S>(objectStore, task).then((records) => (res = records));
        } else {
          // get, add, put, delete, clear
          const objectStore = tx.objectStore(task.name);
          // Dodge ts type checking
          const request = objectStore[action].call(objectStore, ...task.args) as IDBRequest;
          request.onsuccess = () => (res = request.result);
        }
      }

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
  private cursor<S extends BoxScheme>(
    objectStore: IDBObjectStore,
    task: CursorTransactionTask<S>,
  ): Promise<void | IDBData | IDBData[]> {
    const filter = task.filter;
    const range = task.range;
    const limit = task.limit;
    const direction = task.direction || 'next';
    const updateValue = task.updateValue || null;
    const res = [];

    // Filter function
    const pass = (() => {
      return Array.isArray(filter) ? (value) => filter.every((f) => f(value)) : () => true;
    })();

    // Using IDBKeyRange + IDBCursorDirection
    const index = range.target;
    if (index && !objectStore.indexNames.contains(index)) {
      throw new BoxDBError(index + ' field is not an index');
    }

    const request: IDBRequest<IDBCursorWithValue> = (
      index ? objectStore.index(index) : objectStore
    ).openCursor(range.value, direction);

    return new Promise((resolve, reject) => {
      // Counting for limit
      let rows = 0;
      let running = true;
      const limitHandler = () => limit === null || limit > rows;
      const cursorTaskRequestHandler = (request: IDBRequest) => {
        request.onerror = (event) => (running = void reject(event));
      };

      request.onsuccess = () => {
        const cursor = request.result;

        if (running && cursor && limitHandler()) {
          const record = cursor.value;

          switch (task.type) {
            case TransactionType.$GET:
              pass(record) && ++rows && res.push(record);
              break;

            case TransactionType.$UPDATE:
              pass(record) &&
                cursorTaskRequestHandler(
                  cursor.update({
                    ...record,
                    ...updateValue,
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
}
