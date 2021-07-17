import { DataType } from '../types/dataType';
import { createTask, getCursorHandler, getTransactionCursorHandler } from '../utils';
import { BoxDBError } from './errors';
import { Data, OptionalData } from '../types/data';
import { Schema } from '../types/schema';
import { Transaction, TransactionType } from '../types/transaction';
import { BoxTask, TaskParameter, CursorDirection, BoxRange, FilterFunction } from './transaction';
import { IDBData } from '../types/idb';
import { Model } from '../types/model';

type UncheckedData = {
  [field: string]: unknown;
};

export interface BoxPrototype {
  tx: Transaction<BoxTask>;
  $(type: TransactionType, args?: TaskParameter<Schema>): Promise<void | IDBData | IDBData[]>;
  pass(target: UncheckedData, strict?: boolean): void | never;
  data<T extends Schema>(initalData?: Data<T>): Data<T>;
}

export interface BoxProperty {
  __name: string;
  __schema: Schema;
  __version: number;
}

export type BoxContext = BoxPrototype & BoxProperty;

/**
 * @description Box handler Types
 */
export interface BoxHandler<S extends Schema> {
  getName(): string;
  getVersion(): number;
  add(value: Data<S>, key?: IDBValidKey): Promise<IDBValidKey>;
  get(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): Promise<Data<S>>;
  put(value: OptionalData<S>, key?: IDBValidKey): Promise<void>;
  delete(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): Promise<void>;
  find(range?: BoxRange<S> | null, ...predicate: FilterFunction<S>[]): BoxCursorHandler<S>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

// Box.$* = BoxTaskHandler
export interface BoxTaskHandler<S extends Schema> {
  $add(value: Data<S>, key?: IDBValidKey): BoxTask;
  $put(value: OptionalData<S>, key?: IDBValidKey): BoxTask;
  $delete(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): BoxTask;
  $find(range?: BoxRange<S> | null, ...predicate: FilterFunction<S>[]): TransactionCursorHandler<S>;
}

// Box.find = () => BoxCursorHandler
export interface BoxCursorHandler<S extends Schema> {
  get(order?: CursorDirection | null, limit?: number): Promise<Data<S>[]>;
  update(value: OptionalData<S>): Promise<void>;
  delete(): Promise<void>;
}

// Box.$find = () => TransactionCursorHandler
export interface TransactionCursorHandler<S extends Schema> {
  update(value: OptionalData<S>): BoxTask;
  delete(): BoxTask;
}
export interface Box<S extends Schema> extends Model<S>, BoxProperty {
  getName(): string;
  getVersion(): string;
  find(range?: BoxRange<S> | null, ...predicate: FilterFunction<S>[]): BoxCursorHandler<S>;
  $add(value: Data<S>, key?: IDBValidKey): BoxTask;
  $put(value: OptionalData<S>, key?: IDBValidKey): BoxTask;
  $delete(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): BoxTask;
  $find(range?: BoxRange<S> | null, ...predicate: FilterFunction<S>[]): TransactionCursorHandler<S>;
}

/**
 * Validate with configured type
 *
 * @param type Type identifier
 * @param value Value for check
 */
const typeValidator = (type: DataType, value: UncheckedData[string]): boolean => {
  if (value === null) return true;

  switch (type) {
    case DataType.BOOLEAN:
      return typeof value === 'boolean';
    case DataType.NUMBER:
      return typeof value === 'number';
    case DataType.STRING:
      return typeof value === 'string';
    case DataType.DATE:
      return value instanceof Date;
    case DataType.ARRAY:
      return Array.isArray(value);
    case DataType.OBJECT:
      return typeof value === 'object';
    case DataType.REGEXP:
      return value instanceof RegExp;
    case DataType.FILE:
      return value instanceof File;
    case DataType.BLOB:
      return value instanceof Blob;
    case DataType.ANY:
      return true; // any
  }
};

/**
 * Check data based on schema
 *
 * 1. Compare target field / schema field count
 * 2. Check target fields name in schema
 * 3. Check fields value type
 *
 * @param this Box
 * @param target Target data
 * @param strict Enable strict mode (disabled: check properties(like optinal) / enabled: +types)
 */
function schemaValidator(this: BoxContext, target: UncheckedData, strict = true): void | never {
  const schemaKeys = Object.keys(this.__schema);
  const targetKeys = Object.keys(target);

  // Checking in strict mode
  const samekeyLength = !strict || schemaKeys.length === targetKeys.length;
  const correctValueTypes =
    !strict ||
    Object.entries(this.__schema).every(([k, v]) =>
      typeValidator(typeof v === 'string' ? v : v.type, target[k]),
    );

  if (!(samekeyLength && correctValueTypes && targetKeys.every((k) => schemaKeys.includes(k)))) {
    throw new BoxDBError('Data not valid');
  }
}

/**
 * Create new box data
 *
 * @param baseObject
 * @param targetObject
 */
function createBoxData<T extends Schema>(this: BoxContext, initalData?: Data<T>): Data<T> {
  const boxData = {} as Data<T>;
  Object.keys(this.__schema).forEach(
    (k) => (boxData[k as keyof T] = (initalData && initalData[k]) ?? null),
  );
  return boxData;
}

/**
 * Execute task and returns tasked Promise
 *
 * @param type Transaction type
 * @param params Parameters
 */
function transactionExecuter(
  this: BoxContext,
  type: TransactionType,
  params?: TaskParameter<Schema>,
) {
  return this.tx.run(createTask(type, this.__name, params));
}

// BoxHandler
const boxHandler: BoxHandler<IDBData> = {
  getName(this: BoxContext) {
    return this.__name;
  },
  getVersion(this: BoxContext) {
    return this.__version;
  },
  add(this: BoxContext, value, key) {
    this.pass(value);
    return this.$(TransactionType.ADD, {
      args: [value, key],
    });
  },
  get(this: BoxContext, key) {
    return this.$(TransactionType.GET, {
      args: [key],
    });
  },
  put(this: BoxContext, value, key) {
    this.pass(value, false);
    return this.$(TransactionType.PUT, {
      args: [value, key],
    });
  },
  delete(this: BoxContext, key) {
    return this.$(TransactionType.DELETE, {
      args: [key],
    });
  },
  find(this: BoxContext, range, ...predicate) {
    return getCursorHandler(this, range, predicate);
  },
  clear(this: BoxContext) {
    return this.$(TransactionType.CLEAR);
  },
  count(this: BoxContext) {
    return this.$(TransactionType.COUNT);
  },
};

// BoxTask
const boxTask: BoxTaskHandler<IDBData> = {
  $add(this: BoxContext, value, key) {
    this.pass(value);
    return createTask(TransactionType.ADD, this.__name, { args: [value, key] });
  },
  $put(this: BoxContext, value, key) {
    this.pass(value, false);
    return createTask(TransactionType.PUT, this.__name, { args: [value, key] });
  },
  $delete(this: BoxContext, key) {
    return createTask(TransactionType.DELETE, this.__name, { args: [key] });
  },
  $find(this: BoxContext, range, ...predicate) {
    return getTransactionCursorHandler(this, range, predicate);
  },
};

const i = IDBKeyRange;
export const rangeBuilder = {
  equal: i.only,
  upper: i.upperBound,
  lower: i.lowerBound,
  bound: i.bound,
};

export default class BoxBuilder {
  private proto: BoxPrototype;

  constructor(tx: Transaction<BoxTask>) {
    this.proto = { tx, $: transactionExecuter, pass: schemaValidator, data: createBoxData };
  }

  /**
   * Create new box
   *
   * @param storeName Object store name
   * @param schema Data schema
   */
  build<S extends Schema>(targetVersion: number, storeName: string, schema: S): Box<S> {
    const Model = function Box<S extends Schema>(this: BoxContext, initalData?: Data<S>) {
      // Data validate if initial data is provided
      initalData && this.pass(initalData);

      // Create empty(null) object or box data based on initialData
      return this.data(initalData);
    } as unknown as Box<S>;

    const context = Object.create(this.proto) as BoxContext;
    context.__name = storeName;
    context.__schema = schema;
    context.__version = targetVersion;

    // Handlers
    const handler = Object.assign(context, boxHandler, boxTask);
    Object.setPrototypeOf(Model, handler);
    Object.setPrototypeOf(Model.prototype, context);

    return Model;
  }
}
