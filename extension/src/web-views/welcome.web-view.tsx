import { WebViewProps } from "@papi/core";
import papi from "@papi/frontend";
import { useLocalizedStrings, useProjectSetting, useSetting } from "@papi/frontend/react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { BookChapterControl, Button, Checkbox, ComboBox, Label } from "platform-bible-react";
import { isPlatformError, getChaptersForBook } from "platform-bible-utils";
import { Canon, SerializedVerseRef } from "@sillsdev/scripture";

// Project option type for ComboBox
type ProjectOption = {
  label: string;
  id: string;
};

// Default scripture reference
const DEFAULT_SCR_REF: SerializedVerseRef = { book: "GEN", chapterNum: 1, verseNum: 1 };

// RTL language codes (primary language codes that use right-to-left scripts)
const RTL_LANGUAGES = ["ar", "he", "fa", "ps", "ur", "yi", "ku", "sd", "ug"];

// Helper to check if a language code is RTL
const isRtlLanguage = (langCode: string | undefined): boolean => {
  if (!langCode) return false;
  const baseCode = langCode.split("-")[0].toLowerCase();
  return RTL_LANGUAGES.includes(baseCode);
};

// Localization string keys
const LOCALIZED_STRING_KEYS = [
  "%flexExport_title%",
  "%flexExport_paratextProject%",
  "%flexExport_selectProject%",
  "%flexExport_searchProjects%",
  "%flexExport_noProjectsFound%",
  "%flexExport_noProjectSelected%",
  "%flexExport_selectBookChapter%",
  "%flexExport_toChapter%",
  "%flexExport_endChapter%",
  "%flexExport_includeInExport%",
  "%flexExport_footnotes%",
  "%flexExport_crossReferences%",
  "%flexExport_introduction%",
  "%flexExport_remarks%",
  "%flexExport_figures%",
  "%flexExport_formatted%",
  "%flexExport_usfm%",
  "%flexExport_usjData%",
  "%flexExport_scripturePreview%",
  "%flexExport_usfmPreview%",
  "%flexExport_usjJsonData%",
  "%flexExport_loading%",
  "%flexExport_noScriptureData%",
  "%flexExport_noUsjData%",
  "%flexExport_loadingScripture%",
  "%flexExport_chapter%",
  "%flexExport_remark%",
  "%flexExport_figure%",
  "%flexExport_footnote%",
];

