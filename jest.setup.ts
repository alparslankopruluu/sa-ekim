/* Test doubles for native modules the unit tests touch. */
type MockNodeCrypto = { randomUUID(): string; randomBytes(size: number): Uint8Array };

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-crypto', () => {
  const mockCrypto = jest.requireActual<MockNodeCrypto>('crypto');
  return {
    randomUUID: () => mockCrypto.randomUUID(),
    getRandomBytes: (size: number) => new Uint8Array(mockCrypto.randomBytes(size)),
  };
});

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
require('react-native-reanimated').setUpTests();
