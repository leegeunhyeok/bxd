<div align="center">

# bxd

<img src="logo.png" width="250">

Boxdb is a promise-based browser ORM for [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) - WIP..

  <a href="https://github.com/leegeunhyeok/bxd/actions?query=workflow:build" alt="Github actions">
    <img src="https://github.com/leegeunhyeok/bxd/workflows/build/badge.svg">
  </a>
  <a href="https://codecov.io/gh/leegeunhyeok/bxd" alt="codecov">
    <img src="https://codecov.io/gh/leegeunhyeok/bxd/branch/dev/graph/badge.svg?token=I5YZWY8PGT">
  </a>
  <a href="https://www.npmjs.com/package/bxd" alt="npm">
    <img src="https://img.shields.io/npm/v/bxd">
  </a>
  <img src="https://img.shields.io/github/license/leegeunhyeok/bxd">
  <img src="https://badgen.net/badge/-/TypeScript/blue?icon=typescript&label" alt="typescript">

</div>

```typescript
const tom = { _id: 1, name: 'Tom', age: 10 };
const users = [
  tom,
  { _id: 2, name: 'Jessica', age: 12 },
  { _id: 3, name: 'Ellis', age: 15 },
  { _id: 4, name: 'John', age: 11 },
  { _id: 5, name: 'Unknown', age: -1 },
];

// Add all data
for (const user of users) {
  await User.add(user);
}
await User.put({ ...tom, age: 15 }); // Update tom's age to 15
await User.get(1); // { _id: 1, name: 'Tom', age: 15 }
await User.delete(3); // Delete record that `_id` is 3

// Get records that `age` is not -1 and over 10 and "i" character included in `name` value
await User.find([
  (user) => user.age !== -1,
  (user) => user.age > 10,
  (user) => user.name.indexOf('i') !== -1,
]).get();

// Delete records that `age` is negative number
await User.find([(user) => user.age < 0]).delete();

// Update records that `_id` is even number
await User.find([(user) => user._id % 2 === 0]).put({ age: 12 }); // `age` to 12

// Run multiple tasks via transaction
// 1. Update tom's age
// 2. Add new record
// 3. Delete records that `age` < 20
// : If error occurs during transaction, rollback to before transaction
await box.transaction([
  User.task.put({ ...tom, age: 20 }),
  User.task.add({ _id: 6, name: 'Hans', age: 22 }),
  User.task.find([(user) => user.age < 20]).delete(),
]);
```

## 📃 Table of Contents

- [Features](#features)
- [Browser Support](#browser-support)
- [Installation](#installation)
- [Roadmap](#roadmap)
- [Documentation](#documentation)
- [Examples](#examples)
- [Issue](#issue)
- [Development](#development)
- [Resources](#resources)
- [License](#license)

## 🌟 Features

- [x] Promise based and easy to use
- [x] Zero dependencies
- [x] Database and object store version management
- [x] Transaction control and data validation via model
- [x] ACID(Atomicity, Consistency, Isolation, Durability) guaranteed with transaction
- [x] Supports TypeScript

## 🌍 Browser Support

> WIP..

## 🛠 Installation

```bash
npm install --save bxd
```

In browser:

> Maybe polyfills required if load BoxDB via script tag

```html
<script src="/path/to/bxd.js"></script>
```

In browser (legacy):

```html
<!-- Polyfills required -->
<script src="https://polyfill.io/v3/polyfill.min.js?features=Symbol%2CSymbol.asyncIterator%2CSymbol.prototype.description%2CSymbol.iterator%2CArray.prototype.indexOf%2CArray.prototype.%40%40iterator%2CObject.assign%2CObject.getOwnPropertyDescriptor%2CObject.setPrototypeOf%2CPromise%2CString.prototype.%40%40iterator"></script>
<script src="/path/to/bxd.js">
```

|     Target     | Polyfill (Based on core-js 3)         |
| :------------: | :------------------------------------ |
| `IE10`, `IE11` | es.symbol                             |
| `IE10`, `IE11` | es.symbol.description                 |
| `IE10`, `IE11` | es.symbol.async-iterator              |
| `IE10`, `IE11` | es.symbol.iterator                    |
| `IE10`, `IE11` | es.array.concat                       |
| `IE10`, `IE11` | es.array.index-of                     |
| `IE10`, `IE11` | es.array.iterator                     |
| `IE10`, `IE11` | es.object.assign                      |
| `IE10`, `IE11` | es.object.get-own-property-descriptor |
|     `IE10`     | es.object.set-prototype-of            |
| `IE10`, `IE11` | es.object.to-string                   |
| `IE10`, `IE11` | es.promise                            |
| `IE10`, `IE11` | es.string.iterator                    |
| `IE10`, `IE11` | web.dom-collections.iterator          |

## 🚗 Roadmap

> WIP..

## 📖 Documentation

Boxdb documentation is on [wiki](https://github.com/leegeunhyeok/bxd/wiki)!

## 🌱 Examples

[Examples](https://github.com/leegeunhyeok/bxd/wiki#examples)

## 🔥 Issue

> WIP

## 👨‍💻 Development

```bash
# Install dependencies
npm install

# Test
npm run test

# Build
npm run build
```

## 🎨 Resources

- Logo based on [Icon Fonts](http://www.onlinewebfonts.com/icon) (by CC BY 3.0)

## 🍀 License

[MIT](./LICENSE)
