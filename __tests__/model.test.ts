import 'fake-indexeddb/auto';
import BoxDB from '../src/index.es';
import BoxModelBuilder from '../src/core/model';

const modelArgs = {
  targetVersion: 1,
  storeName: 'test',
  scheme: {
    f1: BoxDB.Types.BOOLEAN,
    f2: BoxDB.Types.NUMBER,
    f3: BoxDB.Types.STRING,
    f4: BoxDB.Types.DATE,
    f5: BoxDB.Types.ARRAY,
    f6: BoxDB.Types.OBJECT,
    f7: BoxDB.Types.REGEXP,
    f8: BoxDB.Types.FILE,
    f9: BoxDB.Types.BLOB,
    f0: BoxDB.Types.ANY,
  },
};

const builder = BoxModelBuilder.get(null);

describe('checking about model basic features', () => {
  const TestModel = builder.build(modelArgs.targetVersion, modelArgs.storeName, modelArgs.scheme);

  test('create model and prototype check', () => {
    expect(TestModel.getVersion()).toBe(modelArgs.targetVersion);
    expect(TestModel.getName()).toBe(modelArgs.storeName);
  });

  test('create data via model', () => {
    const TestModel = builder.build(modelArgs.targetVersion, modelArgs.storeName, modelArgs.scheme);

    expect(() => {
      new TestModel({
        f1: null,
        f2: null,
        f3: null,
        f4: null,
        f5: null,
        f6: null,
        f7: null,
        f8: null,
        f9: null,
        f0: null,
      });
    }).not.toThrow();
  });

  test('model data validation', () => {
    const TestModel = builder.build(modelArgs.targetVersion, modelArgs.storeName, modelArgs.scheme);

    expect(() => {
      new TestModel({
        f1: null,
        f2: '123', // must be number
        f3: null,
        f4: null,
        f5: null,
        f6: null,
        f7: null,
        f8: null,
        f9: null,
        f0: null,
      });
    }).toThrow();

    expect(() => {
      new TestModel({
        f1: true,
        f2: 0,
        f3: 'string',
        f4: new Date(),
        f5: [],
        f6: {},
        f7: /^test$/,
        f8: new File(['text'], 'sample.txt', { type: 'text/plain', lastModified: +new Date() }),
        f9: new Blob(),
        f0: 'any',
      });
    }).not.toThrow();
  });
});
