# Change Log

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
