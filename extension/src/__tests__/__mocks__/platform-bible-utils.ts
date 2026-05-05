/**
 * Mock for platform-bible-utils module
 */

// Mock isPlatformError
export const isPlatformError = jest.fn((_value: unknown): boolean => false);

// Mock formatScrRefRange — mirrors the real util's verseNum<0 / chapterNum<0
// omission rules, start==end collapse, and `optionOrLocalizedBookName`
// book rendering. The wrapper always passes an already-resolved book name
// string, so the mock just uses it verbatim (and falls back to the book ID
// for the 'id'/undefined cases).
type ScrRefLike = { book: string; chapterNum: number; verseNum: number };
type FormatOpts = { optionOrLocalizedBookName?: 'id' | 'English' | string };
const formatScrRefSingle = (r: ScrRefLike, opt: FormatOpts['optionOrLocalizedBookName']): string => {
  const versePart = r.verseNum < 0 ? '' : `:${r.verseNum}`;
  const chapterPart = r.chapterNum < 0 ? '' : `${r.chapterNum}${versePart}`;
  const bookStr = opt && opt !== 'id' && opt !== 'English' ? opt : r.book;
  return chapterPart ? `${bookStr} ${chapterPart}` : bookStr;
};
export const formatScrRefRange = jest.fn(
  (start: ScrRefLike, end: ScrRefLike, options?: FormatOpts): string => {
    const startStr = formatScrRefSingle(start, options?.optionOrLocalizedBookName);
    const endStr = formatScrRefSingle(end, options?.optionOrLocalizedBookName);
    return startStr === endStr ? startStr : `${startStr}-${endStr}`;
  },
);

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
  formatScrRefRange,
  getChaptersForBook,
  serialize,
  deserialize,
  deepEqual,
  isString,
};
