/**
 * Tests for content filtering logic from welcome.web-view.tsx
 *
 * Tests the USJ filtering functions that remove content based on
 * includeFootnotes, includeCrossRefs, includeIntro, includeRemarks, includeFigures flags.
 */

// Re-implement helper functions from welcome.web-view.tsx for testing
const isIntroMarker = (marker: string): boolean => {
  return /^(imt\d?|is\d?|ip|ipi|im|imi|ipq|imq|ipr|iq\d?|ib|ili\d?|iot|io\d?|iex|ie)$/.test(marker);
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

      // Filter notes (footnotes and cross-references)
      if (node.type === 'note') {
        if (node.marker === 'f' && !includeFootnotes) return false;
        if (isCrossRefMarker(node.marker || '') && !includeCrossRefs) return false;
      }

      // Filter intro paragraphs (only in first chapter)
      if (node.type === 'para' && node.marker) {
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

    it('rejects non-intro markers', () => {
      expect(isIntroMarker('p')).toBe(false);
      expect(isIntroMarker('v')).toBe(false);
      expect(isIntroMarker('c')).toBe(false);
      expect(isIntroMarker('s')).toBe(false);
      expect(isIntroMarker('mt')).toBe(false);
      expect(isIntroMarker('h')).toBe(false);
      expect(isIntroMarker('toc')).toBe(false);
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

    describe('introduction filtering', () => {
      const contentWithIntro: (UsjNode | string)[] = [
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

      it('keeps intro paragraphs when includeIntro is true', () => {
        const result = filterUsjContent(contentWithIntro, true, {
          ...defaultOptions,
          includeIntro: true,
        });

        expect(result).toHaveLength(4);
        expect(result[0]).toHaveProperty('marker', 'imt');
        expect(result[1]).toHaveProperty('marker', 'ip');
      });

      it('removes intro paragraphs in first chapter when includeIntro is false', () => {
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
        expect(result).toHaveLength(4);
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
