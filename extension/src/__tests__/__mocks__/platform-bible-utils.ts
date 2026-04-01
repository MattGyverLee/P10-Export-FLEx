/**
 * Mock for platform-bible-utils module
 */

// Mock isPlatformError
export const isPlatformError = jest.fn((_value: unknown): boolean => false);

// Mock getChaptersForBook (returns chapter count for a book)
export const getChaptersForBook = jest.fn((bookNum: number): number => {
  const chapterCounts: Record<number, number> = {
    1: 50, // Genesis
    2: 40, // Exodus
    3: 27, // Leviticus
    4: 36, // Numbers
    5: 34, // Deuteronomy
    40: 28, // Matthew
    41: 16, // Mark
    42: 24, // Luke
    43: 21, // John
    66: 22, // Revelation
  };
  return chapterCounts[bookNum] || 1;
});

// Mock serialize/deserialize functions
export const serialize = jest.fn((value: unknown): string => JSON.stringify(value));
export const deserialize = jest.fn(<T>(value: string): T => JSON.parse(value) as T);

// Mock other common utilities
export const deepEqual = jest.fn((a: unknown, b: unknown): boolean => {
  return JSON.stringify(a) === JSON.stringify(b);
});

export const isString = jest.fn((value: unknown): value is string => {
  return typeof value === 'string';
});

// Export everything as default too
export default {
  isPlatformError,
  getChaptersForBook,
  serialize,
  deserialize,
  deepEqual,
  isString,
};
