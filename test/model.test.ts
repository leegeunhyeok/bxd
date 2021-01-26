import 'fake-indexeddb/auto';
import BoxDB from '../src/index.es';
import { generateModel } from '../src/core/model';

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

describe('checking about model basic methods', () => {
  test('create model and prototype check', () => {
    const TestModel = generateModel(modelArgs.targetVersion, modelArgs.storeName, modelArgs.scheme);
    expect(TestModel.prototype.__targetVersion__).toBe(modelArgs.targetVersion);
    expect(TestModel.prototype.__storeName__).toBe(modelArgs.storeName);
  });

  test('model data validation test', () => {
    const TestModel = generateModel(modelArgs.targetVersion, modelArgs.storeName, modelArgs.scheme);

    expect(() => {
      new TestModel({
        _id: '1', // must be number
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
