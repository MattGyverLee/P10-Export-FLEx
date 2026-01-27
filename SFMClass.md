# USFM Marker Classification for FLEx Export

This document classifies USFM markers as either **Vernacular** (translated content) or **Analysis** (metadata/structure) for proper writing system tagging when exporting to FLEx.

**Classification Criteria:**
- **Vernacular (V)**: Content that is translated into the target language (scripture text, headings, notes content)
- **Analysis (A)**: Structural markers, references, identifiers, and metadata (chapter/verse numbers, book codes, references)
- **Mixed (M)**: Marker is analysis, but content is vernacular (most common pattern)

**Pattern:** For most markers, the SFM tag itself (e.g., `\s`) is **Analysis**, while the text content following it is **Vernacular**.

---

## Identification Markers

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `\id` | A | A | File identification | Book code (e.g., "GEN") is metadata |
| `\usfm` | A | A | USFM version | Version number is metadata |
| `\ide` | A | A | Character encoding | Technical metadata |
| `\sts` | A | A | Status tracking | Project metadata |
| `\rem` | A | A | Remark/comment | Translator notes (typically analysis language) |
| `\h` | A | V | Running header | Header text is translated |
| `\toc1` | A | V | Long table of contents | Book name is translated |
| `\toc2` | A | V | Short table of contents | Abbreviated name is translated |
| `\toc3` | A | V | Book abbreviation | Abbreviation is translated |
| `\toca1` | A | V | Alt language TOC long | Alternative translation |
| `\toca2` | A | V | Alt language TOC short | Alternative translation |
| `\toca3` | A | V | Alt language abbreviation | Alternative translation |

---

## Introduction Markers

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `\imt#` | A | V | Intro major title | Title text is translated |
| `\is#` | A | V | Intro section heading | Heading text is translated |
| `\ip` | A | V | Intro paragraph | Content is translated |
| `\ipi` | A | V | Intro indented paragraph | Content is translated |
| `\im` | A | V | Intro margin paragraph | Content is translated |
| `\imi` | A | V | Intro indented margin | Content is translated |
| `\ipq` | A | V | Intro quote paragraph | Quoted text is translated |
| `\imq` | A | V | Intro margin quote | Quoted text is translated |
| `\ipr` | A | A | Intro right-aligned | Typically references (analysis) |
| `\iq#` | A | V | Intro poetic line | Poetry is translated |
| `\ib` | A | - | Intro blank line | No content |
| `\ili#` | A | V | Intro list item | List content is translated |
| `\iot` | A | V | Intro outline title | Title is translated |
| `\io#` | A | V | Intro outline entry | Entry text is translated |
| `\ior...\ior*` | A | A | Intro outline reference | References are analysis |
| `\iqt...\iqt*` | A | V | Intro quoted text | Quoted scripture is vernacular |
| `\iex` | A | V | Intro explanatory text | Explanatory content is translated |
| `\imte#` | A | V | Intro major title ending | Title is translated |
| `\ie` | A | - | Intro end marker | No content |

---

## Titles, Headings, and Labels

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `\mt#` | A | V | Major title | Book title is translated |
| `\mte#` | A | V | Major title ending | Title is translated |
| `\ms#` | A | V | Major section heading | Heading is translated |
| `\mr` | A | A | Major section reference | References are analysis |
| `\s#` | A | V | Section heading | **Heading text is translated** |
| `\sr` | A | A | Section reference range | References are analysis |
| `\r` | A | A | Parallel passage reference | References are analysis |
| `\rq...\rq*` | A | A | Inline quotation reference | References are analysis |
| `\d` | A | V | Descriptive title (Psalm) | Hebrew subtitle is translated |
| `\sp` | A | V | Speaker identification | Speaker name is translated |
| `\sd#` | A | - | Semantic division | No content (spacing marker) |

---

## Chapters and Verses

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `\c` | A | A | Chapter number | Number is analysis |
| `\ca...\ca*` | A | A | Alternate chapter number | Number is analysis |
| `\cl` | A | V | Chapter label | "Chapter" word is translated |
| `\cp` | A | A | Published chapter character | Display character is analysis |
| `\cd` | A | V | Chapter description | Description is translated |
| `\v` | A | A | Verse number | Number is analysis |
| `\va...\va*` | A | A | Alternate verse number | Number is analysis |
| `\vp...\vp*` | A | A | Published verse character | Display character is analysis |

---

