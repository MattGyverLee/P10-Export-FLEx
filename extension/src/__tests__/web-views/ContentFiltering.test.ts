/**
 * Tests for content filtering logic from welcome.web-view.tsx
 *
 * Tests the USJ filtering functions that remove content based on
 * includeFootnotes, includeCrossRefs, includeIntro, includeRemarks, includeFigures flags.
 */

// Re-implement helper functions from welcome.web-view.tsx for testing
const isIntroMarker = (marker: string): boolean => {
  // Also includes main title markers (mt, mt1...) per FLExTrans convention
  return /^(imt\d?|is\d?|ip|ipi|im|imi|ipq|imq|ipr|iq\d?|ib|ili\d?|iot|io\d?|iex|ie|mt\d?)$/.test(marker);
};

const isBookHeaderMarker = (marker: string): boolean => {
  return /^(h\d?|toc\d|toca\d?)$/.test(marker);
};

const isRemarkMarker = (marker: string): boolean => {
  return marker === 'rem';
};

const isFigureMarker = (marker: string): boolean => {
  return marker === 'fig';
};

const isCrossRefMarker = (marker: string): boolean => {
  return marker === 'x' || marker === 'r';
};

// USJ node type interface
interface UsjNode {
  type?: string;
  marker?: string;
  content?: (UsjNode | string)[];
  number?: string;
  code?: string;
  caller?: string;
}

// Filter function matching welcome.web-view.tsx logic
function filterUsjContent(
  content: (UsjNode | string)[],
  isFirstChapter: boolean,
  options: {
    includeFootnotes: boolean;
    includeCrossRefs: boolean;
    includeIntro: boolean;
    includeRemarks: boolean;
    includeFigures: boolean;
  }
): (UsjNode | string)[] {
  const { includeFootnotes, includeCrossRefs, includeIntro, includeRemarks, includeFigures } = options;

  return content
    .filter((item) => {
      if (typeof item === 'string') return true;
      const node = item as UsjNode;

      // Always exclude book identification node (\id)
      if (node.type === 'book') return false;

      // Filter notes (footnotes and cross-references)
      if (node.type === 'note') {
        if (node.marker === 'f' && !includeFootnotes) return false;
        if (isCrossRefMarker(node.marker || '') && !includeCrossRefs) return false;
      }

      // Filter para markers
      if (node.type === 'para' && node.marker) {
        // Always exclude book-header markers (\h, \toc1, \toc2, \toc3)
        if (isFirstChapter && isBookHeaderMarker(node.marker)) return false;
        // Filter intro/title markers (only in first chapter)
        if (!includeIntro && isFirstChapter && isIntroMarker(node.marker)) return false;
        if (!includeCrossRefs && node.marker === 'r') return false;
        if (!includeRemarks && isRemarkMarker(node.marker)) return false;
      }

      // Filter figures
      if (node.type === 'figure' || (node.type === 'char' && isFigureMarker(node.marker || ''))) {
        if (!includeFigures) return false;
      }

      return true;
    })
    .map((item) => {
      if (typeof item === 'string') return item;
      const node = item as UsjNode;

      // Recursively filter nested content
      if (node.content) {
        return {
          ...node,
          content: filterUsjContent(node.content, isFirstChapter, options),
        };
      }

      return node;
    });
}

