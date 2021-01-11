import 'fake-indexeddb/auto';
import Box, { BoxField } from '../src';

// global instance variable for test
let box: Box = null;

test('Check IndexedDB is available', () => {
  // #1. checking about idb supports
  expect(self.indexedDB).not.toBe(undefined);
});

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
    name: new BoxField(String),
    age: new BoxField(Number),
  });

  // create new data
  const user = new User();
  user.age = 10;
  user.name = 'tom';

  // #1. change test data
  expect(user.age).toBe(10);

  // #2. to be thrown exception
  expect(() => {
    // trying to register same target version and model name
    box.model(1)('user', {
      name: new BoxField(String),
      age: new BoxField(Number),
    });
  }).toThrow();

  // #3. to be not thrown exception
  expect(() => {
    // trying to register same model name (with diffrent target version)
    box.model(2)('user', {
      name: new BoxField(String),
      age: new BoxField(Number),
    });
  }).not.toThrow();
});
