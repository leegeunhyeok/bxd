import 'fake-indexeddb/auto';
import BoxDB from '../src/index.es';
import { TransactionTask } from '../src/core/task';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Dataset: Data[] = require('./__mocks__/users.json');

interface Data {
  _id: number;
  name: string;
  age: number;
}

describe('Basic of object store transactions via model', () => {
  const box = new BoxDB('transaction-db', 1);
  const User = box.model('user', {
    _id: {
      type: BoxDB.Types.NUMBER,
      key: true,
    },
    name: {
      type: BoxDB.Types.STRING,
      index: true,
    },
    age: BoxDB.Types.NUMBER,
  });

  test('do transaction before database open', async () => {
    await expect(async () => {
      await User.add({
        _id: 0,
        name: '',
        age: 0,
      });
    }).rejects.toThrow();
  });

  test('prepare boxdb', async () => {
    await box.open();
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
    const evalFunctions = [(value) => value.age > 70, (value) => !value.name.includes('er')];
    const users = await User.find(evalFunctions).get();
    expect(users.every((user) => evalFunctions.every((f) => f(user)))).toBeTruthy();
  });

  test('get records with filtering by cursor', async () => {
    const targetId = 30;
    const users = await User.find({
      value: BoxDB.Range.equal(targetId),
    }).get();

    const usersFromDS = Dataset.filter((user) => user._id === targetId);
    expect(users.length === usersFromDS.length).toBeTruthy();
  });

  // test('get sorted records by cursor', async () => {
  //   const reverse = await User.order(BoxDB.Order.DESC).find().get();
  //   expect(users.length === usersFromDS.length).toBeTruthy();
  // });

  test('update record by key', async () => {
    const key = 1;
    const target = Dataset.find((record) => record._id === key);
    await User.put({
      _id: 1,
      name: 'DELETED',
      age: 0,
    });

    const record = await User.get(key);
    expect(record.name).not.toEqual(target.name);
  });

  test('update records by cursor', async () => {
    const newName = 'User';
    await User.find([(value) => value._id === 1]).update({
      name: newName,
    });

    const user = await User.get(1);
    expect(user.name).toEqual(newName);
  });

  test('delete record by cursor', async () => {
    await User.delete(1);
    const record = await User.get(1);
    expect(record).toBeNull();
  });

  test('delete records by cursor', async () => {
    const filter = (value) => value.age < 10;
    const beforeCount = (await User.find([filter]).get()).length;
    await User.find([filter]).delete();
    const afterCount = (await User.find([filter]).get()).length;

    expect(beforeCount > afterCount).toBeTruthy();
  });

  test('transaction elements type checking', async () => {
    await expect(async () => {
      await box.transaction([
        User.task.delete(5),
        // Not TransactionTask instance
        {} as TransactionTask,
        {} as TransactionTask,
        {} as TransactionTask,
      ]);
    }).rejects.toThrow();
  });

  test('do multiple tasks with transaction', async () => {
    await box.transaction([
      User.task.add({ _id: 101, name: 'New User 1', age: -99 }),
      User.task.add({ _id: 102, name: 'New User 2', age: -1 }),
      User.task.delete(5),
    ]);

    const record1 = await User.get(101);
    const record2 = await User.get(5);

    expect(record1.age).toEqual(-99);
    expect(record2).toBeNull();
  });

  test('do cursor task with transaction', async () => {
    const updateValue = { name: 'UPDATED' };
    await box.transaction([
      User.task.find([(user) => user._id === 10]).update(updateValue),
      User.task.find([(user) => user._id === 11]).delete(),
    ]);

    const record1 = await User.get(10);
    const record2 = await User.get(11);

    expect(record1.name).toEqual(updateValue.name);
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

  test('interrupt transaction', async () => {
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

  test('clear all records', async () => {
    await User.clear();
    const records = await User.find().get();
    expect(records.length).toEqual(0);
  });
});
