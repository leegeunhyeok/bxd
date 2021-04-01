import BoxTransaction from './transaction';
import { TransactionTask, TransactionType } from './task';
import {
  IDBData,
  BoxData,
  BoxModel,
  BoxScheme,
  BoxDataTypes,
  CursorQuery,
  CursorOptions,
  UncheckedData,
  BoxHandler,
  BoxTask,
  IDBValue,
} from './types';
import { BoxDBError } from './errors';

// BoxModel Prototype
export interface ModelPrototype {
  tx: BoxTransaction;
  __validate(target: UncheckedData): boolean;
  __createData<T extends BoxScheme>(initalData?: BoxData<T>): BoxData<T>;
}

export interface ModelProperty {
  __name__: string;
  __scheme__: BoxScheme;
  __version__: number;
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
  const schemeKeys = Object.keys(this.__scheme__);
  const targetKeys = Object.keys(target);

  return (
    schemeKeys.length === targetKeys.length &&
    schemeKeys.every((k) => ~targetKeys.indexOf(k)) &&
    Object.entries(this.__scheme__).every(([k, v]) =>
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
  const boxData = Object.create(null) as BoxData<T>;
  Object.keys(this.__scheme__).forEach(
    (k) => (boxData[k as keyof T] = (initalData && initalData[k]) ?? null),
  );
  return boxData;
}

/**
 * Returns IDBKeyRange
 */
export const rangeBuilder = {
  equal(value: IDBValue): IDBKeyRange {
    return IDBKeyRange.only(value);
  },
  upper(value: IDBValue): IDBKeyRange {
    return IDBKeyRange.upperBound(value);
  },
  lower(value: IDBValue): IDBKeyRange {
    return IDBKeyRange.lowerBound(value);
  },
  bound(v1: IDBValue, v2: IDBValue): IDBKeyRange {
    return IDBKeyRange.bound(v1, v2);
  },
};

export default class BoxModelBuilder {
  private static _instance: BoxModelBuilder = null;
  private _prototype: ModelPrototype;
  private _handler: BoxHandler<IDBData>;
  private _task: BoxTask<IDBData>;

  static get(tx: BoxTransaction): BoxModelBuilder {
    if (!this._instance) {
      this._instance = new BoxModelBuilder(tx);
    }
    return this._instance;
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
      value: IDBData = null,
      direction: IDBCursorDirection = 'next',
      limit: number = null,
    ): CursorOptions<IDBData> => ({
      direction,
      filter: option,
      limit,
      value,
    });

    this._prototype = { tx, __validate: schemeValidator, __createData: createBoxData };
    this._handler = {
      getName(this: ModelContext) {
        return this.__name__;
      },
      getVersion(this: ModelContext) {
        return this.__version__;
      },
      add(this: ModelContext, value, key) {
        return this.tx.request(TransactionType.ADD, this.__name__, null, [value, key]);
      },
      get(this: ModelContext, key) {
        return this.tx.request(TransactionType.GET, this.__name__, null, [key]);
      },
      put(this: ModelContext, value, key) {
        return this.tx.request(TransactionType.PUT, this.__name__, null, [value, key]);
      },
      delete(this: ModelContext, key) {
        return this.tx.request(TransactionType.DELETE, this.__name__, null, [key]);
      },
      find(this: ModelContext, filter) {
        if (filter && !Array.isArray(filter)) {
          if (Object.keys(filter).length !== 1) {
            throw new BoxDBError('Cursor query object must be has only one index');
          }
        }

        return {
          get: (order, limit) =>
            this.tx.request(
              TransactionType.$GET,
              this.__name__,
              toCursorOption(filter, null, order, limit),
            ),
          update: (value) =>
            this.tx.request(TransactionType.$UPDATE, this.__name__, toCursorOption(filter, value)),
          delete: () =>
            this.tx.request(TransactionType.$DELETE, this.__name__, toCursorOption(filter)),
        };
      },
      clear(this: ModelContext) {
        return this.tx.request(TransactionType.CLEAR, this.__name__, null);
      },
      count(this: ModelContext) {
        return this.tx.request(TransactionType.COUNT, this.__name__, null);
      },
    };

    this._task = {
      add(this: ModelContext, value, key) {
        return new TransactionTask(TransactionType.ADD, this.__name__, null, [value, key]);
      },
      put(this: ModelContext, value, key) {
        return new TransactionTask(TransactionType.PUT, this.__name__, null, [value, key]);
      },
      delete(this: ModelContext, key) {
        return new TransactionTask(TransactionType.DELETE, this.__name__, null, [key]);
      },
      find(this: ModelContext, filter) {
        return {
          update: (value) =>
            new TransactionTask(TransactionType.$UPDATE, this.__name__, {
              filter,
              value,
            }),
          delete: () => new TransactionTask(TransactionType.$DELETE, this.__name__, { filter }),
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
      if (initalData && !this.__validate(initalData)) {
        throw new BoxDBError('data not valid');
      }

      // Create empty(null) object or initalData based on scheme
      return this.__createData(initalData);
    } as unknown) as BoxModel<S>;

    const context = Object.create(this._prototype) as ModelContext;
    context.__name__ = storeName;
    context.__scheme__ = scheme;
    context.__version__ = targetVersion;

    const contextObject = Object.create(context);
    const taskHandler = { task: this._task };
    Object.setPrototypeOf(taskHandler.task, contextObject);

    const handler = Object.assign(contextObject, this._handler, taskHandler);
    Object.setPrototypeOf(Model, handler);
    Object.setPrototypeOf(Model.prototype, context);

    return Model;
  }
}