globalThis.webViewComponent = function ExportToFlexWebView({
  projectId,
  updateWebViewDefinition,
  state,
}: WebViewProps) {
  // Localized strings
  const [localizedStrings] = useLocalizedStrings(LOCALIZED_STRING_KEYS);

  // Get UI locale direction for RTL interface support
  const [interfaceLanguages] = useSetting("platform.interfaceLanguage", ["en"]);
  const uiLanguage = Array.isArray(interfaceLanguages) ? interfaceLanguages[0] : "en";
  const isUiRtl = isRtlLanguage(uiLanguage);

  // Get initial scripture reference from state (captured when dialog was opened)
  const initialScrRef = state?.initialScrRef as SerializedVerseRef | undefined;

  // Scripture reference state - initialized from the captured reference
  const [scrRef, setScrRef] = useState<SerializedVerseRef>(initialScrRef || DEFAULT_SCR_REF);

  // End chapter for range selection (defaults to start chapter)
  const [endChapter, setEndChapter] = useState(initialScrRef?.chapterNum || 1);

  // Content filter toggles (all disabled by default, except figures)
  const [includeFootnotes, setIncludeFootnotes] = useState(false);
  const [includeCrossRefs, setIncludeCrossRefs] = useState(false);
  const [includeIntro, setIncludeIntro] = useState(false);
  const [includeRemarks, setIncludeRemarks] = useState(false);
  const [includeFigures, setIncludeFigures] = useState(true);

  // Get chapter count for current book
  const chapterCount = useMemo(() => {
    const bookNum = Canon.bookIdToNumber(scrRef.book);
    const count = getChaptersForBook(bookNum);
    return count > 0 ? count : 1;
  }, [scrRef.book]);

  // When start chapter changes, reset end chapter to match (and clamp to valid range)
  const handleStartRefChange = useCallback(
    (newScrRef: { book: string; chapterNum: number; verseNum: number }) => {
      setScrRef(newScrRef);
      // Reset end chapter to start chapter when start changes
      setEndChapter(newScrRef.chapterNum);
    },
    []
  );

  // End chapter options: only chapters >= start chapter
  const endChapterOptions = useMemo(() => {
    const options: number[] = [];
    for (let i = scrRef.chapterNum; i <= chapterCount; i++) {
      options.push(i);
    }
    return options;
  }, [scrRef.chapterNum, chapterCount]);

  // Project options state for ComboBox
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);

  // Fetch available projects on mount (only editable projects, not downloaded resources)
  useEffect(() => {
    let cancelled = false;

    const fetchProjects = async () => {
      try {
        const options: ProjectOption[] = [];
        // Get all projects that support USJ_Chapter
        const allMetadata = await papi.projectLookup.getMetadataForAllProjects({
          includeProjectInterfaces: ["platformScripture.USJ_Chapter"],
        });

        await Promise.all(
          allMetadata.map(async (metadata: { id: string }) => {
            try {
              const pdp = await papi.projectDataProviders.get("platform.base", metadata.id);
              // TEMPORARILY DISABLED: Allow non-editable projects for testing Arabic resources
              // Check if project is editable (resources are not editable)
              // Note: platform.isEditable is project-level, not user-permission-level
              // const isEditable = await pdp.getSetting("platform.isEditable");
              // if (!isEditable) return; // Skip resources

              const name = await pdp.getSetting("platform.name");
              options.push({
                label: name || metadata.id,
                id: metadata.id,
              });
            } catch {
              // If we can't get settings, skip this project
            }
          })
        );

        if (!cancelled) {
          setProjectOptions(options.sort((a, b) => a.label.localeCompare(b.label)));
        }
      } catch (err) {
        console.error("Failed to fetch projects:", err);
      }
    };

    fetchProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  // Find selected project option
  const selectedProject = useMemo(() => {
    if (!projectId || !projectOptions.length) return undefined;
    return projectOptions.find((p) => p.id === projectId);
  }, [projectId, projectOptions]);

  // Handle project selection from ComboBox
  const handleProjectChange = useCallback(
    (option: ProjectOption | undefined) => {
      if (option) {
        updateWebViewDefinition({ projectId: option.id });
      }
    },
    [updateWebViewDefinition]
  );

  // Get project name for display (fallback if ComboBox hasn't loaded)
  const [projectNameSetting] = useProjectSetting(projectId ?? undefined, "platform.name", "");

  // Get text direction setting for RTL support
  const [textDirectionSetting] = useProjectSetting(projectId ?? undefined, "platform.textDirection", "");
  const isRtl = textDirectionSetting === "rtl";

  // Get project font settings (using raw Paratext setting names)
  const [projectFont] = useProjectSetting(projectId ?? undefined, "DefaultFont", "");
  const [projectFontSize] = useProjectSetting(projectId ?? undefined, "DefaultFontSize", "");
  const fontFamily = isPlatformError(projectFont) ? undefined : projectFont || undefined;
  const fontSize = isPlatformError(projectFontSize) ? undefined : projectFontSize ? `${projectFontSize}pt` : undefined;

  const displayProjectName = useMemo(() => {
    if (!projectId) return localizedStrings["%flexExport_noProjectSelected%"];
    if (selectedProject) return selectedProject.label;
    if (isPlatformError(projectNameSetting)) return projectId;
    return projectNameSetting || projectId;
  }, [projectId, selectedProject, projectNameSetting, localizedStrings]);

  // USJ node type interface
  interface UsjNode {
    type?: string;
    marker?: string;
    content?: (UsjNode | string)[];
    number?: string;
    code?: string;
    caller?: string;
  }

  // USJ data type for chapter
  interface ChapterUSJData {
    type?: string;
    version?: string;
    content?: (UsjNode | string)[];
  }

  // State for fetched chapters
  const [chaptersUSJ, setChaptersUSJ] = useState<ChapterUSJData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all chapters in the range
  useEffect(() => {
    let cancelled = false;

    const fetchChapters = async () => {
      if (!projectId) {
        setChaptersUSJ([]);
        return;
      }

      setIsLoading(true);
      try {
        const pdp = await papi.projectDataProviders.get(
          "platformScripture.USJ_Chapter",
          projectId
        );

        const chapters: ChapterUSJData[] = [];
        for (let ch = scrRef.chapterNum; ch <= endChapter; ch++) {
          const ref = { book: scrRef.book, chapterNum: ch, verseNum: 1 };
          const usj = await pdp.getChapterUSJ(ref);
          if (!cancelled && usj && !isPlatformError(usj)) {
            chapters.push(usj as ChapterUSJData);
          }
        }

        if (!cancelled) {
          setChaptersUSJ(chapters);
        }
      } catch (err) {
        console.error("Failed to fetch chapters:", err);
        if (!cancelled) {
          setChaptersUSJ([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchChapters();

    return () => {
      cancelled = true;
    };
  }, [projectId, scrRef.book, scrRef.chapterNum, endChapter]);

  type ViewMode = "formatted" | "usfm" | "usj";
  const [viewMode, setViewMode] = useState<ViewMode>("formatted");

  // Helper to check if a marker is an introduction marker
  const isIntroMarker = (marker: string): boolean => {
    // Intro markers: imt, is, ip, ipi, im, imi, ipq, imq, ipr, iq, ib, ili, iot, io, iex, ie
    return /^(imt\d?|is\d?|ip|ipi|im|imi|ipq|imq|ipr|iq\d?|ib|ili\d?|iot|io\d?|iex|ie)$/.test(marker);
  };

  // Helper to check if a marker is a remark marker
  const isRemarkMarker = (marker: string): boolean => {
    return marker === "rem";
  };

  // Helper to check if a marker is a figure marker
  const isFigureMarker = (marker: string): boolean => {
    return marker === "fig";
  };

  // Helper to check if a marker is a cross-reference marker
  const isCrossRefMarker = (marker: string): boolean => {
    return marker === "x" || marker === "r";
  };

  // Convert USJ to USFM text
  const usfmText = useMemo(() => {
    if (isLoading) return localizedStrings["%flexExport_loading%"];
    if (!chaptersUSJ.length) return localizedStrings["%flexExport_noScriptureData%"];

    const convertToUsfm = (content: (UsjNode | string)[], isFirstChapter: boolean): string => {
      return content
        .map((item) => {
          if (typeof item === "string") return item;
          const node = item as UsjNode;

          if (node.type === "book" && node.code) {
            const bookContent = node.content ? convertToUsfm(node.content, isFirstChapter) : "";
            return `\\id ${node.code} ${bookContent}\n`;
          }
          if (node.type === "chapter" && node.number) {
            return `\\c ${node.number}\n`;
          }
          if (node.type === "verse" && node.number) {
            return `\\v ${node.number} `;
          }
          if (node.type === "para" && node.marker) {
            // Skip intro paragraphs if not including intro (only for chapter 1)
            if (!includeIntro && isFirstChapter && isIntroMarker(node.marker)) {
              return "";
            }
            // Skip cross-reference paragraphs (\r) if not including cross-refs
            if (!includeCrossRefs && node.marker === "r") {
              return "";
            }
            // Skip remarks if not including them
            if (!includeRemarks && isRemarkMarker(node.marker)) {
              return "";
            }
            const paraContent = node.content ? convertToUsfm(node.content, isFirstChapter) : "";
            return `\\${node.marker} ${paraContent}\n`;
          }
          if (node.type === "char" && node.marker) {
            // Skip figures if not including them
            if (!includeFigures && isFigureMarker(node.marker)) {
              return "";
            }
            const charContent = node.content ? convertToUsfm(node.content, isFirstChapter) : "";
            return `\\${node.marker} ${charContent}\\${node.marker}*`;
          }
          if (node.type === "note" && node.marker) {
            // Skip footnotes if not including them
            if (!includeFootnotes && node.marker === "f") {
              return "";
            }
            // Skip cross-references if not including them
            if (!includeCrossRefs && isCrossRefMarker(node.marker)) {
              return "";
            }
            const noteContent = node.content ? convertToUsfm(node.content, isFirstChapter) : "";
            return `\\${node.marker} ${node.caller || "+"} ${noteContent}\\${node.marker}*`;
          }
          if (node.content) {
            return convertToUsfm(node.content, isFirstChapter);
          }
          return "";
        })
        .join("");
    };

    // Combine all chapters' USFM
    return chaptersUSJ
      .map((chapter, idx) => {
        if (chapter.content) {
          const isFirstChapter = idx === 0 && scrRef.chapterNum === 1;
          return convertToUsfm(chapter.content as (UsjNode | string)[], isFirstChapter);
        }
        return "";
      })
      .join("\n");
  }, [chaptersUSJ, isLoading, includeFootnotes, includeCrossRefs, includeIntro, includeRemarks, includeFigures, scrRef.chapterNum, localizedStrings]);

  // Convert USJ to formatted HTML-like preview
  const formattedPreview = useMemo(() => {
    if (isLoading) return <div>{localizedStrings["%flexExport_loading%"]}</div>;
    if (!chaptersUSJ.length) return <div>{localizedStrings["%flexExport_noScriptureData%"]}</div>;

    const renderContent = (content: (UsjNode | string)[], key = "", isFirstChapter = false): React.ReactNode[] => {
      return content.map((item, idx) => {
        const itemKey = `${key}-${idx}`;
        if (typeof item === "string") return <span key={itemKey}>{item}</span>;

        const node = item as UsjNode;

        if (node.type === "chapter" && node.number) {
          return (
            <div key={itemKey} className="tw-text-lg tw-font-bold tw-mb-3 tw-text-foreground">
              {localizedStrings["%flexExport_chapter%"]} {node.number}
            </div>
          );
        }
        if (node.type === "verse" && node.number) {
          return (
            <sup key={itemKey} className="tw-text-xs tw-font-bold tw-text-primary tw-mr-1">
              {node.number}
            </sup>
          );
        }
        if (node.type === "para" && node.marker) {
          // Skip intro paragraphs if not including intro (only for chapter 1)
          if (!includeIntro && isFirstChapter && isIntroMarker(node.marker)) {
            return null;
          }
          // Skip cross-reference paragraphs (\r) if not including cross-refs
          if (!includeCrossRefs && node.marker === "r") {
            return null;
          }
          // Skip remarks if not including them
          if (!includeRemarks && isRemarkMarker(node.marker)) {
            return null;
          }

          const isHeader = node.marker.startsWith("s") || node.marker === "ms";
          const isPoetry = node.marker.startsWith("q");
          const isBlank = node.marker === "b";
          const isIntro = isIntroMarker(node.marker);
          const isRemark = isRemarkMarker(node.marker);

          if (isBlank) {
            return <div key={itemKey} className="tw-h-3" />;
          }
          if (isHeader) {
            return (
              <div key={itemKey} className="tw-font-semibold tw-mt-4 tw-mb-2 tw-text-foreground">
                {node.content && renderContent(node.content, itemKey, isFirstChapter)}
              </div>
            );
          }
          if (isPoetry) {
            const indent = parseInt(node.marker.slice(1) || "1", 10);
            return (
              <div key={itemKey} className="tw-mb-1" style={{ marginLeft: `${indent * 1.5}rem` }}>
                {node.content && renderContent(node.content, itemKey, isFirstChapter)}
              </div>
            );
          }
          if (isIntro) {
            return (
              <p key={itemKey} className="tw-mb-2 tw-italic tw-text-muted-foreground">
                {node.content && renderContent(node.content, itemKey, isFirstChapter)}
              </p>
            );
          }
          if (isRemark) {
            return (
              <p key={itemKey} className="tw-mb-2 tw-text-sm tw-text-muted-foreground tw-bg-muted tw-p-1 tw-rounded">
                [{localizedStrings["%flexExport_remark%"]} {node.content && renderContent(node.content, itemKey, isFirstChapter)}]
              </p>
            );
          }
          return (
            <p key={itemKey} className="tw-mb-2">
              {node.content && renderContent(node.content, itemKey, isFirstChapter)}
            </p>
          );
        }
        if (node.type === "char" && node.marker) {
          // Skip figures if not including them
          if (!includeFigures && isFigureMarker(node.marker)) {
            return null;
          }
          const isBold = node.marker === "bd" || node.marker === "bdit";
          const isItalic = node.marker === "it" || node.marker === "bdit";
          const isWordsOfJesus = node.marker === "wj";
          const isFigure = isFigureMarker(node.marker);
          let className = "";
          if (isBold) className += "tw-font-bold ";
          if (isItalic) className += "tw-italic ";
          if (isWordsOfJesus) className += "tw-text-red-600 ";
          if (isFigure) {
            return (
              <span key={itemKey} className="tw-text-sm tw-text-muted-foreground tw-bg-muted tw-p-1 tw-rounded">
                [{localizedStrings["%flexExport_figure%"]} {node.content && renderContent(node.content, itemKey, isFirstChapter)}]
              </span>
            );
          }
          return (
            <span key={itemKey} className={className}>
              {node.content && renderContent(node.content, itemKey, isFirstChapter)}
            </span>
          );
        }
        if (node.type === "note" && node.marker) {
          // Skip footnotes if not including them
          if (!includeFootnotes && node.marker === "f") {
            return null;
          }
          // Skip cross-references if not including them
          if (!includeCrossRefs && isCrossRefMarker(node.marker)) {
            return null;
          }
          return (
            <sup key={itemKey} className="tw-text-xs tw-text-muted-foreground tw-cursor-help" title={localizedStrings["%flexExport_footnote%"]}>
              [{node.caller || "*"}]
            </sup>
          );
        }
        if (node.content) {
          return <span key={itemKey}>{renderContent(node.content, itemKey, isFirstChapter)}</span>;
        }
        return null;
      });
    };

    // Render all chapters
    return (
      <div>
        {chaptersUSJ.map((chapter, chapterIdx) => {
          const isFirstChapter = chapterIdx === 0 && scrRef.chapterNum === 1;
          return (
            <div key={`chapter-${chapterIdx}`}>
              {chapter.content && renderContent(chapter.content as (UsjNode | string)[], `ch-${chapterIdx}`, isFirstChapter)}
            </div>
          );
        })}
      </div>
    );
  }, [chaptersUSJ, isLoading, includeFootnotes, includeCrossRefs, includeIntro, includeRemarks, includeFigures, scrRef.chapterNum, localizedStrings]);

  // Filter USJ content based on toggles
  const filterUsjContent = useCallback(
    (content: (UsjNode | string)[], isFirstChapter: boolean): (UsjNode | string)[] => {
      return content
        .map((item) => {
          if (typeof item === "string") return item;
          const node = item as UsjNode;

          // Skip intro paragraphs if not including intro (only for chapter 1)
          if (node.type === "para" && node.marker) {
            if (!includeIntro && isFirstChapter && isIntroMarker(node.marker)) {
              return null;
            }
            if (!includeCrossRefs && node.marker === "r") {
              return null;
            }
            if (!includeRemarks && isRemarkMarker(node.marker)) {
              return null;
            }
          }

          // Skip footnotes and cross-references
          if (node.type === "note" && node.marker) {
            if (!includeFootnotes && node.marker === "f") {
              return null;
            }
            if (!includeCrossRefs && isCrossRefMarker(node.marker)) {
              return null;
            }
          }

          // Skip figures
          if (node.type === "char" && node.marker) {
            if (!includeFigures && isFigureMarker(node.marker)) {
              return null;
            }
          }

          // Recursively filter content
          if (node.content) {
            const filteredContent = filterUsjContent(node.content, isFirstChapter);
            return { ...node, content: filteredContent };
          }

          return node;
        })
        .filter((item): item is UsjNode | string => item !== null);
    },
    [includeFootnotes, includeCrossRefs, includeIntro, includeRemarks, includeFigures]
  );

  // Format USJ as JSON for debug view (with filtering applied)
  const usjJson = useMemo(() => {
    if (!chaptersUSJ.length) return "";

    const filteredChapters = chaptersUSJ.map((chapter, idx) => {
      const isFirstChapter = idx === 0 && scrRef.chapterNum === 1;
      if (chapter.content) {
        return {
          ...chapter,
          content: filterUsjContent(chapter.content as (UsjNode | string)[], isFirstChapter),
        };
      }
      return chapter;
    });

    return JSON.stringify(filteredChapters, null, 2);
  }, [chaptersUSJ, filterUsjContent, scrRef.chapterNum]);

  // Render USJ JSON with RTL-aware string values
  const renderUsjWithDirection = useMemo(() => {
    if (!usjJson) return null;

    // If not RTL, just return plain text
    if (!isRtl) {
      return <span>{usjJson}</span>;
    }

    // For RTL, we need to render string values with RTL direction
    // Split by quoted strings and render them with appropriate direction
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    // Match JSON string values (content after a colon or in arrays)
    const stringRegex = /("(?:[^"\\]|\\.)*")/g;
    let match;
    let partIndex = 0;

    while ((match = stringRegex.exec(usjJson)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${partIndex++}`}>{usjJson.slice(lastIndex, match.index)}</span>);
      }

      const stringValue = match[1];
      // Check if this is a property name (followed by colon) or a value
      const afterMatch = usjJson.slice(match.index + stringValue.length).trimStart();
      const isPropertyName = afterMatch.startsWith(":");

      if (isPropertyName) {
        // Property names stay LTR
        parts.push(<span key={`prop-${partIndex++}`}>{stringValue}</span>);
      } else {
        // String values get RTL direction (but keep quotes LTR)
        const innerContent = stringValue.slice(1, -1); // Remove quotes
        parts.push(
          <span key={`val-${partIndex++}`}>
            "<span dir="rtl" style={{ unicodeBidi: "embed" }}>{innerContent}</span>"
          </span>
        );
      }
      lastIndex = match.index + stringValue.length;
    }

    // Add remaining text
    if (lastIndex < usjJson.length) {
      parts.push(<span key={`end-${partIndex}`}>{usjJson.slice(lastIndex)}</span>);
    }

    return <>{parts}</>;
  }, [usjJson, isRtl]);

  return (
    <div className="tw-p-4 tw-min-h-screen tw-bg-background tw-text-foreground" dir={isUiRtl ? "rtl" : "ltr"}>
      <div className="tw-max-w-4xl tw-mx-auto">
        <h1 className="tw-text-xl tw-font-bold tw-mb-4 tw-text-foreground">
          {localizedStrings["%flexExport_title%"]}
        </h1>

        {/* Settings Row - Project/Chapter on left, Include Options on right */}
        <div className="tw-flex tw-flex-col sm:tw-flex-row sm:tw-items-start tw-gap-6 tw-mb-6">
          {/* Left Column: Project and Chapter Selection */}
          <div>
            {/* Project Selection */}
            <div className="tw-mb-4 tw-flex tw-items-center tw-gap-3">
              <Label className="tw-text-sm tw-text-foreground">{localizedStrings["%flexExport_paratextProject%"]}</Label>
              <ComboBox<ProjectOption>
                options={projectOptions || []}
                value={selectedProject}
                onChange={handleProjectChange}
                getOptionLabel={(option: ProjectOption) => option.label}
                buttonPlaceholder={localizedStrings["%flexExport_selectProject%"]}
                textPlaceholder={localizedStrings["%flexExport_searchProjects%"]}
                commandEmptyMessage={localizedStrings["%flexExport_noProjectsFound%"]}
                buttonVariant="outline"
              />
            </div>

            {/* Scripture Reference Selector */}
            <div>
              <Label className="tw-text-sm tw-font-medium tw-mb-2 tw-block tw-text-foreground">
                {localizedStrings["%flexExport_selectBookChapter%"]}
              </Label>
              <div className="tw-flex tw-items-center tw-gap-3 tw-flex-wrap">
                <BookChapterControl
                  scrRef={scrRef}
                  handleSubmit={handleStartRefChange}
                />
                <Label className="tw-text-sm tw-text-foreground">{localizedStrings["%flexExport_toChapter%"]} </Label>
                <ComboBox<number>
                  options={endChapterOptions}
                  value={endChapter}
                  onChange={(val: number | undefined) => val && setEndChapter(val)}
                  getOptionLabel={(opt: number) => opt.toString()}
                  buttonPlaceholder={localizedStrings["%flexExport_endChapter%"]}
                  buttonClassName="tw-w-24"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Content Options */}
          <div className="tw-shrink-0 tw-border tw-border-border tw-rounded-md tw-bg-card">
            <div className="tw-p-2.5 tw-border-b tw-border-border tw-bg-muted">
              <Label className="tw-text-sm tw-font-medium tw-text-foreground">
                {localizedStrings["%flexExport_includeInExport%"]}
              </Label>
            </div>
            <div className="tw-px-4 tw-py-3 tw-flex tw-flex-col tw-gap-1">
              <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  checked={includeFootnotes}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeFootnotes(checked === true)}
                />
                <span className="tw-text-sm tw-text-foreground">{localizedStrings["%flexExport_footnotes%"]}</span>
              </label>
              <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  checked={includeCrossRefs}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeCrossRefs(checked === true)}
                />
                <span className="tw-text-sm tw-text-foreground">{localizedStrings["%flexExport_crossReferences%"]}</span>
              </label>
              <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  checked={includeIntro}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeIntro(checked === true)}
                  disabled={scrRef.chapterNum !== 1}
                />
                <span className={`tw-text-sm ${scrRef.chapterNum !== 1 ? "tw-text-muted-foreground" : "tw-text-foreground"}`}>
                  {localizedStrings["%flexExport_introduction%"]}
                </span>
              </label>
              <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  checked={includeRemarks}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeRemarks(checked === true)}
                />
                <span className="tw-text-sm tw-text-foreground">{localizedStrings["%flexExport_remarks%"]}</span>
              </label>
              <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  checked={includeFigures}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeFigures(checked === true)}
                />
                <span className="tw-text-sm tw-text-foreground">{localizedStrings["%flexExport_figures%"]}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Preview Toggle */}
        <div className="tw-mb-2 tw-flex tw-gap-2">
          <Button
            variant={viewMode === "formatted" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("formatted")}
          >
            {localizedStrings["%flexExport_formatted%"]}
          </Button>
          <Button
            variant={viewMode === "usfm" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("usfm")}
          >
            {localizedStrings["%flexExport_usfm%"]}
          </Button>
          <Button
            variant={viewMode === "usj" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("usj")}
          >
            {localizedStrings["%flexExport_usjData%"]}
          </Button>
        </div>

        {/* Scripture Preview */}
        <div className="tw-border tw-border-border tw-rounded-md tw-bg-card">
          <div className="tw-p-3 tw-border-b tw-border-border tw-bg-muted">
            <Label className="tw-text-sm tw-font-medium tw-text-foreground">
              {viewMode === "formatted" && localizedStrings["%flexExport_scripturePreview%"]}
              {viewMode === "usfm" && localizedStrings["%flexExport_usfmPreview%"]}
              {viewMode === "usj" && localizedStrings["%flexExport_usjJsonData%"]}
            </Label>
          </div>
          <div className="tw-p-4 tw-min-h-64 tw-max-h-96 tw-overflow-auto">
            {viewMode === "formatted" && (
              <div
                className="tw-leading-relaxed tw-text-foreground"
                dir={isRtl ? "rtl" : "ltr"}
                style={{
                  fontFamily: fontFamily || undefined,
                  fontSize: fontSize || undefined,
                }}
              >
                {formattedPreview}
              </div>
            )}
            {viewMode === "usfm" && (
              <pre
                className="tw-text-foreground"
                dir={isRtl ? "rtl" : "ltr"}
                style={{
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                  textAlign: isRtl ? "right" : "left",
                  fontFamily: fontFamily || "monospace",
                  fontSize: fontSize || undefined,
                }}
              >
                {usfmText}
              </pre>
            )}
            {viewMode === "usj" && (
              <pre className="tw-text-xs tw-font-mono tw-whitespace-pre-wrap tw-text-foreground">
                {renderUsjWithDirection || localizedStrings["%flexExport_noUsjData%"]}
              </pre>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="tw-mt-4 tw-text-xs tw-text-muted-foreground">
          {isLoading && localizedStrings["%flexExport_loadingScripture%"]}
          {!isLoading && chaptersUSJ.length > 0 && (
            <span>
              {scrRef.chapterNum === endChapter
                ? localizedStrings["%flexExport_loadedChapter%"]
                    ?.replace("{book}", scrRef.book)
                    ?.replace("{chapter}", String(scrRef.chapterNum))
                : localizedStrings["%flexExport_loadedChapters%"]
                    ?.replace("{book}", scrRef.book)
                    ?.replace("{startChapter}", String(scrRef.chapterNum))
                    ?.replace("{endChapter}", String(endChapter))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
