/* eslint-disable @typescript-eslint/no-empty-function */
import 'fake-indexeddb/auto';
import BoxDB from '../src/index.es';

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
    User = box.model('user', testScheme);
  });

  test('create new model with multiple key', () => {
    expect(() => {
      // has 2 keys
      box.model('test', {
        field_1: {
          type: BoxDB.Types.NUMBER,
          key: true,
        },
        field_2: {
          type: BoxDB.Types.NUMBER,
          key: true,
        },
      });
    }).toThrow();
  });

  test('model data validator', () => {
    // Correct scheme
    expect(
      User.prototype.__validate({
        id: 1,
        name: 'Tom',
        age: 10,
      }),
    ).toBeTruthy();

    // Wrong scheme
    expect(
      User.prototype.__validate({
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
      const user1 = new User();
      user1.id = test.id;
      user1.name = test.name;
      user1.age = test.age;

      // Test data 2 (with inital value)
      const user2 = new User({
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
      box.model('user', testScheme);
    }).toThrow();
  });

  test('trying to change autoIncrement option', () => {
    // Change autoIncrement option
    expect(() => {
      box.model('user', User.prototype.__scheme__, {
        autoIncrement: true, // before: false
      });
    }).toThrow();
  });

  test('trying to unique option without index', () => {
    expect(() => {
      box.model('user_test', {
        ...testScheme,
        age: {
          type: BoxDB.Types.NUMBER,
          unique: true, // without index
        },
      });
    }).toThrow();
  });

  test('regist database event handler', () => {
    // TODO: box.off
    box.on('versionchange', () => {});
    box.on('abort', () => {});
    box.on('error', () => {});
    box.on('close', () => {});
  });

  test('check ready status', async () => {
    expect(box.ready).toBe(false);
    await box.open();
    expect(box.ready).toBe(true);
  });

  test('register new model after database open', () => {
    expect(() => {
      box.model('test', testScheme);
    }).toThrow();
  });
});
