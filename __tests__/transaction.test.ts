import 'fake-indexeddb/auto';
import { datatype } from 'faker';
import BoxDB from '../src/index.es';

import { UserFactory } from './fixtures';

const userList = UserFactory.buildList(50);

describe('Transaction', () => {
  const db = new BoxDB('transaction-db', 1);
  const User = db.create('user', {
    _id: {
      type: BoxDB.Types.NUMBER,
      key: true,
    },
    name: {
      type: BoxDB.Types.STRING,
      index: true,
    },
    phone: {
      type: BoxDB.Types.STRING,
      index: true,
    },
    age: BoxDB.Types.NUMBER,
  });

  describe('when to transaction before database is opened', () => {
    it('should throw error', async () => {
      await expect(async () => {
        await User.add({
          _id: 0,
          name: '',
          phone: '',
          age: 0,
        });
      }).rejects.toThrow();
    });
  });

  describe('when database is ready', () => {
    beforeAll(async () => {
      await db.open();
    });

    describe('when call add() with valid value', () => {
      it('should add records successfully', async () => {
        const setHasError = jest.fn();
        try {
          for (const record of userList) {
            await User.add(record);
          }
        } catch (_) {
          setHasError();
        }
        expect(setHasError).not.toBeCalled();
      });
    });

    describe('when call count()', () => {
      it('should returns all records count in object store', async () => {
        const count = await User.count();
        expect(count).toEqual(userList.length);
      });
    });

    describe('when call get()', () => {
      describe('when call with exist key', () => {
        it('should returns specified data', async () => {
          const key = 1;
          const target = userList.find((record) => record._id === key);
          expect(await User.get(key)).toEqual(target);
        });
      });

      describe('when call with non-existent key', () => {
        it('should returns null', async () => {
          expect(await User.get(-1)).toBeNull();
        });
      });
    });

    describe('when call find() with range', () => {
      describe('when call get() without index name', () => {
        it('should returns corresponding records', async () => {
          const targetId = 30;
          const users = await User.find({
            value: BoxDB.Range.equal(targetId),
          }).get();

          const filteredList = userList.filter((user) => user._id === targetId);
          expect(users.length === filteredList.length).toBeTruthy();
        });
      });

      describe('when call get() with index name', () => {
        it('should returns corresponding records', async () => {
          const userIndex = datatype.number({ min: 10, max: userList.length });
          const targetName = userList[userIndex].name;
          const users = await User.find({
            value: BoxDB.Range.equal(targetName),
            index: 'name', // search from name index
          }).get();

          const filteredLis = userList.filter((user) => user.name === targetName);
          expect(users.length === filteredLis.length).toBeTruthy();
          expect(users[userIndex].name).toEqual(targetName);
        });
      });

      describe('when call get() with undefined index name', () => {
        test('should throw error', async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const range: any = {
            range: BoxDB.Range.equal('value'),
            index: 'undefined_field', // undefined field name
          };

          await expect(async () => {
            await User.find(range).get();
          }).rejects.toThrow();
        });
      });
    });

    describe('when call find() with filter ', () => {
      describe('when call get()', () => {
        it('should returns corresponding records', async () => {
          const filters = [(value) => value.age > 70, (value) => !value.name.includes('er')];
          const users = await User.find(null, ...filters).get();
          expect(users.every((user) => filters.every((f) => f(user)))).toBeTruthy();
        });
      });

      describe('when call get() with limit', () => {
        it('should returns corresponding records', async () => {
          const limit = datatype.number({ min: 1, max: userList.length });
          const users = await User.find().get(null, limit);
          expect(users.length).toEqual(limit);
        });
      });

      describe('when call get() with order', () => {
        test('should returns ordered list', async () => {
          const forward = await User.find().get(BoxDB.Order.ASC, 1); // default
          const reverse = await User.find().get(BoxDB.Order.DESC, 1);

          const firstRecord = userList[0];
          const lastRecord = userList[userList.length - 1];

          expect(forward[0]._id).toEqual(firstRecord._id);
          expect(reverse[0]._id).toEqual(lastRecord._id);
        });
      });
    });

    describe('when call put() with exist key', () => {
      it('should update record successfully', async () => {
        const key = datatype.number({ min: 10, max: userList.length });
        const target = userList.find((record) => record._id === key);
        await User.put({
          _id: key,
          name: 'DELETED',
        });

        const record = await User.get(key);
        expect(record.name).not.toEqual(target?.name);
      });
    });

    describe('when call find().update() with value', () => {
      it('update records by cursor', async () => {
        const userId = datatype.number({ min: 10, max: userList.length });
        const newName = 'NewName';
        await User.find(null, (data) => data._id === userId).update({
          name: newName,
        });

        const user = await User.get(userId);
        expect(user.name).toEqual(newName);
      });
    });

    describe('when call delete() with exist key', () => {
      it('should delete specified record', async () => {
        const userId = datatype.number({ min: 1, max: 9 });
        await User.delete(userId);
        const record = await User.get(userId);
        expect(record).toBeNull();
      });
    });

    describe('when call find().delete()', () => {
      it('should delete corresponding records', async () => {
        const filters = [(value) => value.age < 10, (value) => value._id < 10];
        const beforeCount = (await User.find(null, ...filters).get()).length;
        await User.find(null, ...filters).delete();
        const afterCount = (await User.find(null, ...filters).get()).length;

        expect(beforeCount >= afterCount).toBeTruthy();
      });
    });

    describe('when call transaction() with tasks', () => {
      it('should done transaction tasks successfully', async () => {
        const deleteId = 5;
        const newId = datatype.number({ min: 9999, max: 100000 });
        const newUser = UserFactory.build({ _id: newId });

        await db.transaction(User.$delete(deleteId), User.$add(newUser));

        const record1 = await User.get(deleteId);
        const record2 = await User.get(newId);

        expect(record1).toBeNull();
        expect(record2.name).toBe(newUser.name);
      });

      it('should done transaction cursor tasks successfully', async () => {
        const updateValue = { name: 'UPDATED' };
        await db.transaction(
          User.$find(null, (user) => user._id === 17).update(updateValue),
          User.$find(null, (user) => user._id === 18).delete(),
        );

        const record1 = await User.get(17);
        const record2 = await User.get(18);

        expect(record1.name).toEqual(updateValue.name);
        expect(record2).toBeNull();
      });

      describe('when error occurs during transaction', () => {
        it('should rollback state before transaction', async () => {
          try {
            await db.transaction(
              User.$put({ _id: 11, name: 'New User 1 updated', age: -999 }), // before age: -99
              User.$put({ _id: 12, name: 'New User 2 updated', age: -111 }), // before age: -1
              User.$add({ _id: 13, name: 'Duplicated', age: 0, phone: '' }), // ConstraintError: _id 3 already exist
              User.$add({ _id: 14, name: 'New name', age: 1, phone: '' }),
            );
          } catch (_) {
            /* empty */
          }

          const record1 = await User.get(11);
          const record2 = await User.get(12);
          expect(record1.age).not.toBe(-999);
          expect(record2.age).not.toBe(-111);
        });
      });

      describe('when transaction is interrupted', () => {
        it('should rollback state before transaction', async () => {
          try {
            await db.transaction(
              User.$put({ _id: 11, name: 'User 1', age: 0 }),
              BoxDB.interrupt(),
              User.$delete(12),
            );
          } catch (_) {
            /* empty */
          }

          const record1 = await User.get(11);
          const record2 = await User.get(22);
          expect(record1.age).not.toBe(0);
          expect(record2).not.toBeNull();
        });
      });
    });

    describe('when call clear()', () => {
      it('should all records must be deleted', async () => {
        await User.clear();
        const records = await User.find().get();
        const count = await User.count();
        expect(records.length + count).toEqual(0);
      });
    });
  });
});