## Paragraphs

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `\p` | A | V | Normal paragraph | Scripture text is vernacular |
| `\m` | A | V | Margin paragraph | Scripture text is vernacular |
| `\po` | A | V | Letter opening | Text is translated |
| `\pr` | A | V | Right-aligned (refrain) | Refrain text is translated |
| `\cls` | A | V | Letter closing | Text is translated |
| `\pmo` | A | V | Embedded text opening | Quoted text is translated |
| `\pm` | A | V | Embedded text paragraph | Quoted text is translated |
| `\pmc` | A | V | Embedded text closing | Quoted text is translated |
| `\pmr` | A | V | Embedded text refrain | Refrain is translated |
| `\pi#` | A | V | Indented paragraph | Scripture text is vernacular |
| `\mi` | A | V | Indented margin paragraph | Scripture text is vernacular |
| `\nb` | A | - | No-break marker | No content |
| `\pc` | A | V | Centered paragraph | Text is translated |
| `\ph#` | A | V | Hanging indent (deprecated) | Text is translated |
| `\b` | A | - | Blank line | No content |

---

## Poetry

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `\q#` | A | V | Poetic line | Poetry is translated |
| `\qr` | A | V | Right-aligned poetry | Refrain is translated |
| `\qc` | A | V | Centered poetry | Poetry is translated |
| `\qs...\qs*` | A | V | Selah | "Selah" is translated/transliterated |
| `\qa` | A | V | Acrostic heading | Acrostic letter name is translated |
| `\qac...\qac*` | A | V | Acrostic letter | Letter is vernacular |
| `\qm#` | A | V | Embedded poetic line | Poetry is translated |
| `\qd` | A | V | Hebrew note (musical) | Musical note is translated |

---

## Lists

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `\lh` | A | V | List header | Header text is translated |
| `\li#` | A | V | List entry | List content is translated |
| `\lf` | A | V | List footer | Footer text is translated |
| `\lim#` | A | V | Embedded list entry | List content is translated |
| `\litl...\litl*` | A | V | List total | Numbers may be localized |
| `\lik...\lik*` | A | V | List key | Key text is translated |
| `\liv#...\liv#*` | A | V | List value | Value text is translated |

---

## Tables

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `\tr` | A | - | Table row | No direct content |
| `\th#` | A | V | Table heading | Heading text is translated |
| `\thr#` | A | V | Table heading (right) | Heading text is translated |
| `\tc#` | A | V | Table cell | Cell content is translated |
| `\tcr#` | A | V | Table cell (right) | Cell content is translated |

---

## Footnotes

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `\f...\f*` | A | - | Footnote container | Caller is analysis |
| `\fe...\fe*` | A | - | Endnote container | Caller is analysis |
| `\fr` | A | A | Footnote reference | Chapter:verse is analysis |
| `\fq` | A | V | Footnote quotation | **Quoted scripture is vernacular** |
| `\fqa` | A | V | Footnote alternate | **Alternate translation is vernacular** |
| `\fk` | A | V | Footnote keyword | **Keyword is vernacular** |
| `\fl` | A | A | Footnote label | Labels like "Or", "Heb." are analysis |
| `\fw` | A | A | Footnote witness | Sigla are analysis |
| `\fp` | A | V | Footnote paragraph | **Note content is vernacular** |
| `\fv...\fv*` | A | A | Footnote verse number | Verse number is analysis |
| `\ft` | A | V | Footnote text | **Explanatory text is vernacular** |
| `\fdc...\fdc*` | A | V | Deuterocanonical (deprecated) | Content is vernacular |
| `\fm...\fm*` | A | A | Footnote reference mark | Reference mark is analysis |

---

## Cross References

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `\x...\x*` | A | - | Cross-ref container | Caller is analysis |
| `\xo` | A | A | Cross-ref origin | Chapter:verse is analysis |
| `\xk` | A | V | Cross-ref keyword | Keyword from text is vernacular |
| `\xq` | A | V | Cross-ref quotation | Quoted text is vernacular |
| `\xt...\xt*` | A | A | Cross-ref target | **References are analysis** |
| `\xta` | A | A | Cross-ref added text | Connector text is analysis |
| `\xop...\xop*` | A | A | Published origin | Reference text is analysis |
| `\xot...\xot*` | A | A | OT-only reference | Reference is analysis |
| `\xnt...\xnt*` | A | A | NT-only reference | Reference is analysis |
| `\xdc...\xdc*` | A | A | DC-only reference | Reference is analysis |

---

