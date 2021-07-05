# Internet Explorer

🎉 BoxDB supports `IE11` (IE10 was dropped.)

## Test

- Environment: VirtualBox windows agent (Provided by [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/tools/vms))

![VirtualBox_IE11](https://user-images.githubusercontent.com/26512984/121932611-077be480-cd80-11eb-9527-2d4377addc63.png)

✅ All tests passed.

![IE11](https://user-images.githubusercontent.com/26512984/121932588-ff23a980-cd7f-11eb-9aa2-ca0adc6cfd8f.png)

## Polyfills

```html
<script src="https://polyfill.io/v3/polyfill.min.js?features=Array.from%2CSymbol%2CSymbol.asyncIterator%2CSymbol.prototype.description%2CSymbol.iterator%2CArray.prototype.some%2CArray.prototype.includes%2CArray.prototype.every%2CArray.prototype.find%2CArray.isArray%2CArray.prototype.%40%40iterator%2CString.prototype.%40%40iterator%2CObject.assign%2CObject.entries%2CObject.getOwnPropertyDescriptor%2CObject.getPrototypeOf%2CObject.setPrototypeOf%2CPromise
"></script>
```

🔽 `IE11` targeted polyfills (Based on core-js 3)

| Polyfill                              |
| :------------------------------------ |
| es.symbol                             |
| es.symbol.description                 |
| es.symbol.async-iterator              |
| es.symbol.iterator                    |
| es.array.concat                       |
| es.array.every                        |
| es.array.find                         |
| es.array.from                         |
| es.array.is-array                     |
| es.array.iterator                     |
| es.array.some                         |
| es.string.iterator                    |
| es.object.assign                      |
| es.object.entries                     |
| es.object.get-own-property-descriptor |
| es.object.get-prototype-of            |
| es.object.set-prototype-of            |
| es.object.to-string                   |
| es.promise                            |
| web.dom-collections.iterator          |
