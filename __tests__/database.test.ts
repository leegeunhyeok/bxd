/* eslint-disable @typescript-eslint/no-empty-function */
import 'fake-indexeddb/auto';
import BoxDB from '../src/index.es';

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
    let db: BoxDB = null;
    let User = null;

    test('create instance', () => {
      db = new BoxDB(name, ++version);

      // check basic information
      expect(db.getName()).toBe(name);
      expect(db.getVersion()).toBe(version);
    });

    test('create new model', () => {
      // Register new model
      User = db.box('user', testScheme);
      db.box('user2', testScheme); // unused
      db.box('temp', { data: BoxDB.Types.ANY }); // unused
    });

    test('create new model with multiple key', () => {
      expect(() => {
        // has 2 keys
        db.box('test', {
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
      expect(() => {
        User.prototype.pass({
          id: 1,
          name: 'Tom',
          number: 0,
          age: 10,
        });
      }).not.toThrow();

      // Wrong scheme
      expect(() => {
        User.prototype.pass({
          id: 'string',
          name: 100,
          number: 0,
          age: 'string',
        });
      }).toThrow();
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
        db.box('user', testScheme);
      }).toThrow();
    });

    test('trying to unique option without index', () => {
      expect(() => {
        db.box('user_test', {
          ...testScheme,
          age: {
            type: BoxDB.Types.NUMBER,
            unique: true, // without index
          },
        });
      }).toThrow();
    });

    test('close before database open', () => {
      expect(() => {
        db.close();
      }).toThrow();
    });

    test('check ready status', async () => {
      expect(db.isReady()).toBe(false);
      await db.open();
      expect(db.isReady()).toBe(true);
    });

    test('check idb instance', async () => {
      expect(db.getDB()).not.toBeNull();
    });

    test('register new model after database open', () => {
      expect(() => {
        db.box('test', testScheme);
      }).toThrow();
    });

    test('close', () => db.close());
  });

  describe('2 of 4', () => {
    // global variable for test

    test('tying to change in-line key', async () => {
      const db = new BoxDB(name, ++version);

      // At version 1: User, User2
      // current: User (User2 not define -> will be deleted)
      db.box('user', {
        ...testScheme,
        id: BoxDB.Types.ANY, // id at version 1 -> key: true
      });

      await expect(async () => {
        await db.open();
      }).rejects.toThrow();
    });

    test('tying to change out-of-line key option', async () => {
      const db = new BoxDB(name, ++version);

      // user object store at version 1 -> autoIncrement: false
      db.box('user', testScheme, { autoIncrement: true });

      await expect(async () => {
        await db.open();
      }).rejects.toThrow();
    });

    test('tying to change unique option (false to true)', async () => {
      const db = new BoxDB(name, ++version);

      db.box('user', {
        ...testScheme,
        name: {
          type: BoxDB.Types.STRING,
          index: true,
          unique: true, // name at version 1 -> unique: false
        },
      });

      await expect(async () => {
        await db.open();
      }).rejects.toThrow();
    });

    test('tying to change unique option (true to false)', async () => {
      const db = new BoxDB(name, ++version);

      db.box('user', {
        ...testScheme,
        number: {
          type: BoxDB.Types.STRING,
          index: true,
          unique: false, // number at version 1 -> unique: true
        },
      });

      await db.open();
      db.close();
    });

    test('tying to change index', async () => {
      const db = new BoxDB(name, ++version);

      // user object store at version 1 -> autoIncrement: false
      db.box('user', {
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

      await db.open();
      db.close();
    });
  });

  describe('3 of 4', () => {
    test('trying to register same model with force option', async () => {
      const db = new BoxDB(name, ++version);

      // trying to register same model name
      db.box('user', testScheme, { force: true });
      await db.open();
      db.close();
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
