import 'fake-indexeddb/auto';
import Box, { BoxField } from '../src';

let box: Box = null;

test('Check IndexedDB is available', () => {
  expect(self.indexedDB).not.toBe(undefined);
});

test('Create new Box instance', () => {
  const name = 'test-db';
  const version = 1;
  box = new Box(name, version);

  expect(box.databaseName).toBe(name);
  expect(box.version).toBe(version);
});

test('Create new Model', () => {
  // regist new model
  const User = box.model('user', {
    name: new BoxField(String),
    age: new BoxField(Number),
  });

  // create new data
  const user = new User();
  user.age = 10;
  user.name = 'tom';

  expect(user.age).toBe(10);
  expect(() => {
    // trying to regist same model name
    box.model('user', {
      name: new BoxField(String),
      age: new BoxField(Number),
    });
  }).toThrow();
});
