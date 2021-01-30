/* eslint-disable @typescript-eslint/no-explicit-any */
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
const typeValidator = (type: BoxDataTypes, value: any): boolean => {
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
    case BoxDataTypes.ANY:
      return true; // any
    default:
      return false;
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

const mergeObject = <T>(baseObject: T, targetObject?: T): T => {
  Object.keys(baseObject).forEach((k) => {
    baseObject[k] = (targetObject && targetObject[k]) || null;
  });
  return baseObject;
};

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
  Object.assign(Model.prototype, {
    __targetVersion__: targetVersion,
    __storeName__: storeName,
    __scheme__: scheme,
    __validate: schemeValidator.bind(Model.prototype),
  });

  // Model static fields
  Object.defineProperty(Model, 'name', { value: storeName });

  return Model;
};
