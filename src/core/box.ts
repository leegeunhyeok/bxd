import BoxTransaction from './transaction';
import { createTask } from '../utils';
import { BoxDBError } from './errors';
import { TaskArguments } from '../utils/index';
import { BoxRange } from '../types/index';

import {
  IDBData,
  BoxData,
  BoxSchema,
  BoxDataTypes,
  UncheckedData,
  OptionalBoxData,
  BoxCursorDirections,
  BoxFilterFunction,
  TransactionTask,
  TransactionType,
} from '../types';

// Box
export interface Box<S extends BoxSchema> extends BoxHandler<S>, BoxTask<S> {
  new (initalData?: BoxData<S>): BoxData<S>;
}

// Transaction handlers of Box
export interface BoxHandler<S extends BoxSchema> {
  getName(): string;
  getVersion(): number;
  add(value: BoxData<S>, key?: IDBValidKey): Promise<IDBValidKey>;
  get(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): Promise<BoxData<S>>;
  put(value: BoxData<S>, key?: IDBValidKey): Promise<void>;
  delete(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): Promise<void>;
  query(range?: BoxRange<S>): BoxCursorHandler<S>;
  filter(...predicate: BoxFilterFunction<S>[]): BoxCursorHandler<S>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

// Box.task = BoxTask
export interface BoxTask<S extends BoxSchema> {
  $add(value: BoxData<S>, key?: IDBValidKey): TransactionTask;
  $put(value: BoxData<S>, key?: IDBValidKey): TransactionTask;
  $delete(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): TransactionTask;
  $query(range?: BoxRange<S>): TransactionCursorHandler<S>;
  $filter(...predicate: BoxFilterFunction<S>[]): TransactionCursorHandler<S>;
}

// Box.query = () => BoxCursorHandler
// Box.filter = () => BoxCursorHandler
export interface BoxCursorHandler<S extends BoxSchema> {
  get(order?: BoxCursorDirections, limit?: number): Promise<BoxData<S>[]>;
  update(value: OptionalBoxData<S>): Promise<void>;
  delete(): Promise<void>;
}

// Box.$query = () => TransactionCursorHandler
// Box.$filter = () => TransactionCursorHandler
export interface TransactionCursorHandler<S extends BoxSchema> {
  update(value: OptionalBoxData<S>): TransactionTask;
  delete(): TransactionTask;
}

// Box Prototype
export interface BoxPrototype {
  tx: BoxTransaction;
  $(type: TransactionType, args?: TaskArguments<BoxSchema>): Promise<void | IDBData | IDBData[]>;
  pass(target: UncheckedData, strict?: boolean): void | never;
  data<T extends BoxSchema>(initalData?: BoxData<T>): BoxData<T>;
}

export interface BoxProperty {
  __name: string;
  __schema: BoxSchema;
  __version: number;
}

export type BoxContext = BoxPrototype & BoxProperty;

/**
 * Check about target value has same type with type identifier
 *
 * @param type Type identifier
 * @param value Value for check
 */
const typeValidator = (type: BoxDataTypes, value: UncheckedData): boolean => {
  if (value === null) return true;
  const targetPrototype = Object.getPrototypeOf(value);

  switch (type) {
    case BoxDataTypes.BOOLEAN:
      return targetPrototype === Boolean.prototype;
    case BoxDataTypes.NUMBER:
      return targetPrototype === Number.prototype;
    case BoxDataTypes.STRING:
      return targetPrototype === String.prototype;
    case BoxDataTypes.DATE:
      return value instanceof Date;
    case BoxDataTypes.ARRAY:
      return targetPrototype === Array.prototype;
    case BoxDataTypes.OBJECT:
      return targetPrototype === Object.prototype;
    case BoxDataTypes.REGEXP:
      return targetPrototype === RegExp.prototype;
    case BoxDataTypes.FILE:
      return targetPrototype === File.prototype;
    case BoxDataTypes.BLOB:
      return targetPrototype === Blob.prototype;
    case BoxDataTypes.ANY:
      return true; // any
  }
};

/**
 * Check object keys matching and data types
 *
 * 1. Target's key length is same with box schema's key length
 * 2. Check target's keys in schema
 * 3. Target's value types are correct with schema
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
 * Create new object and merge object
 *
 * @param baseObject
 * @param targetObject
 */
function createBoxData<T extends BoxSchema>(this: BoxContext, initalData?: BoxData<T>): BoxData<T> {
  const boxData = {} as BoxData<T>;
  Object.keys(this.__schema).forEach(
    (k) => (boxData[k as keyof T] = (initalData && initalData[k]) ?? null),
  );
  return boxData;
}

/**
 * Create transaction task from box context
 *
 * @param type Transaction type
 */
function transactionExecuter(
  this: BoxContext,
  type: TransactionType,
  args?: TaskArguments<BoxSchema>,
) {
  return this.tx.run(createTask(type, this.__name, args));
}

/**
 * Returns IDBKeyRange
 */
const i = IDBKeyRange;
export const rangeBuilder = {
  equal: i.only,
  upper: i.upperBound,
  lower: i.lowerBound,
  bound: i.bound,
};

export default class BoxBuilder {
  private proto: BoxPrototype;
  private handler: BoxHandler<IDBData>;
  private task: BoxTask<IDBData>;

