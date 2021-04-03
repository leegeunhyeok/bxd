import { TransactionTask, TransactionType, TransactionMode, TaskArguments } from './task';
import { IDBData, CursorOptions, CursorCondition } from './types';
import { BoxDBError } from './errors';

interface IDBReference {
  value: IDBDatabase;
}

export default class BoxTransaction {
  // Keep idb reference
  private idb: IDBReference = { value: null };

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
   * Create single task and do transaction task
   *
   * @param type Transaction type
   * @param storeName Object store name
   * @param order Cursor direction
   * @param args arguments that  IDB API
   * @returns Result of transaction task
   */
  do(
    type: TransactionType,
    storeName: string,
    args: TaskArguments = [],
    cursorOption: CursorOptions<IDBData> = null,
  ): Promise<void | IDBData | IDBData[]> {
    return this.run([new TransactionTask(type, storeName, args, cursorOption)]);
  }

  /**
   * Do multiple transaction tasks
   *
   * @param tasks transacktion tasks
   */
  runAll(tasks: TransactionTask[]): Promise<void> {
    if (!tasks.every((task) => task instanceof TransactionTask)) {
      throw new BoxDBError('Invalid elements');
    }
    return this.run(tasks).then(() => void 0);
  }

  /**
   * Fulfill multiple tasks on transaction
   *
   * @param tasks Transaction tasks
   */
  private run(tasks: TransactionTask[]): Promise<void | IDBData | IDBData[]> {
    if (this.idb.value === null) {
      throw new BoxDBError('Database not ready');
    }

    const firstTaskType = tasks[0].action;
    const needResponse =
      tasks.length === 1 &&
      (firstTaskType === TransactionType.GET ||
        firstTaskType === TransactionType.$GET ||
        firstTaskType === TransactionType.COUNT);
    let res = null;

    // Get store names from tasks
    const storeNamesInTasks = Object.keys(
      tasks.reduce((set, curr) => {
        // In loop: Add key into object
        // After: get keys from object
        curr.name && (set[curr.name] = 0);
        return set;
      }, {}),
    );

    // Check all tasks transaction mode
    const mode = tasks.every((task) => task.mode === TransactionMode.READ)
      ? TransactionMode.READ
      : TransactionMode.WRITE;

    return new Promise((resolve, reject) => {
      // Open transaction
      const tx = this.idb.value.transaction(storeNamesInTasks, mode);

      // Do each tasks
      // abort transaction if error occurs during task
      for (const task of tasks) {
        const action = task.action;

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
          this.cursor(objectStore, task).then((records) => (res = records));
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
  private cursor(
    objectStore: IDBObjectStore,
    task: TransactionTask,
  ): Promise<void | IDBData | IDBData[]> {
    const options = task.cursor;
    const filter = options.filter || null;
    const value = options.value || null;
    const limit = options.limit ?? null;
    const direction = options.direction || 'next';
    const res = [];

    // Filter function
    const pass = (() => {
      return Array.isArray(filter) ? (value) => filter.every((f) => f(value)) : () => true;
    })();

    let request: IDBRequest<IDBCursorWithValue> = null;
    if (!filter || Array.isArray(filter)) {
      // Using custom filter functions(no index) + IDBCursorDirection
      request = objectStore.openCursor(null, direction);
    } else {
      filter as CursorCondition<IDBData>;
      // Using IDBKeyRange + IDBCursorDirection
      const index = filter.target;

      if (index && !objectStore.indexNames.contains(index)) {
        throw new BoxDBError(index + ' field is not an index');
      }

      request = (index ? objectStore.index(index) : objectStore).openCursor(
        filter.value,
        direction,
      );
    }

    return new Promise((resolve, reject) => {
      // Counting for limit
      let rows = 0;
      let running = true;
      const limitHandler = () => limit === null || limit === null || limit > rows++;
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
}
