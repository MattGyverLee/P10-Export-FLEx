import { WebViewProps } from "@papi/core";
import papi from "@papi/frontend";
import { useProjectSetting } from "@papi/frontend/react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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

globalThis.webViewComponent = function ExportToFlexWebView({
  projectId,
  updateWebViewDefinition,
  useWebViewState,
}: WebViewProps) {
  // Get initial scripture reference from WebView state (set when opened from a project)
  const [initialScrRef] = useWebViewState<SerializedVerseRef | undefined>('initialScrRef', undefined);

  // Track if we've applied the initial state
  const initializedRef = useRef(false);

  // Scripture reference state with setter for BookChapterControl
  const [scrRef, setScrRef] = useState<SerializedVerseRef>(initialScrRef || DEFAULT_SCR_REF);

  // End chapter for range selection (defaults to start chapter)
  const [endChapter, setEndChapter] = useState(initialScrRef?.chapterNum || 1);

  // Apply initial scripture reference once when it becomes available
  useEffect(() => {
    if (initialScrRef && !initializedRef.current) {
      initializedRef.current = true;
      setScrRef(initialScrRef);
      setEndChapter(initialScrRef.chapterNum);
    }
  }, [initialScrRef]);

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
              // Check if project is editable (resources are not editable)
              // Note: platform.isEditable is project-level, not user-permission-level
              const isEditable = await pdp.getSetting("platform.isEditable");
              if (!isEditable) return; // Skip resources

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
  const displayProjectName = useMemo(() => {
    if (!projectId) return "No project selected";
    if (selectedProject) return selectedProject.label;
    if (isPlatformError(projectNameSetting)) return projectId;
    return projectNameSetting || projectId;
  }, [projectId, selectedProject, projectNameSetting]);

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
    if (isLoading) return "Loading...";
    if (!chaptersUSJ.length) return "No scripture data available. Select a project.";

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
  }, [chaptersUSJ, isLoading, includeFootnotes, includeCrossRefs, includeIntro, includeRemarks, includeFigures, scrRef.chapterNum]);

  // Convert USJ to formatted HTML-like preview
  const formattedPreview = useMemo(() => {
    if (isLoading) return <div>Loading...</div>;
    if (!chaptersUSJ.length) return <div>No scripture data available. Select a project.</div>;

    const renderContent = (content: (UsjNode | string)[], key = "", isFirstChapter = false): React.ReactNode[] => {
      return content.map((item, idx) => {
        const itemKey = `${key}-${idx}`;
        if (typeof item === "string") return <span key={itemKey}>{item}</span>;

        const node = item as UsjNode;

        if (node.type === "chapter" && node.number) {
          return (
            <div key={itemKey} className="tw-text-lg tw-font-bold tw-mb-3 tw-text-foreground">
              Chapter {node.number}
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
                [Remark: {node.content && renderContent(node.content, itemKey, isFirstChapter)}]
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
                [Figure: {node.content && renderContent(node.content, itemKey, isFirstChapter)}]
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
            <sup key={itemKey} className="tw-text-xs tw-text-muted-foreground tw-cursor-help" title="Footnote">
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
  }, [chaptersUSJ, isLoading, includeFootnotes, includeCrossRefs, includeIntro, includeRemarks, includeFigures, scrRef.chapterNum]);

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

  return (
    <div className="tw-p-4 tw-min-h-screen tw-bg-background tw-text-foreground">
      <div className="tw-max-w-4xl tw-mx-auto">
        <h1 className="tw-text-xl tw-font-bold tw-mb-4 tw-text-foreground">
          Export to FLEx
        </h1>

        {/* Settings Row - Project/Chapter on left, Include Options on right */}
        <div className="tw-flex tw-flex-col sm:tw-flex-row sm:tw-items-start tw-gap-6 tw-mb-4">
          {/* Left Column: Project and Chapter Selection */}
          <div>
            {/* Project Selection */}
            <div className="tw-mb-4 tw-flex tw-items-center tw-gap-3">
              <Label className="tw-text-sm tw-text-foreground">Paratext Project:</Label>
              <ComboBox<ProjectOption>
                options={projectOptions || []}
                value={selectedProject}
                onChange={handleProjectChange}
                getOptionLabel={(option: ProjectOption) => option.label}
                buttonPlaceholder="Select a project"
                textPlaceholder="Search projects..."
                commandEmptyMessage="No projects found"
                buttonVariant="outline"
              />
            </div>

            {/* Scripture Reference Selector */}
            <div>
              <Label className="tw-text-sm tw-font-medium tw-mb-2 tw-block tw-text-foreground">
                Select Book and Chapter Range:
              </Label>
              <div className="tw-flex tw-items-center tw-gap-3 tw-flex-wrap">
                <BookChapterControl
                  scrRef={scrRef}
                  handleSubmit={handleStartRefChange}
                />
                <Label className="tw-text-sm tw-text-foreground">to chapter </Label>
                <ComboBox<number>
                  options={endChapterOptions}
                  value={endChapter}
                  onChange={(val: number | undefined) => val && setEndChapter(val)}
                  getOptionLabel={(opt: number) => opt.toString()}
                  buttonPlaceholder="End"
                  buttonClassName="tw-w-24"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Content Options */}
          <div className="tw-shrink-0 tw-border tw-border-border tw-rounded-md tw-bg-card">
            <div className="tw-p-2.5 tw-border-b tw-border-border tw-bg-muted">
              <Label className="tw-text-sm tw-font-medium tw-text-foreground">
                Include in Export:
              </Label>
            </div>
            <div className="tw-p-2.5 tw-flex tw-flex-col tw-gap-2">
              <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  checked={includeFootnotes}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeFootnotes(checked === true)}
                />
                <span className="tw-text-sm tw-text-foreground">Footnotes</span>
              </label>
              <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  checked={includeCrossRefs}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeCrossRefs(checked === true)}
                />
                <span className="tw-text-sm tw-text-foreground">Cross References (\x and \r)</span>
              </label>
              <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  checked={includeIntro}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeIntro(checked === true)}
                  disabled={scrRef.chapterNum !== 1}
                />
                <span className={`tw-text-sm ${scrRef.chapterNum !== 1 ? "tw-text-muted-foreground" : "tw-text-foreground"}`}>
                  Introduction (for chapter 1)
                </span>
              </label>
              <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  checked={includeRemarks}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeRemarks(checked === true)}
                />
                <span className="tw-text-sm tw-text-foreground">Remarks (\rem)</span>
              </label>
              <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  checked={includeFigures}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeFigures(checked === true)}
                />
                <span className="tw-text-sm tw-text-foreground">Figures/Images (\fig)</span>
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
            Formatted
          </Button>
          <Button
            variant={viewMode === "usfm" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("usfm")}
          >
            USFM
          </Button>
          <Button
            variant={viewMode === "usj" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("usj")}
          >
            USJ Data
          </Button>
        </div>

        {/* Scripture Preview */}
        <div className="tw-border tw-border-border tw-rounded-md tw-bg-card">
          <div className="tw-p-3 tw-border-b tw-border-border tw-bg-muted">
            <Label className="tw-text-sm tw-font-medium tw-text-foreground">
              {viewMode === "formatted" && "Scripture Preview"}
              {viewMode === "usfm" && "USFM Preview"}
              {viewMode === "usj" && "USJ JSON Data"}
            </Label>
          </div>
          <div className="tw-p-4 tw-min-h-64 tw-max-h-96 tw-overflow-auto">
            {viewMode === "formatted" && (
              <div className="tw-text-sm tw-leading-relaxed tw-text-foreground">
                {formattedPreview}
              </div>
            )}
            {viewMode === "usfm" && (
              <pre
                className="tw-text-sm tw-font-mono tw-text-foreground"
                style={{
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                }}
              >
                {usfmText}
              </pre>
            )}
            {viewMode === "usj" && (
              <pre className="tw-text-xs tw-font-mono tw-whitespace-pre-wrap tw-text-foreground">
                {usjJson || "No USJ data"}
              </pre>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="tw-mt-4 tw-text-xs tw-text-muted-foreground">
          {isLoading && "Loading scripture data..."}
          {!isLoading && chaptersUSJ.length > 0 && (
            <span>
              Loaded {scrRef.book} {scrRef.chapterNum === endChapter
                ? `chapter ${scrRef.chapterNum}`
                : `chapters ${scrRef.chapterNum}-${endChapter}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
