<div align="center">

# bxd

<img alt="bxd" src="./bxd.gif">

BoxDB is a promise-based browser ORM for [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

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
    <img alt="npm bundle size" src="https://img.shields.io/bundlephobia/minzip/bxd">
  </a>
  <a href="https://www.npmjs.com/package/bxd">
    <img alt="npm bundle size" src="https://img.shields.io/bundlephobia/min/bxd">
  </a>
  <a href="https://www.npmjs.com/package/bxd">
    <img alt="zero dependency" src="https://badgen.net/bundlephobia/dependency-count/bxd">
  </a>
  <img src="https://img.shields.io/github/license/leegeunhyeok/bxd">
  <img src="https://badgen.net/badge/-/TypeScript/blue?icon=typescript&label" alt="typescript">

</div>

```typescript
import BoxDB from 'bxd';

const db = new BoxDB('my-datebase', 1);

// Define your box (Object store)
const User = db.box('user', {
  id: {
    type: BoxDB.Types.NUMBER,
    key: true, // This property is in-line-key
  },
  name: {
    type: BoxDB.Types.STRING,
    index: true, // This property is index
  },
  age: BoxDB.Types.NUMBER,
});

await db.open();

// Basics
await User.add({ id: 1, name: 'Tom', age: 10 });
await User.get(1);
await User.put({ id: 1, name: 'Tommy', age: 12 });
await User.delete(1);

// find(range, ...filters) method using IDBCursor
// Get records
const records = await User.find().get();

// filter & sort & limit
await User.find(
  null,
  (user) => user.id % 2 !== 0,
  (user) => user.age > 10,
  (user) => user.name.includes('y'),
).get(BoxDB.Order.DESC, 10);

// Update records (with filter)
await User
  .find(null, (user) => user.age !== 0)
  .update({ name: 'Timmy' });

// Delete records (with IDBValidKey & IDBRange + IDBIndex)
await User
  .find({
    value: BoxDB.Range.equal('Timmy'),
    index: 'name',
  })
  .delete();

// Do multiple tasks in one transaction
await db.transaction(
  User.$put({ id: 1, name: 'Tim', age: 20 }),
  User.$add({ id: 2, name: 'Jessica', age: 15 }),
  User.$add({ id: 3, name: 'Ellis', age: 13 }),
  User
    .$find({ value: 3 })
    .put({ name: 'Tina' }),
  BoxDB.interrupt(); // You can stop transaction like this!
  User.$delete(2),
  User
    .$find(null, (user) => user.age < 20)
    .put({ name: 'Young' }),
);

// And other IndexedDB API features!
await User.count(); // Get all records count
await User.clear(); // Clear all records
```

## 📃 Table of Contents

- [Features](#-features)
- [Browsers Support](#-browsers-support)
- [Installation](#-installation)
- [Documentation](#-documentation)
- [Example](#-example)
- [Issue](#-issue)
- [Development](#-development)
- [Resources](#-resources)
- [License](#-license)

## 🌟 Features

- Promise based ORM
- User friendly and easy to use
- Lightweight(< 10kb) IndexedDB wrapper
- Zero dependency
- Database and object store version management
- Data validation and transaction control via model (box)
- ACID(Atomicity, Consistency, Isolation, Durability) guaranteed with transaction
- Supports TypeScript
- Works on [Web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

## 🌍 Browsers Support

| <img src="https://user-images.githubusercontent.com/26512984/121935549-8292ca00-cd83-11eb-885c-9497bc78b104.png" alt="Edge" width="24px" height="24px" /></br>IE | <img src="https://user-images.githubusercontent.com/26512984/121934559-64789a00-cd82-11eb-9238-4fc21eb835e2.png" alt="Edge" width="24px" height="24px" /></br>Edge | <img src="https://user-images.githubusercontent.com/26512984/121934551-62aed680-cd82-11eb-8a33-593af8b5fdbd.png" alt="Firefox" width="24px" height="24px" /></br>Firefox | <img src="https://user-images.githubusercontent.com/26512984/121934545-604c7c80-cd82-11eb-884d-d9d8dad26e01.png" alt="Chrome" width="24px" height="24px" /></br>Chrome | <img src="https://user-images.githubusercontent.com/26512984/121934539-5dea2280-cd82-11eb-96ed-fbef553ec0e6.png" alt="Safari" width="24px" height="24px" /></br>Safari | <img src="https://user-images.githubusercontent.com/26512984/121934534-5c205f00-cd82-11eb-846b-cac169df47c7.png" alt="iOS Safari" width="24px" height="24px" /></br>iOS Safari | <img src="https://user-images.githubusercontent.com/26512984/121934526-5aef3200-cd82-11eb-981d-835490f7b1b2.png" alt="Samsung" width="24px" height="24px" /></br>Samsung | <img src="https://user-images.githubusercontent.com/26512984/121934519-59256e80-cd82-11eb-9b11-4805c7dd0ba1.png" alt="Opera" width="24px" height="24px" /></br>Opera |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11                                                                                                                                                               | 12~                                                                                                                                                                | 10~                                                                                                                                                                      | 23~                                                                                                                                                                    | 10~                                                                                                                                                                    | 10~                                                                                                                                                                            | 4~                                                                                                                                                                       | 15~                                                                                                                                                                  |

- Test features in your browser [here](https://bxd.vercel.app/demo.html).
- Checkout `IE11` test [here](https://bxd.vercel.app/ie).

## 🛠 Installation

```bash
npm install bxd
```

In script tag:

```html
<script src="https://cdn.jsdelivr.net/npm/bxd@latest/dist/bxd.min.js"></script>
```

Looking for IE? Go to [this page](https://bxd.vercel.app/ie)

## 📖 Documentation

Go to [documentation](https://bxd.vercel.app)!

## 🌱 Example

[Example](https://bxd.vercel.app/example)

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
