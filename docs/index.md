<style type="text/css">
table {
  display: block;
  overflow-x: scroll;
}
</style>

# BoxDB

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

---

<div align="center" style="padding-bottom: 1rem">

<a href="./getting-started">Getting Started</a> |
<a href="./apis">API Reference</a> | <a href="./example">Example</a>

</div>

---

## Features

- Promise based ORM
- User friendly and easy to use
- Lightweight(< 10kb) IndexedDB wrapper
- Zero dependencies
- Database and object store version management
- Data validation and transaction control via model (box)
- ACID(Atomicity, Consistency, Isolation, Durability) guaranteed with transaction
- Supports TypeScript
- Works on [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

## Browsers Support

| <img src="https://user-images.githubusercontent.com/26512984/121935549-8292ca00-cd83-11eb-885c-9497bc78b104.png" alt="IE" width="12px" height="12px" /> IE | <img src="https://user-images.githubusercontent.com/26512984/121934559-64789a00-cd82-11eb-9238-4fc21eb835e2.png" alt="Edge" width="12px" height="12px" /> Edge | <img src="https://user-images.githubusercontent.com/26512984/121934551-62aed680-cd82-11eb-8a33-593af8b5fdbd.png" alt="Firefox" width="12px" height="12px" /> Firefox | <img src="https://user-images.githubusercontent.com/26512984/121934545-604c7c80-cd82-11eb-884d-d9d8dad26e01.png" alt="Chrome" width="12px" height="12px" /> Chrome | <img src="https://user-images.githubusercontent.com/26512984/121934539-5dea2280-cd82-11eb-96ed-fbef553ec0e6.png" alt="Safari" width="12px" height="12px" /> Safari | <img src="https://user-images.githubusercontent.com/26512984/121934526-5aef3200-cd82-11eb-981d-835490f7b1b2.png" alt="Samsung" width="12px" height="12px" /> Samsung | <img src="https://user-images.githubusercontent.com/26512984/121934519-59256e80-cd82-11eb-9b11-4805c7dd0ba1.png" alt="Opera" width="12px" height="12px" /> Opera |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11                                                                                                                                                         | 12~                                                                                                                                                            | 10~                                                                                                                                                                  | 23~                                                                                                                                                                | 10~                                                                                                                                                                | 4~                                                                                                                                                                   | 15~                                                                                                                                                              |

- Test features in your browser [here](https://this.geundung.dev/bxd/demo).
- Checkout `IE11` test [here](./ie).

## Installation

```bash
npm install bxd
```

In script tag:

```html
<script src="https://cdn.jsdelivr.net/npm/bxd@latest/dist/bxd.min.js"></script>
```
