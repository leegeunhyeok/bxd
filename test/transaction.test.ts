import 'fake-indexeddb/auto';
import BoxDB from '../src/index.es';
import { BoxModel } from '../src/core/model';

describe('Basic of object store transactions via model', () => {
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
  };

  // Initial records
  const testRecords = [
    {
      id: 1,
      name: 'First',
      code: 200,
    },
    {
      id: 2,
      name: 'Second',
      code: 302,
    },
    {
      id: 3,
      name: 'Third',
      code: 404,
    },
  ];

  const box = new BoxDB('test-db', 2);
  const OldUser = box.model(1)('user', testScheme);
  const User = box.model(2)('user', {
    ...testScheme,
    code: BoxDB.Types.NUMBER,
  });

  test('prepare boxdb', async () => {
    await box.open();
  });

  test('trying to use old model', async () => {
    expect.assertions(1);
    await expect(OldUser.get(1)).rejects.toThrow();
  });

  test('add records', async () => {
    for (const record of testRecords) {
      await User.add(record);
    }
  });

  test('get record by key', async () => {
    const key = 1;
    const target = testRecords.find((record) => record.id === key);
    const record1 = await User.get(key);
    const record2 = await User.get(100);
    expect(record1).toEqual(target);
    expect(record2).toBeNull();
  });
});
