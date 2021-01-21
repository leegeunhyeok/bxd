import 'fake-indexeddb/auto';
import Box, { Types } from '../src';

// global instance variable for test
let box: Box = null;

test('Create new Box instance', () => {
  const name = 'test-db';
  const version = 5;
  box = new Box(name, version);

  // #1. check basic information
  expect(box.databaseName).toBe(name);
  expect(box.version).toBe(version);
});

test('Create new Model', () => {
  // regist new model
  const User = box.model(1)('user', {
    id: {
      type: Types.NUMBER,
      key: true,
    },
    name: {
      type: Types.STRING,
      index: true,
    },
    age: Types.NUMBER,
  });

  // #2. create new data
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

  // #3. trying to register same target version and model name
  expect(() => {
    try {
      box.model(1)('user', {
        id: {
          type: Types.NUMBER,
          key: true,
        },
        name: {
          type: Types.STRING,
          index: true,
        },
        age: Types.NUMBER,
      });
    } catch (e) {
      console.log(e.message);
      throw e;
    }
  }).toThrow();

  // #4. trying to register same model name (but, diffrent target version)
  expect(() => {
    box.model(2)('user', {
      id: {
        type: Types.NUMBER,
        key: true,
      },
      name: {
        type: Types.STRING,
        index: true,
      },
      age: {
        type: Types.NUMBER,
      },
    });
  }).not.toThrow();
});

test('Try change keyPath/index', () => {
  // Change keyPath
  expect(() => {
    try {
      box.model(3)('user', {
        // In version 1, 2 has key
        // Now remove key option
        id: Types.NUMBER,
        name: {
          type: Types.STRING,
          index: true,
        },
        age: Types.NUMBER,
      });
    } catch (e) {
      console.log(e.message);
      throw e;
    }
  }).toThrow();

  // Change index
  expect(() => {
    box.model(3)('user', {
      id: {
        type: Types.NUMBER,
        key: true,
      },
      // In version 1, 2 has index
      // Now remove index option
      name: Types.STRING,
      age: Types.NUMBER,
    });
  });
});