## Character Markers (Special Text)

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `\add...\add*` | A | V | Translator addition | Added words are vernacular |
| `\bk...\bk*` | A | V | Book title | Book name is translated |
| `\dc...\dc*` | A | V | Deuterocanonical | Content is vernacular |
| `\k...\k*` | A | V | Keyword | Keyword is vernacular |
| `\lit` | A | V | Liturgical note | Note content is translated |
| `\nd...\nd*` | A | V | Name of Deity | Divine name is vernacular |
| `\ord...\ord*` | A | V | Ordinal ending | Ordinal is vernacular |
| `\pn...\pn*` | A | V | Proper name | Name is vernacular |
| `\png...\png*` | A | V | Geographic name | Place name is vernacular |
| `\addpn...\addpn*` | A | V | Added proper name | Name is vernacular |
| `\qt...\qt*` | A | V | Quoted text (OT in NT) | Quoted scripture is vernacular |
| `\sig...\sig*` | A | V | Signature | Signature is vernacular |
| `\sls...\sls*` | A | V | Secondary language | Alt language text is vernacular |
| `\tl...\tl*` | A | V | Transliteration | Foreign word is vernacular |
| `\wj...\wj*` | A | V | Words of Jesus | Jesus's words are vernacular |

---

## Character Styling

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `\em...\em*` | A | V | Emphasis | Emphasized text is vernacular |
| `\bd...\bd*` | A | V | Bold | Bold text is vernacular |
| `\it...\it*` | A | V | Italic | Italic text is vernacular |
| `\bdit...\bdit*` | A | V | Bold-italic | Styled text is vernacular |
| `\no...\no*` | A | V | Normal | Normal text is vernacular |
| `\sc...\sc*` | A | V | Small caps | Small cap text is vernacular |
| `\sup...\sup*` | A | V | Superscript | Superscript is vernacular |

---

## Special Features

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `~` | - | - | No-break space | Spacing only |
| `//` | - | - | Discretionary break | Formatting only |
| `\pb` | A | - | Page break | No content |
| `\fig...\fig*` | A | V | Figure/image | Caption is translated |
| `\ndx...\ndx*` | A | V | Index entry | Entry text is vernacular |
| `\rb...\rb*` | A | V | Ruby base text | Base text is vernacular |
| `\pro...\pro*` | A | A | Pronunciation | Phonetic guide is analysis |
| `\w...\w*` | A | V | Glossary word | Word is vernacular |
| `\wg...\wg*` | A | A | Greek word | Greek is analysis |
| `\wh...\wh*` | A | A | Hebrew word | Hebrew is analysis |
| `\wa...\wa*` | A | A | Aramaic word | Aramaic is analysis |

---

## Milestones

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `\qt#-s\*` | A | - | Quote start | Attribute (who) is analysis |
| `\qt#-e\*` | A | - | Quote end | No content |
| `\ts-s\*` | A | - | Translator section start | No content |
| `\ts-e\*` | A | - | Translator section end | No content |

---

## Extended Study Content

| Marker | Marker WS | Content WS | Description | Notes |
|--------|-----------|------------|-------------|-------|
| `\ef...\ef*` | A | V | Extended footnote | Study note content is vernacular |
| `\ex...\ex*` | A | A | Extended cross-ref | References are analysis |
| `\esb...\esbe` | A | V | Sidebar | Sidebar content is translated |
| `\cat...\cat*` | A | A | Category marker | Category label is analysis |

---

## Summary: Key Patterns

1. **All SFM markers** (`\xxx`) are **Analysis** - they are structural codes, not translated content

2. **Scripture text content** (paragraphs, poetry, headings) is **Vernacular**

3. **References** (verse numbers, chapter numbers, cross-references) are **Analysis**

4. **Section headings** (`\s`, `\s1`, `\s2`, `\s3`) - marker is Analysis, **content is Vernacular**

5. **Footnote content** (`\ft`, `\fq`, `\fk`, `\fqa`) is **Vernacular** (translated explanatory text)

6. **Cross-reference targets** (`\xt`) are **Analysis** (book/chapter/verse references)

7. **Labels** (`\fl` "Or", "Heb.") are **Analysis** (standard abbreviations)

---

## Implementation Notes for FlexTextBridge

Current implementation in `UsjToUsfmConverter.cs` correctly tags:

### Analysis Writing System:
- `\c`, `\v` markers and their numbers
- `\fr` (footnote reference)
- `\xt` (cross-reference targets)
- `\sr`, `\r`, `\mr` (reference markers - content is references)
- All opening/closing markers (`\xxx`, `\xxx*`)
- Figure attributes (src, ref)

### Vernacular Writing System:
- `\p`, `\m`, `\q#` paragraph content
- `\s`, `\s1`, `\s2`, `\s3` section heading **content**
- `\ms`, `\mt` major section/title **content**
- `\ft` footnote text
- `\fq`, `\fqa`, `\fk` footnote quotations and keywords
- `\fig` caption text

### Recent Fixes (2025-01):
1. **Section heading content** - Changed from analysis to vernacular (the marker `\s` is analysis, but "Jesus Heals the Blind" is vernacular)
2. **Reference markers** (`\sr`, `\r`, `\mr`) - Separated from section markers; content remains analysis (references like "Matt 5:1-12")
3. **Figure captions** - Changed from analysis to vernacular (captions are translated)
