import 'fake-indexeddb/auto';
import BoxDB from '../src/index.es';
import { BoxModel } from '../src/core/types';

describe('Basic of BoxDB', () => {
  // global variable for test
  const testScheme = {
    id: {
      type: BoxDB.Types.NUMBER,
      key: true,
    },
    name: {
      type: BoxDB.Types.STRING,
      index: true,
    },
    age: BoxDB.Types.NUMBER,
  };
  let box: BoxDB = null;
  let OldUser: BoxModel<typeof testScheme> = null;
  let User = null;

  test('create instance', () => {
    const name = 'test-db';
    const version = 5;
    box = new BoxDB(name, version);

    // check basic information
    expect(box.databaseName).toBe(name);
    expect(box.version).toBe(version);
  });

  test('create new model', () => {
    // Register new model
    const targetVersion = 1;
    const storeName = 'user';
    OldUser = box.model(targetVersion)(storeName, testScheme);

    // Check basic
    expect(OldUser.prototype.__storeName__).toBe(storeName);
    expect(OldUser.prototype.__targetVersion__).toBe(targetVersion);

    // Check scheme
    expect(() => {
      const modelScheme = Object.keys(OldUser.prototype.__scheme__);
      return Object.keys(testScheme).every((field) => !!~modelScheme.indexOf(field));
    }).toBeTruthy();
  });

  test('model data validator', () => {
    // Correct scheme
    expect(
      OldUser.prototype.__validate({
        id: 1,
        name: 'Tom',
        age: 10,
      }),
    ).toBeTruthy();

    // Wrong scheme
    expect(
      OldUser.prototype.__validate({
        id: 'string',
        name: 100,
        age: 'string',
      }),
    ).toBeFalsy();
  });

  test('create model based data and validate', () => {
    // Create new data
    expect(() => {
      const test = {
        id: 1,
        name: 'Tom',
        age: 10,
      };

      // Test data 1 (basic)
      const user1 = new OldUser();
      user1.id = test.id;
      user1.name = test.name;
      user1.age = test.age;

      // Test data 2 (with inital value)
      const user2 = new OldUser({
        id: test.id,
        name: test.name,
        age: test.age,
      });

      return user1.id === user2.id && user1.name === user2.name && user1.age === user2.age;
    }).toBeTruthy();
  });

  test('trying to register same model', () => {
    // trying to register same target version and model name
    expect(() => {
      box.model(1)('user', testScheme);
    }).toThrow();
  });

  test('model version update', () => {
    // trying to register same model name (but, diffrent target version)
    // and set index (age)
    expect(() => {
      User = box.model(2)('user', {
        ...testScheme,
        age: {
          type: BoxDB.Types.NUMBER,
          index: true,
        },
      });
    }).not.toThrow();

    expect(() => {
      const field = User.prototype.__scheme__.age;
      return typeof field !== 'string' ? field.index : false;
    }).toBeTruthy();
  });

  test('trying to change keyPath', () => {
    // Change keyPath
    expect(() => {
      box.model(3)('user', {
        // In version 1, 2 has key
        // Now remove key option
        id: BoxDB.Types.NUMBER,
        name: {
          type: BoxDB.Types.STRING,
          index: true,
        },
        age: BoxDB.Types.NUMBER,
      });
    }).toThrow();
  });

  test('trying to change autoIncrement option', () => {
    // Change autoIncrement option
    expect(() => {
      box.model(3)('user', User.prototype.__scheme__, {
        autoIncrement: true, // before: false
      });
    }).toThrow();
  });

  test('trying to change index', () => {
    // Change index
    expect(() => {
      User = box.model(3)('user', {
        ...testScheme,
        // In version 1, 2 has index
        // Now remove index option
        name: BoxDB.Types.STRING,
        age: BoxDB.Types.NUMBER,
      });
    }).not.toThrow();
  });

  test('check ready status', async () => {
    expect(box.ready).toBe(false);
    await box.open();
    expect(box.ready).toBe(true);
  });
});
