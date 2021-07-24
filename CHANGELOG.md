# Change Log

## [1.0.0-rc.10] 2021-07-24

- Change `BoxDB.box()` to `BoxDB.create()`
- Refactor core interfaces 

## [1.0.0-rc.9] 2021-06-15

- Update type checking logics (now based on `typeof`)
- Add task arguments filter logic for lagacy browsers
- Using `strictNullChecks` mode (Typescript)

## [1.0.0-rc.8] 2021-06-00

- Change `BoxRange` type (Raname `target` to `index`)
- Fix model handlers parameter type
- Improve unit tests

## [1.0.0-rc.7] 2021-06-03

- Compose `query()` and `filter()` methods to `find()`
  - `query()` and `filter()` methods replaced to `find()`
  - Now can use both features in one method
- Update BoxDBError

## [1.0.0-rc.6] 2021-06-01

- Add `box.$query()` method
- Rename `box.find`, `box.$find()` to `filter`

## [1.0.0-rc.5] 2021-05-31

- Fix update features (put, update)
- Add demo page (for testing)
- Update polyfills information

## [1.0.0-rc.4] 2021-05-30

- chore: Re-build package

## [1.0.0-rc.3] 2021-05-30

- Rename `Model` to `Box`
  - model() name to box()
- Add `box.query()` method
  - For using IDBIndex, IDBRange
- Update `box.find()` parameter
  - Now recive only filter functions
  - Follows rest parameter
- Refactor model/transaction methods

## [1.0.0-rc.2] 2021-04-07

- Now `Model.get()` returns added record's key
- Update `BoxDBError` class
- Remove unused codes
- Update test cases
  - Coverage improved (> 99.5%)

## [1.0.0-rc.1] 2021-04-05

- First published version!
  - Promise based and easy to use
  - Works on Web Workers
  - Zero dependencies
  - Database and object store version management
  - Transaction control and data validation via model
  - ACID(Atomicity, Consistency, Isolation, Durability) guaranteed with transaction
  - Supports TypeScript
