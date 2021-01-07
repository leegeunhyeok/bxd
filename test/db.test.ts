import 'fake-indexeddb/auto';

test('Check IndexedDB is available', () => {
  expect(self.indexedDB).not.toBe(undefined);
});
