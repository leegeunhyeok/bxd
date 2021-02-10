import 'fake-indexeddb/auto';
import BoxDB from '../src/index.es';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Dataset = require('./mock/users.json');

describe('Basic of object store transactions via model', () => {
  // global variable for test
  const testScheme = {
    _id: {
      type: BoxDB.Types.NUMBER,
      key: true,
    },
    name: {
      type: BoxDB.Types.STRING,
      index: true,
    },
  };

  const box = new BoxDB('transaction-db', 2);
  const OldUser = box.model(1)('user', testScheme);
  const User = box.model(2)('user', {
    ...testScheme,
    age: BoxDB.Types.NUMBER,
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
    for (const record of Dataset) {
      await User.add(record);
    }
  });

  test('get record by key', async () => {
    const key = 1;
    const target = Dataset.find((record) => record._id === key);
    const record1 = await User.get(key);
    const record2 = await User.get(-1);
    expect(record1).toEqual(target);
    expect(record2).toBeNull();
  });

  test('get records by cursor', async () => {
    const users = await User.find([
      (value) => value.age > 70,
      (value) => !~value.name.indexOf('er'),
    ]).get();

    expect(users.every((user) => user.age > 70)).toBeTruthy();
  });

  test('update records by cursor', async () => {
    const newName = 'User';
    await User.find([(value) => value._id === 1]).update({
      name: newName,
    });

    const user = await User.get(1);
    expect(user.name).toEqual(newName);
  });

  test('delete records by cursor', async () => {
    const filter = (value) => value.age < 10;
    const beforeCount = (await User.find([filter]).get()).length;
    await User.find([filter]).delete();
    const afterCount = (await User.find([filter]).get()).length;

    expect(beforeCount > afterCount).toBeTruthy();
  });

  test('do multiple tasks with transaction', async () => {
    const emptyRes = await box.transaction([
      User.task.add({ _id: 101, name: 'New User 1', age: -99 }),
      User.task.add({ _id: 102, name: 'New User 2', age: -1 }),
      User.task.delete(5),
    ]);

    const record1 = await User.get(101);
    const record2 = await User.get(5);

    expect(emptyRes).toBeUndefined();
    expect(record1.age).toEqual(-99);
    expect(record2).toBeNull();
  });

  test('handling errors in transaction', async () => {
    try {
      await box.transaction([
        User.task.put({ _id: 101, name: 'New User 1 updated', age: -999 }), // before age: -99
        User.task.put({ _id: 102, name: 'New User 2 updated', age: -111 }), // before age: -1
        User.task.add({ _id: 103, name: 'Duplicated', age: 0 }),
        User.task.add({ _id: 103, name: 'Duplicated', age: 1 }), // ConstraintError: id 103 already exist
      ]);
    } catch (e) {
      // Empty
    }

    // Transaction failed. (will be rollback to before transaction)
    const record1 = await User.get(101);
    const record2 = await User.get(102);
    expect(record1.age).not.toBe(-999);
    expect(record2.age).not.toBe(-111);
  });

  test('handling transaction aborts', async () => {
    try {
      await box.transaction([
        User.task.put({ _id: 101, name: 'User 1', age: 0 }), // before age: -99
        BoxDB.interrupt(),
        User.task.add({ _id: 102, name: 'User 2', age: 0 }), // before age: -1
      ]);
    } catch (e) {
      // Empty
    }

    // Transaction aborted. (will be rollback to before transaction)
    const record1 = await User.get(101);
    const record2 = await User.get(102);
    expect(record1.age).toBe(-99);
    expect(record2.age).toBe(-1);
  });

  test('clear all records from object store', async () => {
    await User.clear();
    const records = await User.find().get();
    expect(records.length).toBe(0);
  });
});
