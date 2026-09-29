/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/functions/src/shared/$1',
    '^@assets/(.*)$': '<rootDir>/assets/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/functions/', '<rootDir>/templates/', '<rootDir>/dist-web/'],
  modulePathIgnorePatterns: ['<rootDir>/functions/node_modules', '<rootDir>/templates/'],
};
