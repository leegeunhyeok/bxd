import 'fake-indexeddb/auto';
import BoxDB from '../src/index.es';
import { createModel, mergeObject } from '../src/core/model';

const modelArgs = {
  targetVersion: 1,
  storeName: 'test',
  scheme: {
    _id: {
      type: BoxDB.Types.NUMBER,
      key: true,
    },
    name: BoxDB.Types.STRING,
  },
};

describe('model util functions', () => {
  test('mergeObject()', () => {
    const base = {
      name: 'before',
    };

    const target = {
      name: 'after',
    };

    const merged = mergeObject(base, target);
    expect(merged.name).toBe(target.name);
  });
});

describe('checking about model basic features', () => {
  test('create model and prototype check', () => {
    const TestModel = createModel(modelArgs.targetVersion, modelArgs.storeName, modelArgs.scheme);

    expect(TestModel.getVersion()).toBe(modelArgs.targetVersion);
    expect(TestModel.getName()).toBe(modelArgs.storeName);
  });

  test('model data validation', () => {
    const TestModel = createModel(modelArgs.targetVersion, modelArgs.storeName, modelArgs.scheme);
    TestModel.prototype.__available__ = true; // for testing

    expect(() => {
      new TestModel({
        _id: 'wrong_value', // must be number
        name: 'test',
      });
    }).toThrow();

    expect(() => {
      new TestModel({
        _id: 1,
        name: 'test',
      });
    }).not.toThrow();
  });
});
