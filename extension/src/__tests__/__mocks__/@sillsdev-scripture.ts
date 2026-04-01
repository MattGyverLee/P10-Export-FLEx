/**
 * Mock for @sillsdev/scripture module
 */

const bookIdToNumber: Record<string, number> = {
  GEN: 1,
  EXO: 2,
  LEV: 3,
  NUM: 4,
  DEU: 5,
  JOS: 6,
  JDG: 7,
  RUT: 8,
  '1SA': 9,
  '2SA': 10,
  '1KI': 11,
  '2KI': 12,
  MAT: 40,
  MRK: 41,
  LUK: 42,
  JHN: 43,
  ACT: 44,
  ROM: 45,
  REV: 66,
};

const bookNumberToId: Record<number, string> = Object.fromEntries(
  Object.entries(bookIdToNumber).map(([id, num]) => [num, id])
);

const bookIdToEnglishName: Record<string, string> = {
  GEN: 'Genesis',
  EXO: 'Exodus',
  LEV: 'Leviticus',
  NUM: 'Numbers',
  DEU: 'Deuteronomy',
  JOS: 'Joshua',
  JDG: 'Judges',
  RUT: 'Ruth',
  '1SA': '1 Samuel',
  '2SA': '2 Samuel',
  '1KI': '1 Kings',
  '2KI': '2 Kings',
  MAT: 'Matthew',
  MRK: 'Mark',
  LUK: 'Luke',
  JHN: 'John',
  ACT: 'Acts',
  ROM: 'Romans',
  REV: 'Revelation',
};

export const Canon = {
  bookIdToNumber: jest.fn((bookId: string): number => {
    return bookIdToNumber[bookId] || 1;
  }),

  bookNumberToId: jest.fn((bookNum: number): string => {
    return bookNumberToId[bookNum] || 'GEN';
  }),

  bookIdToEnglishName: jest.fn((bookId: string): string => {
    return bookIdToEnglishName[bookId] || bookId;
  }),

  allBookIds: Object.keys(bookIdToNumber),

  // Get chapter count for a book
  getChapterCount: jest.fn((bookNum: number): number => {
    const chapterCounts: Record<number, number> = {
      1: 50, // Genesis
      2: 40, // Exodus
      3: 27, // Leviticus
      40: 28, // Matthew
      41: 16, // Mark
      42: 24, // Luke
      43: 21, // John
      66: 22, // Revelation
    };
    return chapterCounts[bookNum] || 1;
  }),
};

// SerializedVerseRef interface
export interface SerializedVerseRef {
  book: string;
  chapterNum: number;
  verseNum: number;
}

// VerseRef class mock
export class VerseRef {
  book: string;
  chapterNum: number;
  verseNum: number;

  constructor(book: string, chapterNum: number, verseNum: number) {
    this.book = book;
    this.chapterNum = chapterNum;
    this.verseNum = verseNum;
  }

  static fromString(verseStr: string): VerseRef {
    // Simple parser: "GEN 1:1" -> VerseRef
    const match = verseStr.match(/^(\w+)\s+(\d+):(\d+)$/);
    if (match) {
      return new VerseRef(match[1], parseInt(match[2], 10), parseInt(match[3], 10));
    }
    return new VerseRef('GEN', 1, 1);
  }

  toString(): string {
    return `${this.book} ${this.chapterNum}:${this.verseNum}`;
  }
}
