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
 * Create  new model
 *
 * @param storeName Object store name
 * @param scheme Data scheme
 */
export const createModel = <S extends BoxScheme>(
  targetVersion: number,
  storeName: string,
  scheme: S,
): BoxModel<S> => {
  function Model<S extends BoxScheme>(this: BoxModelPrototype, initalData?: BoxData<S>) {
    this.__ok();

    // Check scheme if initial data provided
    if (initalData && !this.__validate(initalData)) {
      throw new BoxDBError('data not valid');
    }

    // Create empty(null) object or initalData based on scheme
    Object.assign(this, mergeObject(this.__scheme__, initalData));
  }

  const prototype = {
    __tx__: null,
    __available__: false,
    __targetVersion__: targetVersion,
    __storeName__: storeName,
    __scheme__: scheme,
    __validate: schemeValidator,
    __ok: mustAvailable,
  } as BoxModelPrototype;

  Model.prototype = prototype;
  Model.getName = () => prototype.__storeName__;
  Model.getVersion = () => prototype.__targetVersion__;

  // Model transaction handler (static)
  Model.add = (value, key) =>
    prototype.__ok() && prototype.__tx__.add(prototype.__storeName__, value, key);
  Model.get = (key) => prototype.__ok() && prototype.__tx__.get(prototype.__storeName__, key);
  Model.put = (value, key) =>
    prototype.__ok() && prototype.__tx__.put(prototype.__storeName__, value, key);
  Model.delete = (key) => prototype.__ok() && prototype.__tx__.delete(prototype.__storeName__, key);
  Model.clear = () => prototype.__ok() && prototype.__tx__.clear(prototype.__storeName__);

  Model.find = (filter) => {
    prototype.__ok();

    if (filter && !Array.isArray(filter)) {
      if (Object.keys(filter).length !== 1) {
        throw new BoxDBError('Cursor query object must be has only one index');
      }
    }

    return {
      get: () =>
        prototype.__tx__.cursor<typeof TransactionType.CURSOR_GET, S>(
          TransactionType.CURSOR_GET,
          prototype.__storeName__,
          filter,
          null,
        ),
      update: (value) =>
        prototype.__tx__.cursor<typeof TransactionType.CURSOR_UPDATE, S>(
          TransactionType.CURSOR_UPDATE,
          prototype.__storeName__,
          filter,
          value,
        ),
      delete: () =>
        prototype.__tx__.cursor<typeof TransactionType.CURSOR_DELETE, S>(
          TransactionType.CURSOR_DELETE,
          prototype.__storeName__,
          filter,
          null,
        ),
    };
  };

  Model.task = {
    add: (value, key) =>
      prototype.__ok() &&
      new TransactionTask(TransactionType.ADD, prototype.__storeName__, TransactionMode.WRITE, [
        value,
        key,
      ]),
    put: (value, key) =>
      prototype.__ok() &&
      new TransactionTask(TransactionType.PUT, prototype.__storeName__, TransactionMode.WRITE, [
        value,
        key,
      ]),
    delete: (key) =>
      prototype.__ok() &&
      new TransactionTask(TransactionType.DELETE, prototype.__storeName__, TransactionMode.WRITE, [
        key,
      ]),
    find: (filter) =>
      prototype.__ok() && {
        update: (value) =>
          new TransactionTask(
            TransactionType.CURSOR_UPDATE,
            prototype.__storeName__,
            TransactionMode.WRITE,
            [
              {
                filter,
                updateValue: value,
              },
            ],
          ),
        delete: () =>
          new TransactionTask(
            TransactionType.CURSOR_DELETE,
            prototype.__storeName__,
            TransactionMode.WRITE,
            [{ filter }],
          ),
      },
  };

  return (Model as unknown) as BoxModel<S>;
};
