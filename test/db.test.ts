import 'fake-indexeddb/auto';
import Box from '../src';

test('Check IndexedDB is available', () => {
  expect(self.indexedDB).not.toBe(undefined);
});

test('Create new Box instance', () => {
  const name = 'test-db';
  const version = 1;
  const box = new Box(name, version);

  expect(box.databaseName).toBe(name);
  expect(box.version).toBe(version);
});
