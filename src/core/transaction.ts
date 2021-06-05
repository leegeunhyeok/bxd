import { BoxDBError } from './errors';

import {
  IDBData,
  BoxSchema,
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
  private idb: {
    value: IDBDatabase;
  } = { value: null };

  /**
   * Store reference of idb instance
   *
   * @param idb IDBDatabase
   */
  init(idb: IDBDatabase): void {
    this.idb.value = idb;
  }

  /**
   * Clear IDB instance
   */
  close(): void {
    this.idb.value = null;
  }

  /**
   * Execute all tasks
   *
   * @param tasks Transaction tasks
   */
  run<S extends BoxSchema, T extends TransactionTask>(
    ...tasks: T[]
  ): Promise<void | IDBData | IDBData[]> {
    if (this.idb.value === null) {
      throw new BoxDBError('Database not ready');
    }

    const firstTaskType = tasks[0].type;
    const needResponse = tasks.length === 1 && HAS_VALUE_TYPES.includes(firstTaskType);
    let res = null;

    // Get object store names from tasks
    const storeNamesInTasks = Object.keys(
      tasks.reduce((set, curr) => {
        // Add object key as store name
        curr.name && (set[curr.name] = 0);
        return set;
      }, {}),
    );

    // Select transaction mode
    const mode = tasks.some((task) => !READONLY_TYPES.includes(task.type))
      ? TransactionMode.WRITE
      : TransactionMode.READ;

    return new Promise((resolve, reject) => {
      // Open new transaction
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
          this.cursor<S>(objectStore, task as CursorTransactionTask<S>).then(
            (records) => (res = records),
          );
        } else {
          // get, add, put, delete, count, clear
          const objectStore = tx.objectStore(task.name);
          // Skip ts type checking
          const request = objectStore[action].call(objectStore, ...(task.args || [])) as IDBRequest;
          request.onsuccess = () => (res = request.result);
        }
      }

      const errorHandler = (event: Event) => {
        // Error event will bubbled up to IDB
        reject(tx.error || (event.target as IDBRequest).error);
      };

      // On complete
      tx.oncomplete = () => resolve(needResponse ? res ?? null : void 0);

      // On error/abort
      tx.onerror = errorHandler;
    });
  }

  /**
   * Handling cursor task with helpers
   *
   * @param objectStore Object store object
   * @param task Current task
   */
  private cursor<S extends BoxSchema>(
    objectStore: IDBObjectStore,
    task: CursorTransactionTask<S>,
  ): Promise<void | IDBData | IDBData[]> {
    const filter = task.filter;
    const range = task.range;
    const limit = task.limit || null;
    const direction = task.direction || 'next';
    const updateValue = task.updateValue || null;
    const res = [];

    // Bundle of filter functions
    const pass = filter && filter.length ? (value) => filter.every((f) => f(value)) : () => true;

    // Using IDBKeyRange + IDBCursorDirection
    const index = range && range.index;
    if (index && !objectStore.indexNames.contains(index)) {
      throw new BoxDBError(index + ' field is not an index');
    }

    return new Promise((resolve, reject) => {
      // Counting variable for limit records
      let rows = 0;
      let running = true;
      const limitHandler = () => limit === null || limit > rows;
      const cursorTaskRequestHandler = (request: IDBRequest) => {
        /* istanbul ignore next */
        request.onerror = (event) => (running = void reject(event));
      };

      const request: IDBRequest<IDBCursorWithValue> = (
        index ? objectStore.index(index) : objectStore
      ).openCursor(range ? range.value : null, direction);

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
