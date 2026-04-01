using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using FlexTextBridge.Models;
using Newtonsoft.Json;

namespace FlexTextBridge.Services
{
    /// <summary>
    /// Represents a text segment with its writing system classification.
    /// </summary>
    public class TextSegment
    {
        /// <summary>
        /// The text content of this segment.
        /// </summary>
        public string Text { get; set; }

        /// <summary>
        /// True if this segment is vernacular (scripture content),
        /// false if it's analysis (markers, verse numbers, etc.)
        /// </summary>
        public bool IsVernacular { get; set; }

        /// <summary>
        /// Whether this segment should start a new paragraph.
        /// </summary>
        public bool StartsNewParagraph { get; set; }

        public TextSegment(string text, bool isVernacular, bool startsNewParagraph = false)
        {
            Text = text;
            IsVernacular = isVernacular;
            StartsNewParagraph = startsNewParagraph;
        }
    }

    /// <summary>
    /// Represents a paragraph consisting of multiple text segments.
    /// </summary>
    public class Paragraph
    {
        public List<TextSegment> Segments { get; } = new List<TextSegment>();

        public void AddSegment(string text, bool isVernacular)
        {
            if (!string.IsNullOrEmpty(text))
            {
                Segments.Add(new TextSegment(text, isVernacular));
            }
        }
    }

    /// <summary>
    /// Converts USJ (Unified Scripture JSON) to tagged USFM segments
    /// with proper writing system classification.
    /// </summary>
    public class UsjToUsfmConverter
    {
        // USFM markers that indicate paragraph-level content
        private static readonly HashSet<string> ParagraphMarkers = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "p", "m", "po", "pr", "cls", "pmo", "pm", "pmc", "pmr", "pi", "pi1", "pi2", "pi3",
            "mi", "nb", "pc", "ph", "ph1", "ph2", "ph3", "q", "q1", "q2", "q3", "q4",
            "qr", "qc", "qs", "qa", "qm", "qm1", "qm2", "qm3", "qd", "lh", "li", "li1",
            "li2", "li3", "li4", "lf", "lim", "lim1", "lim2", "lim3", "lim4", "litl",
            "b", "rem", "d", "sp", "sd", "sd1", "sd2", "sd3", "sd4"
        };

