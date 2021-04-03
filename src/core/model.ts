import BoxTransaction from './transaction';
import { TransactionTask, TransactionType } from './task';
import {
  IDBData,
  BoxData,
  BoxScheme,
  BoxDataTypes,
  CursorQuery,
  CursorOptions,
  UncheckedData,
  OptionalBoxData,
} from './types';
import { BoxDBError } from './errors';

// BoxModel
export interface BoxModel<S extends BoxScheme> extends BoxHandler<S> {
  new (initalData?: BoxData<S>): BoxData<S>;
  task: BoxTask<S>;
}

// Transaction handlers of BoxModel

export interface BoxHandler<S extends BoxScheme> {
  getName(): string;
  getVersion(): number;
  add(value: BoxData<S>, key?: IDBValidKey): Promise<void>;
  get(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): Promise<BoxData<S>>;
  put(value: BoxData<S>, key?: IDBValidKey): Promise<void>;
  delete(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): Promise<void>;
  find(filter?: CursorQuery<S>): BoxCursorHandler<S>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

// BoxModel.task = BoxTask
export interface BoxTask<S extends BoxScheme> {
  add(value: BoxData<S>, key?: IDBValidKey): TransactionTask;
  put(value: BoxData<S>, key?: IDBValidKey): TransactionTask;
  delete(
    key: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange,
  ): TransactionTask;
  find(filter?: CursorQuery<S>): BoxCursorTask<S>;
}

// BoxModel.find = () => BoxCursorHandler
export interface BoxCursorHandler<S extends BoxScheme> {
  get(order?: IDBCursorDirection, limit?: number): Promise<BoxData<S>[]>;
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
  pass(target: UncheckedData): boolean;
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
 * @param target target data
 */
function schemeValidator(this: ModelContext, target: UncheckedData): boolean {
  const schemeKeys = Object.keys(this.scheme);
  const targetKeys = Object.keys(target);

  return (
    schemeKeys.length === targetKeys.length &&
    schemeKeys.every((k) => ~targetKeys.indexOf(k)) &&
    Object.entries(this.scheme).every(([k, v]) =>
      typeValidator(typeof v === 'string' ? v : v.type, target[k]),
    )
  );
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
  private static _: BoxModelBuilder = null;
  private _proto: ModelPrototype;
  private _handler: BoxHandler<IDBData>;
  private _task: BoxTask<IDBData>;

  static get(tx: BoxTransaction): BoxModelBuilder {
    if (!this._) {
      this._ = new BoxModelBuilder(tx);
    }
    return this._;
  }

  private constructor(tx: BoxTransaction) {
    /**
     * Convert model handler arguments to CursorOption
     * @param option
     * @param value
     * @param direction
     * @param limit
     * @returns
     */
    const toCursorOption = (
      option: CursorQuery<IDBData>,
      value: IDBData = void 0,
      direction: IDBCursorDirection = void 0,
      limit: number = void 0,
    ): CursorOptions<IDBData> => ({
      direction,
      filter: option,
      limit,
      value,
    });

    this._proto = { tx, pass: schemeValidator, data: createBoxData };
    this._handler = {
      getName(this: ModelContext) {
        return this.store;
      },
      getVersion(this: ModelContext) {
        return this.v;
      },
      add(this: ModelContext, value, key) {
        return this.tx.do(TransactionType.ADD, this.store, [value, key]);
      },
      get(this: ModelContext, key) {
        return this.tx.do(TransactionType.GET, this.store, [key]);
      },
      put(this: ModelContext, value, key) {
        return this.tx.do(TransactionType.PUT, this.store, [value, key]);
      },
      delete(this: ModelContext, key) {
        return this.tx.do(TransactionType.DELETE, this.store, [key]);
      },
      find(this: ModelContext, filter) {
        return {
          get: (order, limit) =>
            this.tx.do(
              TransactionType.$GET,
              this.store,
              null,
              toCursorOption(filter, null, order, limit),
            ),
          update: (value) =>
            this.tx.do(TransactionType.$UPDATE, this.store, null, toCursorOption(filter, value)),
          delete: () =>
            this.tx.do(TransactionType.$DELETE, this.store, null, toCursorOption(filter)),
        };
      },
      clear(this: ModelContext) {
        return this.tx.do(TransactionType.CLEAR, this.store);
      },
      count(this: ModelContext) {
        return this.tx.do(TransactionType.COUNT, this.store);
      },
    };

    this._task = {
      add(this: ModelContext, value, key) {
        return new TransactionTask(TransactionType.ADD, this.store, [value, key], null);
      },
      put(this: ModelContext, value, key) {
        return new TransactionTask(TransactionType.PUT, this.store, [value, key], null);
      },
      delete(this: ModelContext, key) {
        return new TransactionTask(TransactionType.DELETE, this.store, [key], null);
      },
      find(this: ModelContext, filter) {
        return {
          update: (value) =>
            new TransactionTask(TransactionType.$UPDATE, this.store, null, {
              filter,
              value,
            }),
          delete: () => new TransactionTask(TransactionType.$DELETE, this.store, null, { filter }),
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
    const Model = (function Model<S extends BoxScheme>(
      this: ModelContext,
      initalData?: BoxData<S>,
    ) {
      // Check scheme if initial data provided
      if (initalData && !this.pass(initalData)) {
        throw new BoxDBError('data not valid');
      }

      // Create empty(null) object or initalData based on scheme
      return this.data(initalData);
    } as unknown) as BoxModel<S>;

    const context = Object.create(this._proto) as ModelContext;
    context.store = storeName;
    context.scheme = scheme;
    context.v = targetVersion;

    // Model.task
    const task = Object.assign(Object.create(context), this._task);
    // Model.get, ...
    const handler = Object.assign(context, this._handler, { task });

    Object.setPrototypeOf(Model, handler);
    Object.setPrototypeOf(Model.prototype, context);

    return Model;
  }
}
