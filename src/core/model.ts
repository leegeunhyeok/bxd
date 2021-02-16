import BoxTransaction from './transaction';
import { TransactionTask, TransactionMode, TransactionType } from './task';
import { BoxDBError } from './errors';
import {
  BoxData,
  BoxModel,
  BoxModelPrototype,
  BoxScheme,
  BoxDataTypes,
  UncheckedData,
} from './types';

/**
 * Check about target value has same type with type identifier
 *
 * @param type Type identifier (from enum)
 * @param value Value for check
 */
export const typeValidator = (type: BoxDataTypes, value: UncheckedData): boolean => {
  const targetPrototype = value.__proto__;

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
    default:
      return false;
  }
};

/**
 * Merge object to base object
 *
 * @param baseObject
 * @param targetObject
 */
export const mergeObject = <T>(baseObject: T, targetObject?: T): T => {
  Object.keys(baseObject).forEach((k) => {
    baseObject[k] = (targetObject && targetObject[k]) || null;
  });
  return baseObject;
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
const schemeValidator = function (this: BoxModelPrototype, target: UncheckedData): boolean {
  const schemeKeys = Object.keys(this.__scheme__);
  const targetKeys = Object.keys(target);

  return (
    schemeKeys.length === targetKeys.length &&
    schemeKeys.every((k) => ~targetKeys.indexOf(k)) &&
    Object.entries(this.__scheme__).every(([k, v]) =>
      typeValidator(typeof v === 'string' ? v : v.type, target[k]),
    )
  );
};

/**
 * Check this model is available
 *
 * @param this Model
 */
const mustAvailable = function (this: BoxModelPrototype): true | never {
  if (!this.__available__) {
    throw new BoxDBError('This model is not available');
  }
  return true;
};

/**
 * Box model initializer
 *
 * @param this Model
 * @param tx Transaction manager
 */
const init = function (this: BoxModelPrototype, tx: BoxTransaction) {
  Object.defineProperty(this, '__available__', { value: true, enumerable: true });
  Object.defineProperty(this, '__tx__', { value: tx });
};

/**
 * Model.toString handler
 *
 * @param this Model
 */
const toString = function (this: BoxModelPrototype) {
  return `BoxModel(${this.__storeName__}):${this.__targetVersion__}`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const define = <T>(o: T, key: string, value: any, editable = false) =>
  Object.defineProperty(o, key, { value, configurable: editable });

/**
 * Generate new model
 *
 * @param storeName Object store name
 * @param scheme Data scheme
 */
export const generateModel = <S extends BoxScheme>(
  targetVersion: number,
  storeName: string,
  scheme: S,
): BoxModel<S> => {
  const Model = (function Model(this: BoxModelPrototype, initalData?: BoxData<S>) {
    // Check scheme if initial data provided
    if (initalData && !this.__validate(initalData)) {
      throw new BoxDBError('data not valid');
    }

    // Create empty(null) object or initalData based on scheme
    Object.assign(this, mergeObject(scheme, initalData));
  } as unknown) as BoxModel<S>;

  // Model prototype
  define(Model.prototype, '__tx__', null, true);
  define(Model.prototype, '__available__', false, true);
  define(Model.prototype, '__targetVersion__', targetVersion);
  define(Model.prototype, '__storeName__', storeName);
  define(Model.prototype, '__scheme__', scheme);
  define(Model.prototype, '__validate', schemeValidator.bind(Model.prototype));
  define(Model.prototype, '__mustAvailable', mustAvailable.bind(Model.prototype));

  // Model static fields
  define(Model, '__init', init.bind(Model.prototype));
  define(Model, 'name', storeName);
  define(Model, 'version', targetVersion);
  define(Model, 'toString', toString.bind(Model.prototype));

  // Model transaction handler (static)
  Model.add = function (value, key) {
    const ctx = this.prototype;
    return ctx.__mustAvailable() && ctx.__tx__.add(ctx.__storeName__, value, key);
  };

  Model.get = function (key) {
    const ctx = this.prototype;
    return ctx.__mustAvailable() && ctx.__tx__.get(ctx.__storeName__, key);
  };

  Model.put = function (value, key) {
    const ctx = this.prototype;
    return ctx.__mustAvailable() && ctx.__tx__.put(ctx.__storeName__, value, key);
  };

  Model.delete = function (key) {
    const ctx = this.prototype;
    return ctx.__mustAvailable() && ctx.__tx__.delete(ctx.__storeName__, key);
  };

  Model.clear = function () {
    const ctx = this.prototype;
    return ctx.__mustAvailable() && ctx.__tx__.clear(ctx.__storeName__);
  };

  Model.find = function (filter) {
    const ctx = this.prototype;
    ctx.__mustAvailable();

    if (filter && !Array.isArray(filter)) {
      if (Object.keys(filter).length !== 1) {
        throw new BoxDBError('Cursor query object must be has only one index');
      }
    }

    return {
      get() {
        return ctx.__tx__.cursor<typeof TransactionType.CURSOR_GET, S>(
          TransactionType.CURSOR_GET,
          ctx.__storeName__,
          filter,
          null,
        );
      },
      update(value) {
        return ctx.__tx__.cursor<typeof TransactionType.CURSOR_UPDATE, S>(
          TransactionType.CURSOR_UPDATE,
          ctx.__storeName__,
          filter,
          value,
        );
      },
      delete() {
        return ctx.__tx__.cursor<typeof TransactionType.CURSOR_DELETE, S>(
          TransactionType.CURSOR_DELETE,
          ctx.__storeName__,
          filter,
          null,
        );
      },
    };
  };

  Model.task = {
    __ctx__: Model.prototype,
    add(value, key) {
      const ctx = this.__ctx__;
      return (
        ctx.__mustAvailable() &&
        new TransactionTask(TransactionType.ADD, ctx.__storeName__, TransactionMode.WRITE, [
          value,
          key,
        ])
      );
    },
    put(value, key) {
      const ctx = this.__ctx__;
      return (
        ctx.__mustAvailable() &&
        new TransactionTask(TransactionType.PUT, ctx.__storeName__, TransactionMode.WRITE, [
          value,
          key,
        ])
      );
    },
    delete(key) {
      const ctx = this.__ctx__;
      return (
        ctx.__mustAvailable() &&
        new TransactionTask(TransactionType.DELETE, ctx.__storeName__, TransactionMode.WRITE, [key])
      );
    },
    find(filter) {
      const ctx = this.__ctx__;
      ctx.__mustAvailable();

      return {
        update(value) {
          return new TransactionTask(
            TransactionType.CURSOR_UPDATE,
            ctx.__storeName__,
            TransactionMode.WRITE,
            [
              {
                filter,
                updateValue: value,
              },
            ],
          );
        },
        delete() {
          return new TransactionTask(
            TransactionType.CURSOR_DELETE,
            ctx.__storeName__,
            TransactionMode.WRITE,
            [{ filter }],
          );
        },
      };
    },
  };

  return Model;
};
