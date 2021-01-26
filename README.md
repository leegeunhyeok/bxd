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
BoxDB.Types.ARRAY;
BoxDB.Types.OBJECT;
BoxDB.Types.ANY;
```

Properties

- **Types.BOOLEAN**: for [Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean) value
- **Types.NUMBER**: for [Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) value
- **Types.STRING**: for [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) value
- **Types.ARRAY**: for [Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) value
- **Types.OBJECT**: for [Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object) value
- **Types.ANY**: for _any_ value (No type checking)

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
enum Types {
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  STRING = 'string',
  ARRAY = 'array',
  OBJECT = 'object',
  ANY = 'any',
}

type ConfiguredType = {
  type: Types;
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

### BoxOption

> Object store options object

```typescript
interface BoxOption {
  autoIncrement?: boolean;
}
```

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

// Model methods for data transactions
User.get();
User.find();
User.put();
User.delete();
User.drop();
```

Properties

- **storeName**: `string`
  - Name of the object store
- **scheme**: `BoxScheme`
  - Data scheme of the data to store
- **options**: `BoxOptions`
  - Object store options

## Usage

- Create `BoxDB` instance.
- Model and scheme management.
  - Create
  - Update
    - Index (add, remove)
    - Fields (add, remove)
  - Drop
- Open idb via `BoxDB.open()`
  - **WARNING**: Can not create/update/drop model after opened
- Do transaction task via Models!

### Prepare a database

```javascript
// 1. Create new BoxDB instance
const box = new BoxDB('board', 1);
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
  email: BoxDB.Types.STRING,
});

const Post = box.model(1)('post', {
  _id: {
    type: BoxDB.Types.NUMBER,
    key: true,
  },
  title: {
    type: BoxDB.Types.STRING,
    index: true,
  },
  content: BoxDB.Types.STRING,
  like: BoxDB.Types.NUMBER,
});
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
user1.email = 'emma1234@host.com';

// Method 2. Create data with initial value
const user2 = new User({
  _id: 2,
  name: 'Tom',
  email: 'tom1234@host.com',
});

// Save data into `user` object store
await User.add(user1);
await User.add(user2);
```

- Read

```javascript
// Find data with a keyPath value of 1
const result = await User.get(1);

result; // { _id: 1, name: 'Emma', email: 'emma1234@host.com' }
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
// Delete data with a keyPath value of 2 (`name: Tom` will be deleted)
await User.delete(2);
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
