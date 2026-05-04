/**
 * Tests for ChapterOnlyBookControl wrapper.
 *
 * Verifies that the trigger button's label drops the ":<verse>" suffix and uses the
 * English book name (matching upstream's fallback when no localized book-name map is
 * provided), and that the label stays correct across re-renders.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import type { SerializedVerseRef } from '@sillsdev/scripture';
import { ChapterOnlyBookControl } from '../../web-views/components/ChapterOnlyBookControl';

function getTriggerLabel(): string {
  const button = screen.getByRole('button', { name: 'book-chapter-trigger' });
  return button.querySelector('span')?.textContent ?? '';
}

function Harness({ initial }: { initial: SerializedVerseRef }) {
  const [scrRef, setScrRef] = useState<SerializedVerseRef>(initial);
  return (
    <ChapterOnlyBookControl
      scrRef={scrRef}
      handleSubmit={(next) => setScrRef({ ...next, verseNum: 1 })}
    />
  );
}

describe('ChapterOnlyBookControl', () => {
  it('strips ":<verse>" from the trigger label on initial render', () => {
    render(<Harness initial={{ book: '1JN', chapterNum: 3, verseNum: 1 }} />);
    expect(getTriggerLabel()).toBe('1 John 3');
  });

  it('handles multi-digit chapter numbers', () => {
    render(<Harness initial={{ book: 'PSA', chapterNum: 119, verseNum: 1 }} />);
    expect(getTriggerLabel()).toBe('Psalms 119');
  });

  it('updates the label when the scrRef prop changes', () => {
    const { rerender } = render(
      <ChapterOnlyBookControl
        scrRef={{ book: 'GEN', chapterNum: 1, verseNum: 1 }}
        handleSubmit={() => {}}
      />,
    );
    expect(getTriggerLabel()).toBe('Genesis 1');

    rerender(
      <ChapterOnlyBookControl
        scrRef={{ book: 'MAT', chapterNum: 5, verseNum: 1 }}
        handleSubmit={() => {}}
      />,
    );
    expect(getTriggerLabel()).toBe('Matthew 5');
  });

  it('keeps the label stripped after handleSubmit propagates a new ref', () => {
    render(<Harness initial={{ book: 'GEN', chapterNum: 1, verseNum: 1 }} />);
    expect(getTriggerLabel()).toBe('Genesis 1');

    // Drive a state change through the mock's chapter input.
    const chapterInput = screen.getByTestId('chapter-input');
    fireEvent.change(chapterInput, { target: { value: '7' } });

    // After the prop round-trip, the trigger should still have no ":1".
    expect(getTriggerLabel()).toBe('Genesis 7');
  });

  it('uses the localized name from `localizedBookNames` when provided', () => {
    const localizedBookNames = new Map([
      ['GEN', { localizedId: 'GÉN', localizedName: 'Génesis' }],
    ]);
    render(
      <ChapterOnlyBookControl
        scrRef={{ book: 'GEN', chapterNum: 2, verseNum: 1 }}
        handleSubmit={() => {}}
        localizedBookNames={localizedBookNames}
      />,
    );
    expect(getTriggerLabel()).toBe('Génesis 2');
  });
});
