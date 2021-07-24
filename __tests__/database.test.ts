import 'fake-indexeddb/auto';
import BoxDB, { Box, BoxData, BoxSchema } from '../src/index.es';

const testSchema = {
  id: {
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
    unique: true,
  },
  age: BoxDB.Types.NUMBER,
};

describe('BoxDB', () => {
  let db: BoxDB = {} as BoxDB;
  let version = 0;
  const name = 'database-db';

  describe('when create BoxDB instance', () => {
    beforeAll(() => {
      db = new BoxDB(name, ++version);
    });

    it('should getName() returns database name', () => {
      expect(db.getName()).toBe(name);
    });

    it('should getVersion() returns database version', () => {
      expect(db.getVersion()).toBe(version);
    });

    it('should isReady() returns false', () => {
      expect(db.isReady()).toBe(false);
    });

    describe('when close database before open', () => {
      it('should throw error', () => {
        expect(() => {
          db.close();
        }).toThrow();
      });
    });
  });

  describe('when create new box', () => {
    let User: Box<typeof testSchema> = {} as Box<typeof testSchema>;
    const name = 'user';

    beforeAll(() => {
      User = db.create('user', testSchema);
    });

    it('should getName() returns object store name', () => {
      expect(User.getName()).toBe(name);
    });

    describe('when create new box with another name', () => {
      it('should returns new box successfully', () => {
        expect(() => {
          db.create('anotherBox', testSchema);
        }).not.toThrow();
      });
    });

    describe('when create new box with exist name', () => {
      it('should throw error', () => {
        expect(() => {
          db.create('user', testSchema);
        }).toThrow();
      });
    });

    describe('when create new box with multiple key', () => {
      it('should throw error', () => {
        expect(() => {
          db.create('test', {
            a: {
              type: BoxDB.Types.NUMBER,
              key: true,
            },
            b: {
              type: BoxDB.Types.NUMBER,
              key: true,
            },
          });
        }).toThrow();
      });
    });

    describe('when create new box with unique option without index', () => {
      it('should throw error', () => {
        expect(() => {
          db.create('withoutIndex', {
            ...testSchema,
            age: {
              type: BoxDB.Types.NUMBER,
              unique: true, // without `index` option
            },
          });
        }).toThrow();
      });
    });

    describe('when create new data via box', () => {
      describe('when create data without value', () => {
        it('should returns empty box data', () => {
          const data = new User();
          const dataFieldCount = Object.keys(data).length;
          const schemaFieldCount = Object.keys(testSchema).length;

          expect(data).toBeTruthy();
          expect(dataFieldCount).toBe(schemaFieldCount);
          expect(Object.values(data).every((x) => x === null)).toBe(true);
        });
      });

      describe('when provide valid data', () => {
        it('should returns box value', () => {
          let data: BoxData<BoxSchema> | null = null;
          expect(() => {
            data = new User({
              id: 1,
              name: 'Tom',
              phone: '12345',
              age: 10,
            });
          }).not.toThrow();
          expect(data).not.toBeNull();
        });
      });

      describe('when provide invalid value', () => {
        it('should throw error', () => {
          expect(() => {
            new User({
              id: 'string',
              name: 100,
              number: 0,
              age: 'string',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
          }).toThrow();
        });
      });
    });
  });

  describe('when open database', () => {
    beforeAll(async () => {
      await db.open();
    });

    // cleanup for next test case
    afterAll(() => {
      db.close();
    });

    it('should isReady() returns true', () => {
      expect(db.isReady()).toBe(true);
    });

    it('should getDB() returns IDB instance', () => {
      expect(db.getDB()).not.toBeNull();
    });

    describe('when define new box after database is opened', () => {
      it('should throw error', () => {
        expect(() => {
          db.create('afterOpen', testSchema);
        }).toThrow();
      });
    });
  });

  describe('when create BoxDB instance with updated version', () => {
    beforeEach(() => {
      db = new BoxDB(name, ++version);
    });

    describe('when change in-line key for exist box', () => {
      it('should throw error when open databas', async () => {
        db.create('user', {
          ...testSchema,
          id: BoxDB.Types.ANY, // at past version, `key` option was `true`
        });
        await expect(db.open()).rejects.toThrow();
      });
    });

    describe('when change out-of-line key for exist box', () => {
      it('should throw error when open databas', async () => {
        // at past version, `autoIncrement` option was `false`
        db.create('user', testSchema, { autoIncrement: true });
        await expect(db.open()).rejects.toThrow();
      });
    });

    describe('when change schema for exist box', () => {
      beforeEach(() => {
        db = new BoxDB(name, ++version);
      });

      describe('when change unique option', () => {
        describe('when add unique option for exist box', () => {
          it('should throw error', async () => {
            db.create('user', {
              ...testSchema,
              name: {
                ...testSchema.name,
                unique: true, // at past version, unique options was `false`
              },
            });

            await expect(async () => {
              await db.open();
            }).rejects.toThrow();
          });
        });

        describe('when remove unique option from exist box', () => {
          afterEach(() => {
            db.close();
          });

          it('should throw error', async () => {
            db.create('user', {
              ...testSchema,
              phone: {
                ...testSchema.phone,
                unique: false, // at past version, unique options was `true`
              },
            });

            await expect(db.open()).resolves.not.toThrow();
          });
        });
      });

      describe('when change index', () => {
        afterAll(() => {
          db.close();
        });

        it('should index update successfully', async () => {
          db.create('user', {
            id: {
              type: BoxDB.Types.NUMBER,
              key: true,
            },
            name: {
              type: BoxDB.Types.STRING,
              // name at past version (index: true)
              // Index will be deleted
              index: false,
            },
            age: {
              type: BoxDB.Types.NUMBER,
              // age at past version (index: false)
              // Index will be created
              index: true,
            },
          });

          await expect(db.open()).resolves.not.toThrow();
        });
      });
    });
  });

  describe('when create box with force option', () => {
    beforeEach(() => {
      db = new BoxDB(name, ++version);
    });

    afterEach(() => {
      db.close();
    });

    it('trying to register same model with force option', async () => {
      db.create(
        'user',
        {
          ...testSchema,
          id: {
            type: BoxDB.Types.NUMBER,
          },
        },
        { force: true },
      );

      await expect(db.open()).resolves.not.toThrow();
    });
  });

  describe('when update database when database is opened', () => {
    beforeAll(async () => {
      await db.open();
    });

    afterAll(() => {
      db.close();
    });

    it('should throw error', async () => {
      const db = new BoxDB(name, ++version);
      await expect(db.open()).rejects.toThrow();
    });
  });
});
