/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // functions/src/shared uses NodeNext-style './x.js' imports; resolve them to the .ts source.
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/functions/src/shared/$1',
    '^@assets/(.*)$': '<rootDir>/assets/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/functions/', '<rootDir>/templates/', '<rootDir>/dist-web/'],
  modulePathIgnorePatterns: ['<rootDir>/functions/node_modules', '<rootDir>/templates/'],
};
