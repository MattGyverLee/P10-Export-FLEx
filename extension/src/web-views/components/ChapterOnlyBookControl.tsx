import { useEffect, useLayoutEffect, useRef } from 'react';
import { BookChapterControl } from 'platform-bible-react';
import type { SerializedVerseRef } from '@sillsdev/scripture';

type Props = {
  scrRef: SerializedVerseRef;
  handleSubmit: (scrRef: SerializedVerseRef) => void;
  getActiveBookIds?: () => string[];
  className?: string;
};

// Wraps platform-bible-react's BookChapterControl and adapts it for chapter-only
// workflows: strips the trailing ":<verse>" from the trigger label and hides
// the verse-nav chevrons inside the popover. Our export is chapter-level, so
// verse-level UI is misleading. Upstream BookChapterControl has no prop to
// suppress these — see https://github.com/paranext/paranext-core/pull/2239
// for the proposed `hideVerse` prop. Once that lands and is released, replace
// this wrapper with the prop.
const HIDE_VERSE_NAV_STYLE_ID = 'flex-export-hide-verse-nav-buttons';

export function ChapterOnlyBookControl({ scrRef, handleSubmit, getActiveBookIds, className }: Props) {
  // eslint-disable-next-line no-null/no-null -- React refs are initialized with null
  const wrapperRef = useRef<HTMLDivElement>(null);

  // The popover content is portaled to document.body, so a wrapper-scoped
  // selector can't reach it. Inject a global CSS rule (once per document)
  // that hides the verse-nav buttons by title. The titles are hardcoded
  // literal English in book-chapter-control.navigation.ts and not run through
  // any localization layer, so this matches in every UI locale. If upstream
  // ever localizes those titles, switch to a different selector or rely on
  // the upstream `hideVerse` prop (paranext/paranext-core#2239).
  useEffect(() => {
    if (document.getElementById(HIDE_VERSE_NAV_STYLE_ID)) return undefined;
    const style = document.createElement('style');
    style.id = HIDE_VERSE_NAV_STYLE_ID;
    style.textContent =
      'button[title="Previous verse"], button[title="Next verse"] { display: none !important; }';
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const span = wrapper.querySelector<HTMLSpanElement>(
      'button[aria-label="book-chapter-trigger"] > span',
    );
    if (!span) return;
    const stripped = (span.textContent ?? '').replace(/:\d+$/, '');
    if (span.textContent !== stripped) span.textContent = stripped;
  }, [scrRef.book, scrRef.chapterNum, scrRef.verseNum]);

  return (
    <div ref={wrapperRef} className="tw-contents">
      <BookChapterControl
        scrRef={scrRef}
        handleSubmit={handleSubmit}
        getActiveBookIds={getActiveBookIds}
        className={className}
      />
    </div>
  );
}
