import 'fake-indexeddb/auto';
import Box, { Types } from '../src';

// global instance variable for test
let box: Box = null;

test('Create new Box instance', () => {
  const name = 'test-db';
  const version = 1;
  box = new Box(name, version);

  // #1. check basic information
  expect(box.databaseName).toBe(name);
  expect(box.version).toBe(version);
});

test('Create new Model', () => {
  // regist new model
  const User = box.model(1)('user', {
    name: Types.STRING,
    age: Types.NUMBER,
  });

  // create new data
  const user = new User();
  user.age = 10;
  user.name = 'Tom';

  User.get(1);

  // #1. change test data
  expect(user.age).toBe(10);

  // #2. create new data with initial value
  expect(() => {
    new User({
      name: 'Tom',
      age: 1,
    });
  }).not.toThrow();

  // #3. to be thrown exception
  expect(() => {
    // trying to register same target version and model name
    box.model(1)('user', {
      name: Types.STRING,
      age: Types.NUMBER,
    });
  }).toThrow();

  // #4. to be not thrown exception
  expect(() => {
    // trying to register same model name (but, diffrent target version)
    box.model(2)('user', {
      name: Types.STRING,
      age: Types.NUMBER,
    });
  }).not.toThrow();
});
