import BoxTransaction from './transaction';
import { createTask } from '../utils';
import { BoxDBError } from './errors';
import { TaskArguments } from '../utils/index';
import { BoxRange } from '../types/index';

import {
  IDBData,
  BoxData,
  BoxScheme,
  BoxDataTypes,
  UncheckedData,
  OptionalBoxData,
  BoxCursorDirections,
  BoxFilterFunction,
  TransactionTask,
  TransactionType,
} from '../types';

// BoxModel
export interface BoxModel<S extends BoxScheme> extends BoxHandler<S>, BoxTask<S> {
  new (initalData?: BoxData<S>): BoxData<S>;
}

// Transaction handlers of BoxModel
export interface BoxHandler<S extends BoxScheme> {
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
  find(...filter: BoxFilterFunction<S>[]): BoxCursorHandler<S>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

// BoxModel.task = BoxTask
export interface BoxTask<S extends BoxScheme> {
  $add(value: BoxData<S>, key?: IDBValidKey): TransactionTask;
  $put(value: BoxData<S>, key?: IDBValidKey): TransactionTask;
  $delete(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): TransactionTask;
  $find(...filter: BoxFilterFunction<S>[]): BoxCursorTask<S>;
}

// BoxModel.find = () => BoxCursorHandler
export interface BoxCursorHandler<S extends BoxScheme> {
  get(order?: BoxCursorDirections, limit?: number): Promise<BoxData<S>[]>;
  update(value: OptionalBoxData<S>): Promise<void>;
  delete(): Promise<void>;
}

// BoxModel.task.find = () => BoxCursorTask
export interface BoxCursorTask<S extends BoxScheme> {
  update(value: OptionalBoxData<S>): TransactionTask;
  delete(): TransactionTask;
}

// BoxModel Prototype
export interface ModelPrototype {
  tx: BoxTransaction;
  $(type: TransactionType, args?: TaskArguments<BoxScheme>): Promise<void | IDBData | IDBData[]>;
  pass(target: UncheckedData, strict?: boolean): void | never;
  data<T extends BoxScheme>(initalData?: BoxData<T>): BoxData<T>;
}

export interface ModelProperty {
  store: string;
  scheme: BoxScheme;
  v: number;
}

export type ModelContext = ModelPrototype & ModelProperty;

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
 * 1. Target's key length is same with model scheme's key length
 * 2. Check target's keys in scheme
 * 3. Target's value types are correct with scheme
 *
 * @param this Model
 * @param target Target data
 * @param strict Enable strict mode (disabled: check properties(like optinal) / enabled: +types)
 */
function schemeValidator(this: ModelContext, target: UncheckedData, strict = true): void | never {
  const schemeKeys = Object.keys(this.scheme);
  const targetKeys = Object.keys(target);

  // Checking in strict mode
  const samekeyLength = !strict || schemeKeys.length === targetKeys.length;
  const correctValueTypes =
    !strict ||
    Object.entries(this.scheme).every(([k, v]) =>
      typeValidator(typeof v === 'string' ? v : v.type, target[k]),
    );

  if (!(samekeyLength && correctValueTypes && targetKeys.every((k) => schemeKeys.includes(k)))) {
    throw new BoxDBError('Data not valid');
  }
}

/**
 * Create new object and merge object
 *
 * @param baseObject
 * @param targetObject
 */
function createBoxData<T extends BoxScheme>(
  this: ModelContext,
  initalData?: BoxData<T>,
): BoxData<T> {
  const boxData = {} as BoxData<T>;
  Object.keys(this.scheme).forEach(
    (k) => (boxData[k as keyof T] = (initalData && initalData[k]) ?? null),
  );
  return boxData;
}

/**
 * Create transaction task from model context
 *
 * @param type Transaction type
 */
function transactionExecuter(this: ModelContext, type: TransactionType, args?: TaskArguments<any>) {
  return this.tx.run(createTask(type, this.store, args));
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

export default class BoxModelBuilder {
  private proto: ModelPrototype;
  private handler: BoxHandler<IDBData>;
  private task: BoxTask<IDBData>;

  constructor(tx: BoxTransaction) {
    this.proto = { tx, $: transactionExecuter, pass: schemeValidator, data: createBoxData };
    this.handler = {
      getName(this: ModelContext) {
        return this.store;
      },
      getVersion(this: ModelContext) {
        return this.v;
      },
      add(this: ModelContext, value, key) {
        this.pass(value);
        return this.$(TransactionType.ADD, {
          args: [value, key],
        });
      },
      get(this: ModelContext, key) {
        return this.$(TransactionType.GET, {
          args: [key],
        });
      },
      put(this: ModelContext, value, key) {
        this.pass(value);
        return this.$(TransactionType.PUT, {
          args: [value, key],
        });
      },
      delete(this: ModelContext, key) {
        return this.$(TransactionType.DELETE, {
          args: [key],
        });
      },
      query(this: ModelContext, range: BoxRange<BoxScheme>) {
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
      find(this: ModelContext, ...filter) {
        return {
          get: (order, limit) => {
            return this.$(TransactionType.$GET, {
              direction: order,
              filter,
              limit,
            });
          },
          update: (value) => {
            this.pass(value, false);
            return this.$(TransactionType.$UPDATE, { filter, updateValue: value });
          },
          delete: () => {
            return this.$(TransactionType.$DELETE, { filter });
          },
        };
      },
      clear(this: ModelContext) {
        return this.$(TransactionType.CLEAR);
      },
      count(this: ModelContext) {
        return this.$(TransactionType.COUNT);
      },
    };

    this.task = {
      $add(this: ModelContext, value, key) {
        this.pass(value);
        return createTask(TransactionType.ADD, this.store, { args: [value, key] });
      },
      $put(this: ModelContext, value, key) {
        this.pass(value);
        return createTask(TransactionType.PUT, this.store, { args: [value, key] });
      },
      $delete(this: ModelContext, key) {
        return createTask(TransactionType.DELETE, this.store, { args: [key] });
      },
      $find(this: ModelContext, ...filter) {
        return {
          update: (value) => {
            this.pass(value, false);
            return createTask(TransactionType.$UPDATE, this.store, { filter, updateValue: value });
          },
          delete: () => {
            return createTask(TransactionType.$DELETE, this.store, { filter });
          },
        };
      },
    };
  }

  /**
   * Create new model
   *
   * @param storeName Object store name
   * @param scheme Data scheme
   */
  build<S extends BoxScheme>(targetVersion: number, storeName: string, scheme: S): BoxModel<S> {
    const Model = function Model<S extends BoxScheme>(this: ModelContext, initalData?: BoxData<S>) {
      // Check scheme if initial data provided
      initalData && this.pass(initalData);

      // Create empty(null) object or initalData based on scheme
      return this.data(initalData);
    } as unknown as BoxModel<S>;

    const context = Object.create(this.proto) as ModelContext;
    context.store = storeName;
    context.scheme = scheme;
    context.v = targetVersion;

    // Handlers
    const handler = Object.assign(context, this.handler, this.task);
    Object.setPrototypeOf(Model, handler);
    Object.setPrototypeOf(Model.prototype, context);

    return Model;
  }
}
