import { WebViewProps } from "@papi/core";
import {
  useDialogCallback,
  useProjectData,
  useProjectSetting,
} from "@papi/frontend/react";
import { useState, useMemo, useCallback } from "react";
import { BookChapterControl, Button, Label } from "platform-bible-react";
import { isPlatformError } from "platform-bible-utils";

globalThis.webViewComponent = function ExportToFlexWebView({
  projectId,
  updateWebViewDefinition,
}: WebViewProps) {
  // Scripture reference state with setter for BookChapterControl
  const [scrRef, setScrRef] = useState({ book: "GEN", chapterNum: 1, verseNum: 1 });

  // Project selection dialog
  const selectProject = useDialogCallback(
    "platform.selectProject",
    useMemo(
      () => ({
        title: "Select Paratext Project",
        prompt: "Choose a project to export to FLEx:",
        includeProjectInterfaces: ["platformScripture.USJ_Chapter"],
      }),
      []
    ),
    useCallback(
      (selectedProjectId: string | undefined) => {
        if (selectedProjectId) {
          updateWebViewDefinition({ projectId: selectedProjectId });
        }
      },
      [updateWebViewDefinition]
    )
  );

  // Get USJ data for the current chapter
  const [chapterUSJ, , isLoading] = useProjectData(
    "platformScripture.USJ_Chapter",
    projectId ?? undefined
  ).ChapterUSJ(scrRef, undefined);

  // Get project name for display
  const [projectName] = useProjectSetting(projectId ?? undefined, "platform.name", "");
  const displayProjectName = useMemo(() => {
    if (!projectId) return "No project selected";
    if (isPlatformError(projectName)) return projectId;
    return projectName || projectId;
  }, [projectId, projectName]);

  type ViewMode = "formatted" | "usfm" | "usj";
  const [viewMode, setViewMode] = useState<ViewMode>("formatted");

  // USJ node type interface
  interface UsjNode {
    type?: string;
    marker?: string;
    content?: (UsjNode | string)[];
    number?: string;
    code?: string;
    caller?: string;
  }

  // Convert USJ to USFM text
  const usfmText = useMemo(() => {
    if (isLoading) return "Loading...";
    if (!chapterUSJ) return "No scripture data available. Select a project.";
    if (isPlatformError(chapterUSJ)) return `Error: ${chapterUSJ.message}`;

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

    if (chapterUSJ.content) {
      return convertToUsfm(chapterUSJ.content as (UsjNode | string)[]);
    }
    return "No content in USJ";
  }, [chapterUSJ, isLoading]);

  // Convert USJ to formatted HTML-like preview
  const formattedPreview = useMemo(() => {
    if (isLoading) return <div>Loading...</div>;
    if (!chapterUSJ) return <div>No scripture data available. Select a project.</div>;
    if (isPlatformError(chapterUSJ)) return <div>Error: {chapterUSJ.message}</div>;

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

    if (chapterUSJ.content) {
      return <div>{renderContent(chapterUSJ.content as (UsjNode | string)[])}</div>;
    }
    return <div>No content in USJ</div>;
  }, [chapterUSJ, isLoading]);

  // Format USJ as JSON for debug view
  const usjJson = useMemo(() => {
    if (!chapterUSJ || isPlatformError(chapterUSJ)) return "";
    return JSON.stringify(chapterUSJ, null, 2);
  }, [chapterUSJ]);

  return (
    <div className="tw-p-4 tw-min-h-screen tw-bg-background tw-text-foreground">
      <div className="tw-max-w-3xl tw-mx-auto">
        <h1 className="tw-text-xl tw-font-bold tw-mb-4 tw-text-foreground">
          Export to FLEx
        </h1>

        {/* Project Selection */}
        <div className="tw-mb-4 tw-p-3 tw-border tw-border-border tw-rounded-md tw-flex tw-items-center tw-gap-3 tw-bg-muted">
          <Label className="tw-text-sm tw-text-foreground">
            Project: {displayProjectName}
          </Label>
          <Button variant="outline" size="sm" onClick={() => selectProject()}>
            Select Project
          </Button>
        </div>

        {/* Scripture Reference Selector */}
        <div className="tw-mb-4">
          <Label className="tw-text-sm tw-font-medium tw-mb-2 tw-block tw-text-foreground">
            Select Book and Chapter:
          </Label>
          <BookChapterControl
            scrRef={scrRef}
            handleSubmit={(newScrRef) => setScrRef(newScrRef)}
          />
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
          {!isLoading && chapterUSJ && !isPlatformError(chapterUSJ) && (
            <span>
              Loaded {scrRef.book} chapter {scrRef.chapterNum}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
