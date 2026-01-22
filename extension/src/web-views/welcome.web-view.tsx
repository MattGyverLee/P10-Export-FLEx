import { WebViewProps } from "@papi/core";
import papi from "@papi/frontend";
import { useProjectSetting } from "@papi/frontend/react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { BookChapterControl, Button, ComboBox, Label } from "platform-bible-react";
import { isPlatformError, getChaptersForBook } from "platform-bible-utils";
import { Canon } from "@sillsdev/scripture";

// Project option type for ComboBox
type ProjectOption = {
  label: string;
  id: string;
};

globalThis.webViewComponent = function ExportToFlexWebView({
  projectId,
  updateWebViewDefinition,
}: WebViewProps) {
  // Scripture reference state with setter for BookChapterControl
  const [scrRef, setScrRef] = useState({ book: "GEN", chapterNum: 1, verseNum: 1 });

  // End chapter for range selection (defaults to start chapter)
  const [endChapter, setEndChapter] = useState(1);

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

  // Convert USJ to USFM text
  const usfmText = useMemo(() => {
    if (isLoading) return "Loading...";
    if (!chaptersUSJ.length) return "No scripture data available. Select a project.";

    const convertToUsfm = (content: (UsjNode | string)[]): string => {
      return content
        .map((item) => {
          if (typeof item === "string") return item;
          const node = item as UsjNode;

          if (node.type === "book" && node.code) {
            const bookContent = node.content ? convertToUsfm(node.content) : "";
            return `\\id ${node.code} ${bookContent}\n`;
          }
          if (node.type === "chapter" && node.number) {
            return `\\c ${node.number}\n`;
          }
          if (node.type === "verse" && node.number) {
            return `\\v ${node.number} `;
          }
          if (node.type === "para" && node.marker) {
            const paraContent = node.content ? convertToUsfm(node.content) : "";
            return `\\${node.marker} ${paraContent}\n`;
          }
          if (node.type === "char" && node.marker) {
            const charContent = node.content ? convertToUsfm(node.content) : "";
            return `\\${node.marker} ${charContent}\\${node.marker}*`;
          }
          if (node.type === "note" && node.marker) {
            const noteContent = node.content ? convertToUsfm(node.content) : "";
            return `\\${node.marker} ${node.caller || "+"} ${noteContent}\\${node.marker}*`;
          }
          if (node.content) {
            return convertToUsfm(node.content);
          }
          return "";
        })
        .join("");
    };

    // Combine all chapters' USFM
    return chaptersUSJ
      .map((chapter) => {
        if (chapter.content) {
          return convertToUsfm(chapter.content as (UsjNode | string)[]);
        }
        return "";
      })
      .join("\n");
  }, [chaptersUSJ, isLoading]);

  // Convert USJ to formatted HTML-like preview
  const formattedPreview = useMemo(() => {
    if (isLoading) return <div>Loading...</div>;
    if (!chaptersUSJ.length) return <div>No scripture data available. Select a project.</div>;

    const renderContent = (content: (UsjNode | string)[], key = ""): React.ReactNode[] => {
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
          const isHeader = node.marker.startsWith("s") || node.marker === "ms";
          const isPoetry = node.marker.startsWith("q");
          const isBlank = node.marker === "b";

          if (isBlank) {
            return <div key={itemKey} className="tw-h-3" />;
          }
          if (isHeader) {
            return (
              <div key={itemKey} className="tw-font-semibold tw-mt-4 tw-mb-2 tw-text-foreground">
                {node.content && renderContent(node.content, itemKey)}
              </div>
            );
          }
          if (isPoetry) {
            const indent = parseInt(node.marker.slice(1) || "1", 10);
            return (
              <div key={itemKey} className="tw-mb-1" style={{ marginLeft: `${indent * 1.5}rem` }}>
                {node.content && renderContent(node.content, itemKey)}
              </div>
            );
          }
          return (
            <p key={itemKey} className="tw-mb-2">
              {node.content && renderContent(node.content, itemKey)}
            </p>
          );
        }
        if (node.type === "char" && node.marker) {
          const isBold = node.marker === "bd" || node.marker === "bdit";
          const isItalic = node.marker === "it" || node.marker === "bdit";
          const isWordsOfJesus = node.marker === "wj";
          let className = "";
          if (isBold) className += "tw-font-bold ";
          if (isItalic) className += "tw-italic ";
          if (isWordsOfJesus) className += "tw-text-red-600 ";
          return (
            <span key={itemKey} className={className}>
              {node.content && renderContent(node.content, itemKey)}
            </span>
          );
        }
        if (node.type === "note") {
          return (
            <sup key={itemKey} className="tw-text-xs tw-text-muted-foreground tw-cursor-help" title="Footnote">
              [{node.caller || "*"}]
            </sup>
          );
        }
        if (node.content) {
          return <span key={itemKey}>{renderContent(node.content, itemKey)}</span>;
        }
        return null;
      });
    };

    // Render all chapters
    return (
      <div>
        {chaptersUSJ.map((chapter, chapterIdx) => (
          <div key={`chapter-${chapterIdx}`}>
            {chapter.content && renderContent(chapter.content as (UsjNode | string)[], `ch-${chapterIdx}`)}
          </div>
        ))}
      </div>
    );
  }, [chaptersUSJ, isLoading]);

  // Format USJ as JSON for debug view
  const usjJson = useMemo(() => {
    if (!chaptersUSJ.length) return "";
    return JSON.stringify(chaptersUSJ, null, 2);
  }, [chaptersUSJ]);

  return (
    <div className="tw-p-4 tw-min-h-screen tw-bg-background tw-text-foreground">
      <div className="tw-max-w-3xl tw-mx-auto">
        <h1 className="tw-text-xl tw-font-bold tw-mb-4 tw-text-foreground">
          Export to FLEx
        </h1>

        {/* Project Selection */}
        <div className="tw-mb-4 tw-flex tw-items-center tw-gap-3">
          <Label className="tw-text-sm tw-text-foreground">Project:</Label>
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
        <div className="tw-mb-4">
          <Label className="tw-text-sm tw-font-medium tw-mb-2 tw-block tw-text-foreground">
            Select Book and Chapter Range:
          </Label>
          <div className="tw-flex tw-items-center tw-gap-3 tw-flex-wrap">
            <BookChapterControl
              scrRef={scrRef}
              handleSubmit={handleStartRefChange}
            />
            <Label className="tw-text-sm tw-text-foreground">to</Label>
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
