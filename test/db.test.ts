import 'fake-indexeddb/auto';

test('has idx', () => {
  expect(self.indexedDB).not.toBe(undefined);
});
