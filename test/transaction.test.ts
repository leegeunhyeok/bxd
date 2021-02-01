import 'fake-indexeddb/auto';
import BoxDB from '../src/index.es';

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
    {
      id: 4,
      name: '???',
      code: -1,
    },
  ];

  const box = new BoxDB('transaction-db', 2);
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
    try {
      await OldUser.get(1);
    } catch (e) {
      expect(e.message).toEqual('This model is not available');
    }
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

  test('get records by cursor', async () => {
    const users = await User.find([
      (value) => value.code > 300,
      (value) => !~value.name.indexOf('ird'),
    ]).get();

    expect(users.length).toEqual(1);
  });

  test('update records by cursor', async () => {
    const newName = 'success';
    await User.find([(value) => value.id === 1]).update({
      name: newName,
    });

    const user = await User.get(1);
    expect(user.name).toEqual(newName);
  });

  test('delete records by cursor', async () => {
    await User.find([(value) => value.code < 0]).delete();

    const user = await User.get(4);
    expect(user).toBeNull();
  });

  test('do multiple tasks with transaction', async () => {
    const emptyRes = await box.transaction([
      User.task.add({ id: 5, name: 'unknown', code: -1 }),
      User.task.add({ id: 6, name: 'critial', code: -99 }),
      User.task.delete(5),
    ]);

    const record1 = await User.get(6);
    const record2 = await User.get(5);

    expect(emptyRes).toBeUndefined();
    expect(record1.code).toEqual(-99);
    expect(record2).toBeNull();
  });

  test('handling errors in transaction', async () => {
    try {
      await box.transaction([
        User.task.put({ id: 6, name: 'critial', code: -999 }), // before code: -99
        User.task.add({ id: 7, name: 'empty', code: 0 }),
        User.task.add({ id: 7, name: 'empty 2', code: 1 }), // ConstraintError: id 7 already exist
      ]);
    } catch (e) {
      // Empty
    }

    // Transaction failed. (will be rollback to before transaction)
    const record = await User.get(6);
    expect(record.code).toBe(-99);
  });

  test('handling transaction aborts', async () => {
    try {
      await box.transaction([
        User.task.put({ id: 6, name: 'critial', code: -999 }), // before code: -99
        BoxDB.interrupt(),
        User.task.add({ id: 7, name: 'empty', code: 0 }),
      ]);
    } catch (e) {
      // Empty
    }

    // Transaction aborted. (will be rollback to before transaction)
    const record = await User.get(6);
    expect(record.code).toBe(-99);
  });
});