describe('Content Filtering', () => {
  describe('isIntroMarker', () => {
    it('identifies standard intro markers', () => {
      expect(isIntroMarker('imt')).toBe(true);
      expect(isIntroMarker('imt1')).toBe(true);
      expect(isIntroMarker('imt2')).toBe(true);
      expect(isIntroMarker('is')).toBe(true);
      expect(isIntroMarker('is1')).toBe(true);
      expect(isIntroMarker('ip')).toBe(true);
      expect(isIntroMarker('ipi')).toBe(true);
      expect(isIntroMarker('im')).toBe(true);
      expect(isIntroMarker('imi')).toBe(true);
      expect(isIntroMarker('ipq')).toBe(true);
      expect(isIntroMarker('imq')).toBe(true);
      expect(isIntroMarker('ipr')).toBe(true);
      expect(isIntroMarker('iq')).toBe(true);
      expect(isIntroMarker('iq1')).toBe(true);
      expect(isIntroMarker('ib')).toBe(true);
      expect(isIntroMarker('ili')).toBe(true);
      expect(isIntroMarker('ili1')).toBe(true);
      expect(isIntroMarker('iot')).toBe(true);
      expect(isIntroMarker('io')).toBe(true);
      expect(isIntroMarker('io1')).toBe(true);
      expect(isIntroMarker('iex')).toBe(true);
      expect(isIntroMarker('ie')).toBe(true);
    });

    it('identifies main title markers as intro (FLExTrans convention)', () => {
      expect(isIntroMarker('mt')).toBe(true);
      expect(isIntroMarker('mt1')).toBe(true);
      expect(isIntroMarker('mt2')).toBe(true);
    });

    it('rejects non-intro markers', () => {
      expect(isIntroMarker('p')).toBe(false);
      expect(isIntroMarker('v')).toBe(false);
      expect(isIntroMarker('c')).toBe(false);
      expect(isIntroMarker('s')).toBe(false);
      expect(isIntroMarker('h')).toBe(false);
      expect(isIntroMarker('toc1')).toBe(false);
    });
  });

  describe('isBookHeaderMarker', () => {
    it('identifies running header marker', () => {
      expect(isBookHeaderMarker('h')).toBe(true);
      expect(isBookHeaderMarker('h1')).toBe(true);
    });

    it('identifies toc markers', () => {
      expect(isBookHeaderMarker('toc1')).toBe(true);
      expect(isBookHeaderMarker('toc2')).toBe(true);
      expect(isBookHeaderMarker('toc3')).toBe(true);
      expect(isBookHeaderMarker('toca1')).toBe(true);
    });

    it('rejects non-header markers', () => {
      expect(isBookHeaderMarker('p')).toBe(false);
      expect(isBookHeaderMarker('mt')).toBe(false);
      expect(isBookHeaderMarker('id')).toBe(false);
      expect(isBookHeaderMarker('toc')).toBe(false);
    });
  });

  describe('isRemarkMarker', () => {
    it('identifies rem marker', () => {
      expect(isRemarkMarker('rem')).toBe(true);
    });

    it('rejects non-remark markers', () => {
      expect(isRemarkMarker('p')).toBe(false);
      expect(isRemarkMarker('remark')).toBe(false);
      expect(isRemarkMarker('r')).toBe(false);
    });
  });

  describe('isFigureMarker', () => {
    it('identifies fig marker', () => {
      expect(isFigureMarker('fig')).toBe(true);
    });

    it('rejects non-figure markers', () => {
      expect(isFigureMarker('figure')).toBe(false);
      expect(isFigureMarker('p')).toBe(false);
      expect(isFigureMarker('img')).toBe(false);
    });
  });

  describe('isCrossRefMarker', () => {
    it('identifies x marker', () => {
      expect(isCrossRefMarker('x')).toBe(true);
    });

    it('identifies r marker', () => {
      expect(isCrossRefMarker('r')).toBe(true);
    });

    it('rejects non-cross-ref markers', () => {
      expect(isCrossRefMarker('xt')).toBe(false);
      expect(isCrossRefMarker('xref')).toBe(false);
      expect(isCrossRefMarker('f')).toBe(false);
    });
  });

  describe('filterUsjContent', () => {
    const defaultOptions = {
      includeFootnotes: true,
      includeCrossRefs: true,
      includeIntro: true,
      includeRemarks: true,
      includeFigures: true,
    };

    describe('footnotes filtering', () => {
      const contentWithFootnote: (UsjNode | string)[] = [
        'In the beginning',
        {
          type: 'note',
          marker: 'f',
          caller: '+',
          content: [{ type: 'char', marker: 'ft', content: ['A footnote'] }],
        },
        ' God created.',
      ];

      it('keeps footnotes when includeFootnotes is true', () => {
        const result = filterUsjContent(contentWithFootnote, false, {
          ...defaultOptions,
          includeFootnotes: true,
        });

        expect(result).toHaveLength(3);
        expect(result[1]).toHaveProperty('type', 'note');
        expect(result[1]).toHaveProperty('marker', 'f');
      });

      it('removes footnotes when includeFootnotes is false', () => {
        const result = filterUsjContent(contentWithFootnote, false, {
          ...defaultOptions,
          includeFootnotes: false,
        });

        expect(result).toHaveLength(2);
        expect(result.find((item) => typeof item !== 'string' && item.marker === 'f')).toBeUndefined();
      });
    });

    describe('cross-reference filtering', () => {
      const contentWithCrossRef: (UsjNode | string)[] = [
        'In the beginning',
        {
          type: 'note',
          marker: 'x',
          caller: '+',
          content: [{ type: 'char', marker: 'xt', content: ['John 1:1'] }],
        },
        ' God created.',
      ];

      const contentWithRPara: (UsjNode | string)[] = [
        {
          type: 'para',
          marker: 'r',
          content: ['(See also Matthew 1)'],
        },
        {
          type: 'para',
          marker: 'p',
          content: ['Regular paragraph'],
        },
      ];

      it('keeps cross-references when includeCrossRefs is true', () => {
        const result = filterUsjContent(contentWithCrossRef, false, {
          ...defaultOptions,
          includeCrossRefs: true,
        });

        expect(result).toHaveLength(3);
        expect(result[1]).toHaveProperty('marker', 'x');
      });

      it('removes cross-references when includeCrossRefs is false', () => {
        const result = filterUsjContent(contentWithCrossRef, false, {
          ...defaultOptions,
          includeCrossRefs: false,
        });

        expect(result).toHaveLength(2);
        expect(result.find((item) => typeof item !== 'string' && item.marker === 'x')).toBeUndefined();
      });

      it('removes \\r paragraphs when includeCrossRefs is false', () => {
        const result = filterUsjContent(contentWithRPara, false, {
          ...defaultOptions,
          includeCrossRefs: false,
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('marker', 'p');
      });
    });

    describe('book node filtering', () => {
      const contentWithBookNode: (UsjNode | string)[] = [
        {
          type: 'book',
          marker: 'id',
          code: 'GEN',
          content: ['Genesis'],
        },
        {
          type: 'chapter',
          marker: 'c',
          number: '1',
        },
        {
          type: 'para',
          marker: 'p',
          content: ['In the beginning...'],
        },
      ];

      it('always removes book node regardless of options', () => {
        const result = filterUsjContent(contentWithBookNode, true, defaultOptions);

        expect(result).toHaveLength(2);
        expect(result.find((item) => typeof item !== 'string' && (item as UsjNode).type === 'book')).toBeUndefined();
        expect(result[0]).toHaveProperty('type', 'chapter');
      });
    });

    describe('book header marker filtering', () => {
      const contentWithHeaders: (UsjNode | string)[] = [
        {
          type: 'para',
          marker: 'h',
          content: ['Genesis'],
        },
        {
          type: 'para',
          marker: 'toc1',
          content: ['The First Book of Moses, called Genesis'],
        },
        {
          type: 'para',
          marker: 'toc2',
          content: ['Genesis'],
        },
        {
          type: 'para',
          marker: 'mt1',
          content: ['Genesis'],
        },
        {
          type: 'chapter',
          marker: 'c',
          number: '1',
        },
      ];

      it('always removes \\h and \\toc markers in first chapter', () => {
        const result = filterUsjContent(contentWithHeaders, true, defaultOptions);

        expect(result.find((item) => typeof item !== 'string' && (item as UsjNode).marker === 'h')).toBeUndefined();
        expect(result.find((item) => typeof item !== 'string' && (item as UsjNode).marker === 'toc1')).toBeUndefined();
        expect(result.find((item) => typeof item !== 'string' && (item as UsjNode).marker === 'toc2')).toBeUndefined();
      });

      it('keeps \\mt1 when includeIntro is true', () => {
        const result = filterUsjContent(contentWithHeaders, true, { ...defaultOptions, includeIntro: true });

        expect(result.find((item) => typeof item !== 'string' && (item as UsjNode).marker === 'mt1')).toBeDefined();
      });

      it('removes \\mt1 when includeIntro is false (FLExTrans: start at \\c 1)', () => {
        const result = filterUsjContent(contentWithHeaders, true, { ...defaultOptions, includeIntro: false });

        expect(result.find((item) => typeof item !== 'string' && (item as UsjNode).marker === 'mt1')).toBeUndefined();
        expect(result[0]).toHaveProperty('type', 'chapter');
      });
    });

    describe('introduction filtering', () => {
      const contentWithIntro: (UsjNode | string)[] = [
        {
          type: 'para',
          marker: 'mt1',
          content: ['The Book of Genesis'],
        },
        {
          type: 'para',
          marker: 'imt',
          content: ['Introduction to Genesis'],
        },
        {
          type: 'para',
          marker: 'ip',
          content: ['Intro paragraph'],
        },
        {
          type: 'chapter',
          marker: 'c',
          number: '1',
        },
        {
          type: 'para',
          marker: 'p',
          content: ['In the beginning...'],
        },
      ];

      it('keeps intro and title paragraphs when includeIntro is true', () => {
        const result = filterUsjContent(contentWithIntro, true, {
          ...defaultOptions,
          includeIntro: true,
        });

        expect(result).toHaveLength(5);
        expect(result[0]).toHaveProperty('marker', 'mt1');
        expect(result[1]).toHaveProperty('marker', 'imt');
        expect(result[2]).toHaveProperty('marker', 'ip');
      });

      it('removes intro and title paragraphs in first chapter when includeIntro is false', () => {
        const result = filterUsjContent(contentWithIntro, true, {
          ...defaultOptions,
          includeIntro: false,
        });

        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty('marker', 'c');
        expect(result[1]).toHaveProperty('marker', 'p');
      });

      it('keeps intro paragraphs in non-first chapters even when includeIntro is false', () => {
        const result = filterUsjContent(contentWithIntro, false, {
          ...defaultOptions,
          includeIntro: false,
        });

        // Intro markers are only removed in first chapter
        expect(result).toHaveLength(5);
      });
    });

    describe('remarks filtering', () => {
      const contentWithRemarks: (UsjNode | string)[] = [
        {
          type: 'para',
          marker: 'rem',
          content: ['This is a translator remark'],
        },
        {
          type: 'para',
          marker: 'p',
          content: ['Regular paragraph'],
        },
      ];

      it('keeps remarks when includeRemarks is true', () => {
        const result = filterUsjContent(contentWithRemarks, false, {
          ...defaultOptions,
          includeRemarks: true,
        });

        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty('marker', 'rem');
      });

      it('removes remarks when includeRemarks is false', () => {
        const result = filterUsjContent(contentWithRemarks, false, {
          ...defaultOptions,
          includeRemarks: false,
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('marker', 'p');
      });
    });

    describe('figures filtering', () => {
      const contentWithFigure: (UsjNode | string)[] = [
        {
          type: 'para',
          marker: 'p',
          content: ['Some text'],
        },
        {
          type: 'figure',
          marker: 'fig',
          content: ['Figure description'],
        },
      ];

      it('keeps figures when includeFigures is true', () => {
        const result = filterUsjContent(contentWithFigure, false, {
          ...defaultOptions,
          includeFigures: true,
        });

        expect(result).toHaveLength(2);
      });

      it('removes figures when includeFigures is false', () => {
        const result = filterUsjContent(contentWithFigure, false, {
          ...defaultOptions,
          includeFigures: false,
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('marker', 'p');
      });
    });

    describe('nested content filtering', () => {
      const nestedContent: (UsjNode | string)[] = [
        {
          type: 'para',
          marker: 'p',
          content: [
            'Text with ',
            {
              type: 'note',
              marker: 'f',
              caller: '+',
              content: ['Nested footnote'],
            },
            ' embedded.',
          ],
        },
      ];

      it('recursively filters nested content', () => {
        const result = filterUsjContent(nestedContent, false, {
          ...defaultOptions,
          includeFootnotes: false,
        });

        expect(result).toHaveLength(1);
        const para = result[0] as UsjNode;
        expect(para.content).toHaveLength(2);
        expect(para.content?.[0]).toBe('Text with ');
        expect(para.content?.[1]).toBe(' embedded.');
      });

      it('keeps nested content when filters allow', () => {
        const result = filterUsjContent(nestedContent, false, {
          ...defaultOptions,
          includeFootnotes: true,
        });

        const para = result[0] as UsjNode;
        expect(para.content).toHaveLength(3);
        expect(para.content?.[1]).toHaveProperty('marker', 'f');
      });
    });

    describe('preserves other content', () => {
      const mixedContent: (UsjNode | string)[] = [
        { type: 'chapter', marker: 'c', number: '1' },
        { type: 'para', marker: 's', content: ['Section heading'] },
        { type: 'para', marker: 'p', content: [{ type: 'verse', marker: 'v', number: '1' }, 'Text'] },
        { type: 'para', marker: 'q1', content: ['Poetry line'] },
      ];

      it('preserves chapters, verses, sections, and poetry', () => {
        const result = filterUsjContent(mixedContent, false, {
          includeFootnotes: false,
          includeCrossRefs: false,
          includeIntro: false,
          includeRemarks: false,
          includeFigures: false,
        });

        expect(result).toHaveLength(4);
        expect(result[0]).toHaveProperty('type', 'chapter');
        expect(result[1]).toHaveProperty('marker', 's');
        expect(result[2]).toHaveProperty('marker', 'p');
        expect(result[3]).toHaveProperty('marker', 'q1');
      });

      it('preserves string content', () => {
        const stringContent: (UsjNode | string)[] = ['Plain text', 'More text'];

        const result = filterUsjContent(stringContent, false, defaultOptions);

        expect(result).toEqual(stringContent);
      });
    });
  });
});
