import { ComponentProps, ComponentType, useEffect, useLayoutEffect, useRef } from 'react';
import { BookChapterControl } from 'platform-bible-react';
import { formatScrRefRange } from 'platform-bible-utils';
import { Canon, type SerializedVerseRef } from '@sillsdev/scripture';

type LocalizedBookNames = Map<string, { localizedId: string; localizedName: string }>;

type Props = {
  scrRef: SerializedVerseRef;
  handleSubmit: (scrRef: SerializedVerseRef) => void;
  getActiveBookIds?: () => string[];
  /**
   * Map of book ID to its localized id/name in the current UI language.
   * When omitted, both the popover and the trigger label fall back to the
   * English book name (matching upstream's default behavior).
   */
  localizedBookNames?: LocalizedBookNames;
  className?: string;
};

// Wraps platform-bible-react's BookChapterControl and adapts it for chapter-only
// workflows: removes the verse part from the trigger label and hides the
// verse-nav chevrons inside the popover. Our export is chapter-level, so
// verse-level UI is misleading.
//
// paranext/paranext-core#2239 adds a `hideVerse` prop that does both natively.
// This wrapper is forward-compatible: it always passes `hideVerse`, and once
// the PR lands the local DOM/CSS shims become no-ops and this wrapper can be
// inlined or deleted.

// Forward-compat cast. Until #2239 ships in the linked dependency,
// `BookChapterControlProps` doesn't declare `hideVerse`. Passing the prop
// is harmless (React drops unknown props on the upstream component); this
// intersection just keeps TypeScript happy and becomes a no-op once the
// upstream prop type is updated.
const BookChapterControlCompat = BookChapterControl as ComponentType<
  ComponentProps<typeof BookChapterControl> & { hideVerse?: boolean }
>;

const HIDE_VERSE_NAV_STYLE_ID = 'flex-export-hide-verse-nav-buttons';

export function ChapterOnlyBookControl({
  scrRef,
  handleSubmit,
  getActiveBookIds,
  localizedBookNames,
  className,
}: Props) {
  // eslint-disable-next-line no-null/no-null -- React refs are initialized with null
  const wrapperRef = useRef<HTMLDivElement>(null);

  // The popover content is portaled to document.body, so a wrapper-scoped
  // selector can't reach it. Inject a global CSS rule (once per document)
  // that hides the verse-nav buttons by title. The titles are hardcoded
  // literal English in book-chapter-control.navigation.ts. Once #2239 lands,
  // upstream stops rendering these buttons when hideVerse=true and this
  // selector matches nothing.
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

  // Rewrite the trigger label without the verse part, in a locale-safe way.
  // formatScrRefRange omits the verse when verseNum is negative and collapses
  // start==end into a single ref — the same approach #2239 uses to compute
  // its display value. Once the PR lands and `hideVerse` is honored,
  // upstream renders this exact text and the assignment is a no-op.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const span = wrapper.querySelector<HTMLSpanElement>(
      'button[aria-label="book-chapter-trigger"] > span',
    );
    if (!span) return;
    const refWithoutVerse: SerializedVerseRef = { ...scrRef, verseNum: -1 };
    // Match upstream's `currentDisplayValue` book-name resolution: prefer the
    // localized name from the map, fall back to the canonical English name.
    // Without this we'd render "GEN" instead of "Genesis"/"Génesis"/etc.
    const bookName =
      localizedBookNames?.get(scrRef.book)?.localizedName ?? Canon.bookIdToEnglishName(scrRef.book);
    const stripped = formatScrRefRange(refWithoutVerse, refWithoutVerse, {
      optionOrLocalizedBookName: bookName,
    });
    if (span.textContent !== stripped) span.textContent = stripped;
  }, [scrRef.book, scrRef.chapterNum, scrRef.verseNum, localizedBookNames]);

  return (
    <div ref={wrapperRef} className="tw-contents">
      <BookChapterControlCompat
        scrRef={scrRef}
        handleSubmit={handleSubmit}
        getActiveBookIds={getActiveBookIds}
        localizedBookNames={localizedBookNames}
        className={className}
        hideVerse
      />
    </div>
  );
}
