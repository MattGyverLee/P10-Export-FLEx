/**
 * Tests for ChapterOnlyBookControl wrapper.
 *
 * Verifies that the trigger button's label has the trailing ":<verse>" stripped, while leaving
 * "<book> <chapter>" intact across re-renders.
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
    expect(getTriggerLabel()).toBe('1JN 3');
  });

  it('handles multi-digit chapter numbers', () => {
    render(<Harness initial={{ book: 'PSA', chapterNum: 119, verseNum: 1 }} />);
    expect(getTriggerLabel()).toBe('PSA 119');
  });

  it('updates the label when the scrRef prop changes', () => {
    const { rerender } = render(
      <ChapterOnlyBookControl
        scrRef={{ book: 'GEN', chapterNum: 1, verseNum: 1 }}
        handleSubmit={() => {}}
      />,
    );
    expect(getTriggerLabel()).toBe('GEN 1');

    rerender(
      <ChapterOnlyBookControl
        scrRef={{ book: 'MAT', chapterNum: 5, verseNum: 1 }}
        handleSubmit={() => {}}
      />,
    );
    expect(getTriggerLabel()).toBe('MAT 5');
  });

  it('keeps the label stripped after handleSubmit propagates a new ref', () => {
    render(<Harness initial={{ book: 'GEN', chapterNum: 1, verseNum: 1 }} />);
    expect(getTriggerLabel()).toBe('GEN 1');

    // Drive a state change through the mock's chapter input.
    const chapterInput = screen.getByTestId('chapter-input');
    fireEvent.change(chapterInput, { target: { value: '7' } });

    // After the prop round-trip, the trigger should still have no ":1".
    expect(getTriggerLabel()).toBe('GEN 7');
  });
});
