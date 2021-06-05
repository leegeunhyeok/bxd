module.exports = {
  preset: 'ts-jest',
  modulePathIgnorePatterns: ['fixtures'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/*.ts', '!src/core/errors.ts'],
};
