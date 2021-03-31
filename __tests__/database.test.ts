/* eslint-disable @typescript-eslint/no-empty-function */
import 'fake-indexeddb/auto';
import { BoxDBEvent } from '../src/core/database';
import BoxDB, { BoxModel } from '../src/index.es';

let version = 0;
const name = 'database-db';
const testScheme = {
  id: {
    type: BoxDB.Types.NUMBER,
    key: true,
  },
  name: {
    type: BoxDB.Types.STRING,
    index: true,
  },
  number: {
    type: BoxDB.Types.NUMBER,
    index: true,
    unique: true,
  },
  age: BoxDB.Types.NUMBER,
};

describe('Basic of BoxDB', () => {
  describe('1 of 4', () => {
    // global variable for test
    let box: BoxDB = null;
    let User = null;

    test('create instance', () => {
      box = new BoxDB(name, ++version);

      // check basic information
      expect(box.databaseName).toBe(name);
      expect(box.version).toBe(version);
    });

    test('create new model', () => {
      // Register new model
      User = box.model('user', testScheme);
      box.model('user2', testScheme);
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
          number: 0,
          age: 10,
        }),
      ).toBeTruthy();

      // Wrong scheme
      expect(
        User.prototype.__validate({
          id: 'string',
          name: 100,
          number: 0,
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
        const data1 = new User();
        data1.id = test.id;
        data1.name = test.name;
        data1.age = test.age;

        // Test data 2 (with inital value)
        const data2 = new User({
          id: test.id,
          name: test.name,
          age: test.age,
        });

        return data1.id === data2.id && data1.name === data2.name && data1.age === data2.age;
      }).toBeTruthy();
    });

    test('trying to register same model', () => {
      // trying to register same model name
      expect(() => {
        box.model('user', testScheme);
      }).toThrow();
    });

    test('trying to register same model with force option', () => {
      // trying to register same model name
      expect(() => {
        box.model('user', testScheme, { force: true });
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

    test('un/regist database event handler', () => {
      const testHandler = {
        versionchange: () => {},
        abort: () => {},
        error: () => {},
        close: () => {},
      };

      Object.entries(testHandler).forEach(([eventType, handler]) => {
        box.on(eventType as BoxDBEvent, handler);
      });

      Object.entries(testHandler).forEach(([eventType, handler]) => {
        box.off(eventType as BoxDBEvent, handler);
      });
    });

    test('close before database open', () => {
      expect(() => {
        box.close();
      }).toThrow();
    });

    test('get idb instance before database open', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (User as BoxModel<any>).getDatabase();
      }).toThrow();
    });

    test('check ready status', async () => {
      expect(box.ready).toBe(false);
      await box.open();
      expect(box.ready).toBe(true);
    });

    test('get idb instance after database open', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const idb = (User as BoxModel<any>).getDatabase();
      expect(idb).not.toBeNull();
    });

    test('check object store names', async () => {
      expect(box.modelNames().length).toBe(2); // 2 models (User, User2)
    });

    test('register new model after database open', () => {
      expect(() => {
        box.model('test', testScheme);
      }).toThrow();
    });

    test('close', () => box.close());
  });

  describe('2 of 4', () => {
    test('check about undefined model handling', async () => {
      const box = new BoxDB(name, ++version);

      // Defined models at version 1: User, User2
      // Current: User (User2 skipped -> will be deleted)
      box.model('user', testScheme);
      await box.open();
      expect(box.modelNames().length).toBe(1);
      box.close();
    });
  });

  describe('3 of 4', () => {
    // global variable for test

    test('tying to change in-line key', async () => {
      const box = new BoxDB(name, ++version);

      // At version 1: User, User2
      // current: User (User2 not define -> will be deleted)
      box.model('user', {
        ...testScheme,
        id: BoxDB.Types.ANY, // id at version 1 -> key: true
      });

      await expect(async () => {
        await box.open();
      }).rejects.toThrow();
    });

    test('tying to change out-of-line key option', async () => {
      const box = new BoxDB(name, ++version);

      // user object store at version 1 -> autoIncrement: false
      box.model('user', testScheme, { autoIncrement: true });

      await expect(async () => {
        await box.open();
      }).rejects.toThrow();
    });

    test('tying to change unique option (false to true)', async () => {
      const box = new BoxDB(name, ++version);

      box.model('user', {
        ...testScheme,
        name: {
          type: BoxDB.Types.STRING,
          index: true,
          unique: true, // name at version 1 -> unique: false
        },
      });

      await expect(async () => {
        await box.open();
      }).rejects.toThrow();
    });

    test('tying to change unique option (true to false)', async () => {
      const box = new BoxDB(name, ++version);

      box.model('user', {
        ...testScheme,
        number: {
          type: BoxDB.Types.STRING,
          index: true,
          unique: false, // number at version 1 -> unique: true
        },
      });

      await box.open();
      box.close();
    });

    test('tying to change index', async () => {
      const box = new BoxDB(name, ++version);

      // user object store at version 1 -> autoIncrement: false
      box.model('user', {
        id: {
          type: BoxDB.Types.NUMBER,
          key: true,
        },
        name: {
          type: BoxDB.Types.STRING,
          // name at version 1 -> index: true
          // Index will be deleted
          index: false,
        },
        age: {
          type: BoxDB.Types.NUMBER,
          // age at version 1 -> index: false
          // Index will be created
          index: true,
        },
      });

      await box.open();
      box.close();
    });
  });

  describe('4 of 4', () => {
    let box1 = null;

    test('open database', async () => {
      box1 = new BoxDB(name, ++version);
      await box1.open();
    });

    test('trying version update when database already opened', async () => {
      const box2 = new BoxDB(name, ++version);

      await expect(async () => {
        await box2.open();
      }).rejects.toThrow();

      box1.close();
    });
  });
});
