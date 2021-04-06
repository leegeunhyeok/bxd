<div align="center">

# bxd

<img src="https://user-images.githubusercontent.com/26512984/113550066-6b21bd00-962d-11eb-8e27-835d543199fe.png" width="250">

Boxdb is a promise-based browser ORM for [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

  <a href="https://github.com/leegeunhyeok/bxd/actions?query=workflow:build" alt="Github actions">
    <img src="https://github.com/leegeunhyeok/bxd/workflows/build/badge.svg">
  </a>
  <a href="https://lgtm.com/projects/g/leegeunhyeok/bxd/context:javascript" alt="lgtm">
    <img src="https://img.shields.io/lgtm/grade/javascript/g/leegeunhyeok/bxd.svg?logo=lgtm&logoWidth=18">
  </a>
  <a href="https://codecov.io/gh/leegeunhyeok/bxd" alt="codecov">
    <img src="https://codecov.io/gh/leegeunhyeok/bxd/branch/dev/graph/badge.svg?token=I5YZWY8PGT">
  </a>
  <a href="https://www.npmjs.com/package/bxd" alt="npm">
    <img src="https://img.shields.io/npm/v/bxd">
  </a>
  <a href="https://www.npmjs.com/package/bxd">
    <img alt="npm bundle size" src="https://img.shields.io/bundlephobia/min/bxd">
  </a>
  <img src="https://img.shields.io/github/license/leegeunhyeok/bxd">
  <img src="https://badgen.net/badge/-/TypeScript/blue?icon=typescript&label" alt="typescript">

</div>

```typescript
import BoxDB from 'bxd';

// Auto version managing
const box = new BoxDB('application-db', 1);

// Define your data models
const User = box.model('user', {
  id: {
    type: BoxDB.Types.NUMBER,
    key: true,
  },
  name: {
    type: BoxDB.Types.STRING,
    index: true,
  },
  age: BoxDB.Types.NUMBER,
});

await box.open();

// Basics
await User.add({ id: 1, name: 'Tom', age: 10 });
await User.get(1);
await User.put({ id: 1, name: 'Tommy', age: 12 }); // Update values
await User.delete(1);

// Using cursor
await User.find().get(); // Get all records
await User.find([
  (user) => user.id % 2 !== 0,
  (user) => user.age > 10,
  (user) => user.name.includes('y'),
]).get(BoxDB.Order.DESC, 10); // Filter/sort/limit
await User.find([(user) => user.age !== 0]).update({ name: 'Timmy' }); // Update filtered data
await User.find([(user) => user.age === 99]).delete(); // Delete filtered data

// Using transaction tasks
await box.transaction([
  User.$put({ id: 1, name: 'Tim', age: 20 }),
  User.$add({ id: 2, name: 'Jessica', age: 15 }),
  User.$add({ id: 3, name: 'Ellis', age: 13 }),
  BoxDB.interrupt(); // You can stop this transaction!
  User.$delete(2),
  User.$find([(user) => user.age < 20]).put({ name: 'Young' }),
]);

// And other IndexedDB API features!
await User.count(); // Records count
await User.clear(); // Delete all records
```

## 📃 Table of Contents

- [Features](#-features)
- [Browser Support](#-browser-support)
- [Installation](#-installation)
- [Documentation](#-documentation)
- [Examples](#-examples)
- [Issue](#-issue)
- [Development](#-development)
- [Resources](#-resources)
- [License](#-license)

## 🌟 Features

- Promise based and easy to use
- Lightweight(< 10kb) IndexedDB wrapper
- Zero dependencies
- Database and object store version management
- Transaction control and data validation via model
- ACID(Atomicity, Consistency, Isolation, Durability) guaranteed with transaction
- Supports TypeScript
- Works on [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

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

## 📖 Documentation

Boxdb documentation is on [wiki](https://github.com/leegeunhyeok/bxd/wiki)!

## 🌱 Examples

[Examples](https://github.com/leegeunhyeok/bxd/wiki/examples)

## 🔥 Issue

Opening an issue or feature request [here](https://github.com/leegeunhyeok/bxd/issues)

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
