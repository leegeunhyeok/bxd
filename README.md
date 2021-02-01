<div align="center">

# bxd

<img src="logo.png" width="250">

Object relation mapping for IndexedDB

</div>

## Features

- [x] Define model for structured data
- [x] Control object store via Model
- [x] Database and model version management
- [x] Data scheme and type validation
- [x] Fully TypeScript support

### Installation

```bash
npm install --save bxd
```

In browser:

```html
<script src="/path/to/bxd.js"></script>
```

## Documentation

### BoxDB

> BoxDB class

```javascript
const box = new BoxDB(databaseName, version);
```

Parameters

- **databaseName**: `string`
  - Name of the database
- **version**: `number`
  - Version to open the database with

Return value

- `void`

More: [MDN](https://developer.mozilla.org/en-US/docs/Web/API/IDBFactory/open#parameters)

### BoxDB.Types

> The BoxDB.Types is constant value to specify model data type

```javascript
BoxDB.Types;

// Properties
BoxDB.Types.BOOLEAN;
BoxDB.Types.NUMBER;
BoxDB.Types.STRING;
BoxDB.Types.DATE;
BoxDB.Types.ARRAY;
BoxDB.Types.OBJECT;
BoxDB.Types.REGEXP;
BoxDB.Types.FILE;
BoxDB.Types.BLOB;
BoxDB.Types.ANY;
```

Properties

- **BOOLEAN**: for [Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean) value
- **NUMBER**: for [Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) value
- **STRING**: for [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) value
- **DATE**: for [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) value
- **ARRAY**: for [Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) value
- **OBJECT**: for [Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object) value
- **REGEXP**: for [RegExp](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp) value
- **FILE**: for [File](https://developer.mozilla.org/en-US/docs/Web/API/File) value
- **BLOB**: for [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) value
- **ANY**: for _any_ value (No type checking)

### BoxDB.model()

> The model() method of the BoxDB interface first step of define new model

```javascript
box.model(targetVersion);
```

Parameters

- **targetVersion**: `number`
  - Version of create or update the object store when [onupgradeneeded](https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/onupgradeneeded) event fired

Return value

- [BoxModelRegister](#boxmodelregister)

### BoxDB.open()

> The open() method of the BoxDB interface open idb and create/update/delete object store based on registered models

```javascript
box.open();
```

Return value

- `Promise<Event>`

### BoxModelRegister()

> Define and create new model

```javascript
const v1ModelRegister = box.model(1); // targetVersion
const User = v1ModelRegister(storeName, scheme[, options]);

// also can use like this (function chaining)
const User = box.model(1)(storeName, scheme[, options]);
```

Parameters

- **storeName**: `string`
  - Name of the object store
- **scheme**: [BoxScheme](#BoxScheme)
  - Data scheme of the data to store
- **options**: [BoxOption](#BoxOption)
  - Object store options

Return value

- [BoxModel](#BoxModel)
  - Model object

### BoxScheme

> Object for model scheme definition

```typescript
interface BoxScheme {
  [key: string]: ConfiguredType | Types;
}

// BoxDB.Types
export enum BoxDataTypes {
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  STRING = 'string',
  DATE = 'date',
  ARRAY = 'array',
  OBJECT = 'object',
  REGEXP = 'regexp',
  FILE = 'file',
  BLOB = 'blob',
  ANY = 'any',
}

type ConfiguredType = {
  type: BoxDataTypes;
  key?: boolean;
  index?: boolean;
  unique?: boolean;
};
```

```javascript
// Example
const scheme = {
  name: {
    type: BoxDB.Types.STRING,
    index: true,
    unique: true,
  },
  age: BoxDB.Types.NUMBER,
};
```

Options

- **type**: `BoxDataTypes`
  - Type of this property (used by type checking)
- **key**: `boolean`
  - Set this property as [out-of-line key](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Concepts_Behind_IndexedDB#gloss_outofline_key)
- **index**: `boolean`
  - Create index for this property
  - If you want search this property values by index, must set true
- **unique**: `boolean`
  - `index` option required
  - Add [unique constraint](https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/createIndex#parameters) to this property's index

### BoxOption

> Object store options object

```typescript
interface BoxOption {
  autoIncrement?: boolean;
}
```

- **autoIncrement**: `boolean`
  - Use [in-line key](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Concepts_Behind_IndexedDB#gloss_inline_key) for this object store

### BoxModel

> The Box Model object can be control specified object store or use as value

```javascript
const User = box.model(1)('user', {
  _id: {
    type: BoxDB.Types.NUMBER,
    key: true,
  }
  name: {
    type: BoxDB.Types.STRING,
    index: true,
  }
  age: BoxDB.Types.NUMBER,
  email: BoxDB.Types.STRING
});

// Model as constructor
new User();

// Model methods for single transactions
User.get(key);
User.put(value, key);
User.delete();
User.clear();
User.drop();
User.find(filters).get();
User.find(filters).update(value);
User.find(filters).delete();

// Returns TransactionTask for BoxDB.transaction()
User.task.get(key);
User.task.put(key, value);
User.task.delete();
User.task.find(filters).update(value);
User.task.find(filters).delete();
```

Parameters

- **storeName**: `string`
  - Name of the object store
- **scheme**: [BoxScheme](#BoxScheme)
  - Data scheme of the data to store
- **options**: `BoxOptions`
  - Object store options

Properties

- **Model.task**: `BoxTask`
  - A set of methods that return `TransactionTask`

Static methods

- Model.get(key): Get record from object store
- Model.put(value[, key]): Put record to object store
- Model.delete(key): Delete record from object store
- Model.clear(key): Clear all records from object store
- Model.drop(key): Drop the object store
- Model.find([, filters]): Returns `BoxCursorModel`, Transaction by [cursor](https://developer.mozilla.org/en-US/docs/Web/API/IDBCursor)
  - find().get(): Get all of records
  - find().update(value): Update records
  - find().delete(): Delete records

## Usage

- Create `BoxDB` instance.
- Define object store and data scheme as model
- `BoxDB.open()` to open IDB
  - **WARNING**: Can not create/update/drop model after `BoxDB.open()`
- Do transactions task via Models!

### Prepare a database

```javascript
// 1. Create new BoxDB instance
const box = new BoxDB('bank', 1);
```

### Create models

```javascript
// user object store in idb version 1
const User = box.model(1)('user', {
  _id: {
    type: BoxDB.Types.NUMBER,
    key: true,
  },
  name: {
    type: BoxDB.Types.STRING,
    index: true,
  },
  amount: BoxDB.Types.NUMBER,
});

const History = box.model(1)(
  'history',
  {
    fromUser: {
      type: BoxDB.Types.STRING,
      index: true,
    },
    toUser: {
      type: BoxDB.Types.STRING,
      index: true,
    },
    datetime: BoxDB.Types.DATE,
  },
  { autoIncrement: true },
);
```

### Apply all registred models into IDB

```javascript
await box.open(); // will create registered `user`, `post` object store
```

### Data CRUD

- Create

```javascript
// Method 1. Create empty data
const user1 = new User();
user1._id = 1;
user1.name = 'Emma';
user1.amount = 150;

// Method 2. Create data with initial value
const user2 = new User({
  _id: 2,
  name: 'Tom',
  amount: 50,
});

const user3 = new User({
  _id: 3,
  name: 'Unknown',
  amount: 0,
});

// Save data into `user` object store
await User.add(user1);
await User.add(user2);
await User.add(user3);
```

- Read

```javascript
// Find data with a keyPath value of 1
const result = await User.get(1);

result; // { _id: 1, name: 'Emma', amount: 150 }
```

- Update

```javascript
const result = await User.get(1);

// Update name field value (Emma to Jessica)
await User.put({
  ...result,
  name: 'Jessica',
});
```

- Delete

```javascript
// Delete data with a keyPath value of 3 (unknown user will be deleted)
await User.delete(3);
```

- Transaction

```javascript
// Situation: Jessica sends $30 to Tom
const fromUser = await User.get(1); // Jessica
const toUser = await User.get(2); // Tom
const transactionAmount = 30;

// Resolve when all of tasks is done
// If any of the tasks fail, the transaction is aborted.
await box.transaction([
  User.task.put({
    ...fromUser,
    amount: fromUser.amount - transactionAmount,
  }),
  User.task.put({
    ...toUser,
    amount: toUser.amount + transactionAmount,
  }),
  History.task.add({
    fromUser: fromUser._id,
    toUser: toUser._id,
    datetime: new Date(),
  }),
]);

// Jessica: $120, Tom: $80
```

- Abort transaction

```javascript
await box.transaction([
  AnyTask_1,
  AnyTask_2,
  BoxDB.interrupt(), // This transaction will be aborted
  AnyTask_3,
]);

// AnyTask_1, AnyTask_2, AnyTask_3 task not applied
// Rollback to before transaction
```

## Development

```bash
# Install dependencies
npm install

# Test
npm run test

# Build
npm run build
```

## Resource

- Logo based on [Icon Fonts](http://www.onlinewebfonts.com/icon) (by CC BY 3.0)

## License

[MIT](./LICENSE)