        // Introduction markers (only included if starting at chapter 1 and intro is enabled)
        private static readonly HashSet<string> IntroMarkers = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "imt", "imt1", "imt2", "imt3", "is", "is1", "is2", "is3",
            "ip", "ipi", "im", "imi", "ipq", "imq", "ipr", "iq", "iq1", "iq2", "iq3",
            "ib", "ili", "ili1", "ili2", "iot", "io", "io1", "io2", "io3", "io4",
            "iex", "imte", "imte1", "imte2", "ie"
        };

        // Section heading markers (marker is analysis WS, content is vernacular)
        private static readonly HashSet<string> SectionMarkers = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "s", "s1", "s2", "s3", "s4", "ms", "ms1", "ms2", "ms3",
            "mte", "mte1", "mte2", "mt", "mt1", "mt2", "mt3"
        };

        // Reference markers (marker is analysis WS, content is also analysis - references)
        private static readonly HashSet<string> ReferenceMarkers = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "sr", "r", "mr", "rq"
        };

        // Footnote markers (analysis WS for the markers, vernacular for content)
        private static readonly HashSet<string> FootnoteMarkers = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "f", "fe", "ef"
        };

        // Cross-reference markers (all analysis WS)
        private static readonly HashSet<string> CrossRefMarkers = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "x", "ex"
        };

        /// <summary>
        /// Convert USJ chapters to a list of paragraphs with tagged segments.
        /// </summary>
        /// <param name="usjChapters">Array of USJ chapter objects</param>
        /// <returns>List of paragraphs with properly tagged segments</returns>
        public List<Paragraph> ConvertToTaggedParagraphs(IEnumerable<UsjDocument> usjChapters)
        {
            var paragraphs = new List<Paragraph>();
            var currentParagraph = new Paragraph();

            foreach (var chapter in usjChapters)
            {
                if (chapter?.Content == null) continue;

                foreach (var node in chapter.Content)
                {
                    ProcessNode(node, currentParagraph, paragraphs, ref currentParagraph);
                }
            }

            // Add the last paragraph if it has content
            if (currentParagraph.Segments.Count > 0)
            {
                paragraphs.Add(currentParagraph);
            }

            return paragraphs;
        }

        /// <summary>
        /// Convert a single USJ document to paragraphs.
        /// </summary>
        public List<Paragraph> ConvertToTaggedParagraphs(UsjDocument usjDocument)
        {
            return ConvertToTaggedParagraphs(new[] { usjDocument });
        }

        /// <summary>
        /// Parse USJ from JSON string.
        /// </summary>
        public UsjDocument ParseUsj(string json)
        {
            return JsonConvert.DeserializeObject<UsjDocument>(json);
        }

        /// <summary>
        /// Parse multiple USJ chapters from JSON array string.
        /// </summary>
        public List<UsjDocument> ParseUsjArray(string json)
        {
            // Try parsing as array first
            try
            {
                return JsonConvert.DeserializeObject<List<UsjDocument>>(json);
            }
            catch
            {
                // Try as single document
                var doc = JsonConvert.DeserializeObject<UsjDocument>(json);
                return new List<UsjDocument> { doc };
            }
        }

        private void ProcessNode(UsjNode node, Paragraph currentParagraph, List<Paragraph> paragraphs, ref Paragraph activeParagraph)
        {
            if (node == null) return;

            var nodeType = node.Type?.ToLowerInvariant();
            var marker = node.Marker?.ToLowerInvariant();

            switch (nodeType)
            {
                case "book":
                    // Book identification - add marker and code as analysis
                    if (!string.IsNullOrEmpty(marker))
                    {
                        activeParagraph.AddSegment($"\\{marker} ", false);
                    }
                    if (!string.IsNullOrEmpty(node.Code))
                    {
                        activeParagraph.AddSegment($"{node.Code} ", false);
                    }
                    // Process any content (book title text would be vernacular)
                    ProcessContent(node.Content, activeParagraph, paragraphs, ref activeParagraph, true);
                    break;

                case "chapter":
                    // Chapter marker - start new paragraph, add marker as analysis
                    if (activeParagraph.Segments.Count > 0)
                    {
                        paragraphs.Add(activeParagraph);
                        activeParagraph = new Paragraph();
                    }
                    var chapterNum = node.Number ?? "1";
                    activeParagraph.AddSegment($"\\c {chapterNum} ", false);
                    break;

                case "verse":
                    // Verse marker - analysis WS
                    var verseNum = node.Number ?? "1";
                    activeParagraph.AddSegment($"\\v {verseNum} ", false);
                    break;

                case "para":
                    // Paragraph marker - check if it's a new paragraph type
                    bool isParaMarker = ParagraphMarkers.Contains(marker ?? "p");
                    bool isSectionMarker = SectionMarkers.Contains(marker ?? "");
                    bool isIntroMarker = IntroMarkers.Contains(marker ?? "");
                    bool isReferenceMarker = ReferenceMarkers.Contains(marker ?? "");

                    if (isParaMarker || isSectionMarker || isIntroMarker || isReferenceMarker)
                    {
                        // Start new paragraph
                        if (activeParagraph.Segments.Count > 0)
                        {
                            paragraphs.Add(activeParagraph);
                            activeParagraph = new Paragraph();
                        }
                        activeParagraph.AddSegment($"\\{marker ?? "p"} ", false);
                    }

                    // Process paragraph content
                    // Reference markers (\sr, \r, \mr) have analysis content (book/chapter/verse references)
                    // Section heading content and regular paragraph content is vernacular
                    ProcessContent(node.Content, activeParagraph, paragraphs, ref activeParagraph, isReferenceMarker);
                    break;

                case "char":
                    // Character-level markup
                    bool isFootnote = FootnoteMarkers.Contains(marker ?? "");
                    bool isCrossRef = CrossRefMarkers.Contains(marker ?? "");

                    if (isFootnote)
                    {
                        // Footnote: marker is analysis, content is mixed
                        var caller = node.Caller ?? "+";
                        activeParagraph.AddSegment($"\\{marker} {caller} ", false);
                        ProcessFootnoteContent(node.Content, activeParagraph);
                        activeParagraph.AddSegment($"\\{marker}* ", false);
                    }
                    else if (isCrossRef)
                    {
                        // Cross-reference: all analysis WS
                        var caller = node.Caller ?? "+";
                        activeParagraph.AddSegment($"\\{marker} {caller} ", false);
                        ProcessContent(node.Content, activeParagraph, paragraphs, ref activeParagraph, true);
                        activeParagraph.AddSegment($"\\{marker}* ", false);
                    }
                    else
                    {
                        // Other character styles - marker is analysis, content is vernacular
                        if (!string.IsNullOrEmpty(marker))
                        {
                            activeParagraph.AddSegment($"\\{marker} ", false);
                        }
                        ProcessContent(node.Content, activeParagraph, paragraphs, ref activeParagraph, false);
                        if (!string.IsNullOrEmpty(marker))
                        {
                            activeParagraph.AddSegment($"\\{marker}* ", false);
                        }
                    }
                    break;

                case "note":
                    // Notes (footnotes/cross-refs via note type)
                    var noteMarker = marker ?? "f";
                    var noteCaller = node.Caller ?? "+";
                    activeParagraph.AddSegment($"\\{noteMarker} {noteCaller} ", false);
                    ProcessFootnoteContent(node.Content, activeParagraph);
                    activeParagraph.AddSegment($"\\{noteMarker}* ", false);
                    break;

                case "figure":
                    // Figure - marker and attributes are analysis, caption content is vernacular
                    activeParagraph.AddSegment($"\\fig ", false);
                    if (!string.IsNullOrEmpty(node.File))
                        activeParagraph.AddSegment($"|src=\"{node.File}\" ", false);
                    if (!string.IsNullOrEmpty(node.Ref))
                        activeParagraph.AddSegment($"ref=\"{node.Ref}\" ", false);
                    // Caption text is translated (vernacular)
                    ProcessContent(node.Content, activeParagraph, paragraphs, ref activeParagraph, false);
                    activeParagraph.AddSegment("\\fig* ", false);
                    break;

                case "ms":
                    // Milestone markers - analysis WS
                    if (!string.IsNullOrEmpty(marker))
                    {
                        activeParagraph.AddSegment($"\\{marker} ", false);
                        if (!string.IsNullOrEmpty(node.Sid))
                            activeParagraph.AddSegment($"|sid=\"{node.Sid}\" ", false);
                        activeParagraph.AddSegment("\\* ", false);
                    }
                    break;

                case "text":
                    // Raw text content - vernacular by default
                    // (This case shouldn't normally occur in USJ but handle it)
                    ProcessContent(node.Content, activeParagraph, paragraphs, ref activeParagraph, false);
                    break;

                default:
                    // Unknown type - process content as vernacular
                    if (!string.IsNullOrEmpty(marker))
                    {
                        activeParagraph.AddSegment($"\\{marker} ", false);
                    }
                    ProcessContent(node.Content, activeParagraph, paragraphs, ref activeParagraph, false);
                    break;
            }
        }

        private void ProcessContent(List<object> content, Paragraph currentParagraph,
            List<Paragraph> paragraphs, ref Paragraph activeParagraph, bool allAnalysis)
        {
            if (content == null) return;

            foreach (var item in content)
            {
                if (item is string text)
                {
                    // Plain text - vernacular unless allAnalysis is true
                    activeParagraph.AddSegment(text, !allAnalysis);
                }
                else if (item is UsjNode node)
                {
                    ProcessNode(node, currentParagraph, paragraphs, ref activeParagraph);
                }
            }
        }

        private void ProcessFootnoteContent(List<object> content, Paragraph paragraph)
        {
            if (content == null) return;

            foreach (var item in content)
            {
                if (item is string text)
                {
                    // Footnote text content is vernacular
                    paragraph.AddSegment(text, true);
                }
                else if (item is UsjNode node)
                {
                    var marker = node.Marker?.ToLowerInvariant();

                    // Footnote internal markers
                    switch (marker)
                    {
                        case "fr": // Footnote reference (analysis)
                            paragraph.AddSegment($"\\fr ", false);
                            ProcessContentAsAnalysis(node.Content, paragraph);
                            break;
                        case "fk": // Footnote keyword (vernacular)
                            paragraph.AddSegment($"\\fk ", false);
                            ProcessContentAsVernacular(node.Content, paragraph);
                            break;
                        case "ft": // Footnote text (vernacular)
                            paragraph.AddSegment($"\\ft ", false);
                            ProcessContentAsVernacular(node.Content, paragraph);
                            break;
                        case "fq": // Footnote quotation (vernacular)
                        case "fqa": // Footnote alt quotation (vernacular)
                            paragraph.AddSegment($"\\{marker} ", false);
                            ProcessContentAsVernacular(node.Content, paragraph);
                            break;
                        case "fv": // Footnote verse number (analysis)
                            paragraph.AddSegment($"\\fv ", false);
                            ProcessContentAsAnalysis(node.Content, paragraph);
                            paragraph.AddSegment("\\fv* ", false);
                            break;
                        default:
                            // Default: marker is analysis, content is vernacular
                            if (!string.IsNullOrEmpty(marker))
                            {
                                paragraph.AddSegment($"\\{marker} ", false);
                            }
                            ProcessContentAsVernacular(node.Content, paragraph);
                            break;
                    }
                }
            }
        }

        private void ProcessContentAsAnalysis(List<object> content, Paragraph paragraph)
        {
            if (content == null) return;
            foreach (var item in content)
            {
                if (item is string text)
                {
                    paragraph.AddSegment(text, false);
                }
            }
        }

        private void ProcessContentAsVernacular(List<object> content, Paragraph paragraph)
        {
            if (content == null) return;
            foreach (var item in content)
            {
                if (item is string text)
                {
                    paragraph.AddSegment(text, true);
                }
            }
        }
    }
}