  constructor(tx: BoxTransaction) {
    this.proto = { tx, $: transactionExecuter, pass: schemaValidator, data: createBoxData };
    this.handler = {
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
      query(this: BoxContext, range: BoxRange<BoxSchema>) {
        return {
          get: (order, limit) => {
            return this.$(TransactionType.$GET, {
              direction: order,
              limit,
              range,
            });
          },
          update: (value) => {
            this.pass(value, false);
            return this.$(TransactionType.$UPDATE, { range, updateValue: value });
          },
          delete: () => {
            return this.$(TransactionType.$DELETE, { range });
          },
        };
      },
      filter(this: BoxContext, ...predicate) {
        return {
          get: (order, limit) => {
            return this.$(TransactionType.$GET, {
              direction: order,
              filter: predicate,
              limit,
            });
          },
          update: (value) => {
            this.pass(value, false);
            return this.$(TransactionType.$UPDATE, { filter: predicate, updateValue: value });
          },
          delete: () => {
            return this.$(TransactionType.$DELETE, { filter: predicate });
          },
        };
      },
      clear(this: BoxContext) {
        return this.$(TransactionType.CLEAR);
      },
      count(this: BoxContext) {
        return this.$(TransactionType.COUNT);
      },
    };

    this.task = {
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
      $query(this: BoxContext, range) {
        return {
          update: (value) => {
            this.pass(value, false);
            return createTask(TransactionType.$UPDATE, this.__name, { range, updateValue: value });
          },
          delete: () => {
            return createTask(TransactionType.$DELETE, this.__name, { range });
          },
        };
      },
      $filter(this: BoxContext, ...predicate) {
        return {
          update: (value) => {
            this.pass(value, false);
            return createTask(TransactionType.$UPDATE, this.__name, {
              filter: predicate,
              updateValue: value,
            });
          },
          delete: () => {
            return createTask(TransactionType.$DELETE, this.__name, { filter: predicate });
          },
        };
      },
    };
  }

  /**
   * Create new box
   *
   * @param storeName Object store name
   * @param schema Data schema
   */
  build<S extends BoxSchema>(targetVersion: number, storeName: string, schema: S): Box<S> {
    const Box = function Box<S extends BoxSchema>(this: BoxContext, initalData?: BoxData<S>) {
      // Check schema if initial data provided
      initalData && this.pass(initalData);

      // Create empty(null) object or initalData based on schema
      return this.data(initalData);
    } as unknown as Box<S>;

    const context = Object.create(this.proto) as BoxContext;
    context.__name = storeName;
    context.__schema = schema;
    context.__version = targetVersion;

    // Handlers
    const handler = Object.assign(context, this.handler, this.task);
    Object.setPrototypeOf(Box, handler);
    Object.setPrototypeOf(Box.prototype, context);

    return Box;
  }
}
