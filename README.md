<div align="center">

# bxd

<img src="logo.png" width="250">

Object relation mapping for IndexedDB

</div>

## Contents

WIP..

## Installation

```bash
npm install --save bxd
```

## Documentation

WIP..

```javascript
import BoxDB, { Types } from 'bxd';

const box = new BoxDB('my-database', 1);

const User = box.model(1)('user', {
  _id: Types.NUMBER,
  name: Types.STRING,
  age: Types.NUMBER,
});

const user = new User();
user._id = 1;
user.name = 'Tom';
user.age = 12;

await User.add(user);
await User.get(1);
await User.put({
  ...user,
  name: 'Tim',
});
await User.delete(1);
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
