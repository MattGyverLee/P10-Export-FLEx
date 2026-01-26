import { WebViewProps } from "@papi/core";
import papi from "@papi/frontend";
import { useLocalizedStrings, useProjectSetting, useSetting } from "@papi/frontend/react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { BookChapterControl, Button, Checkbox, ComboBox, Input, Label, Switch } from "platform-bible-react";
import { isPlatformError, getChaptersForBook } from "platform-bible-utils";
import { Canon, SerializedVerseRef } from "@sillsdev/scripture";

// Simple Modal Dialog Component (Dialog not yet exported from platform-bible-react)
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;

  return (
    <div
      className="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-center tw-justify-center tw-bg-black/50"
      onClick={onClose}
    >
      <div
        className="tw-relative tw-w-full tw-max-w-lg tw-bg-background tw-border tw-border-border tw-rounded-lg tw-shadow-xl tw-p-6 tw-animate-in tw-fade-in-0 tw-zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ children }: { children: React.ReactNode }) {
  return <div className="tw-mb-4">{children}</div>;
}

function ModalTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="tw-text-lg tw-font-semibold tw-leading-none tw-tracking-tight">{children}</h2>;
}

function ModalDescription({ children }: { children: React.ReactNode }) {
  return <p className="tw-text-sm tw-text-muted-foreground tw-mt-2">{children}</p>;
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="tw-flex tw-flex-col-reverse sm:tw-flex-row sm:tw-justify-end sm:tw-space-x-2 tw-mt-6 tw-gap-2">
      {children}
    </div>
  );
}

// FLEx project types (matching bridge service)
interface FlexProjectInfo {
  name: string;
  path: string;
  vernacularWs: string;
  analysisWs: string;
}

interface WritingSystemInfo {
  code: string;
  name: string;
  isDefault: boolean;
}

interface FlexProjectDetails extends FlexProjectInfo {
  vernacularWritingSystems: WritingSystemInfo[];
  analysisWritingSystems: WritingSystemInfo[];
}

// FLEx project option for ComboBox
type FlexProjectOption = {
  label: string;
  name: string;
};

// Writing system option for ComboBox
type WritingSystemOption = {
  label: string;
  code: string;
  isDefault: boolean;
};

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

// English fallback strings for instant rendering (localization hydrates in background)
const ENGLISH_FALLBACKS: Record<string, string> = {
  "%flexExport_title%": "Export to FLEx",
  "%flexExport_paratextSettings%": "Paratext Settings",
  "%flexExport_flexSettings%": "FLEx Settings",
  "%flexExport_project%": "Project",
  "%flexExport_paratextProject%": "Paratext Project",
  "%flexExport_selectProject%": "Select project",
  "%flexExport_searchProjects%": "Search projects...",
  "%flexExport_noProjectsFound%": "No projects found",
  "%flexExport_noProjectSelected%": "No project selected",
  "%flexExport_selectBookChapter%": "Select Book & Chapter",
  "%flexExport_toChapter%": "to",
  "%flexExport_endChapter%": "End chapter",
  "%flexExport_includeInExport%": "Include in Export",
  "%flexExport_footnotes%": "Footnotes",
  "%flexExport_crossReferences%": "Cross References",
  "%flexExport_introduction%": "Introduction",
  "%flexExport_remarks%": "Remarks",
  "%flexExport_figures%": "Figures",
  "%flexExport_formatted%": "Formatted",
  "%flexExport_usfm%": "USFM",
  "%flexExport_usjData%": "USJ Data",
  "%flexExport_scripturePreview%": "Scripture Preview",
  "%flexExport_usfmPreview%": "USFM Preview",
  "%flexExport_usjJsonData%": "USJ JSON Data",
  "%flexExport_loading%": "Loading...",
  "%flexExport_noScriptureData%": "No scripture data available",
  "%flexExport_noUsjData%": "No USJ data available",
  "%flexExport_loadingScripture%": "Loading scripture...",
  "%flexExport_chapter%": "Chapter",
  "%flexExport_remark%": "Remark",
  "%flexExport_figure%": "Figure",
  "%flexExport_footnote%": "Footnote",
  "%flexExport_flexProject%": "FLEx Project",
  "%flexExport_selectFlexProject%": "Select FLEx project",
  "%flexExport_searchFlexProjects%": "Search FLEx projects...",
  "%flexExport_noFlexProjectsFound%": "No FLEx projects found",
  "%flexExport_loadingFlexProjects%": "Loading FLEx projects...",
  "%flexExport_writingSystem%": "Writing System",
  "%flexExport_defaultWritingSystem%": "(default)",
  "%flexExport_textName%": "Text Name",
  "%flexExport_textNamePlaceholder%": "Enter text name",
  "%flexExport_overwrite%": "Overwrite existing text",
  "%flexExport_overwriteConfirmTitle%": "Confirm Overwrite",
  "%flexExport_overwriteConfirmMessage%": "Are you sure you want to overwrite the existing text \"{textName}\"?",
  "%flexExport_overwriteConfirmYes%": "Yes, Overwrite",
  "%flexExport_overwriteConfirmNo%": "Cancel",
  "%flexExport_export%": "Export",
  "%flexExport_exporting%": "Exporting...",
  "%flexExport_exportSuccess%": "Successfully exported {paragraphCount} paragraphs to \"{textName}\"",
  "%flexExport_exportFailed%": "Export failed: {error}",
  "%flexExport_windowsOnly%": "This feature is only available on Windows",
  "%flexExport_noFlexProjectSelected%": "No FLEx project selected",
  "%flexExport_flexNotFound%": "FLEx is not installed or no projects were found. Please install FLEx and create at least one project.",
  "%flexExport_flexLoadError%": "Failed to load FLEx projects: {error}",
  "%flexExport_flexNotAvailable%": "FLEx not available",
  "%flexExport_renameConfirmMessage%": "A text named \"{textName}\" already exists. Create as \"{suggestedName}\" instead?",
  "%flexExport_renameConfirmYes%": "Use \"{suggestedName}\"",
  "%flexExport_renameConfirmNo%": "Cancel",
};

// Localization string keys
const LOCALIZED_STRING_KEYS = Object.keys(ENGLISH_FALLBACKS);

globalThis.webViewComponent = function ExportToFlexWebView({
  projectId,
  updateWebViewDefinition,
  useWebViewState,
  state,
}: WebViewProps) {
  // Get preloaded strings from state (if available) - these were fetched server-side
  const preloadedStrings = (state?.preloadedStrings as Record<string, string> | undefined) || {};

  // Localized strings - useMemo ensures stable reference to prevent re-subscriptions
  const [rawLocalizedStrings] = useLocalizedStrings(useMemo(() => LOCALIZED_STRING_KEYS, []));

  // Merge fallbacks: English → Preloaded (French/etc) → Async loaded
  // This gives instant rendering with the user's language, no flash of % placeholders
  const localizedStrings = useMemo(() => {
    return { ...ENGLISH_FALLBACKS, ...preloadedStrings, ...rawLocalizedStrings };
  }, [preloadedStrings, rawLocalizedStrings]);

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

  // Per-project settings storage - keyed by Paratext project ID
  // This stores a map of project IDs to their export settings
  interface ProjectExportSettings {
    flexProjectName: string;
    writingSystemCode: string;
    includeFootnotes: boolean;
    includeCrossRefs: boolean;
    includeIntro: boolean;
    includeRemarks: boolean;
    includeFigures: boolean;
  }

  const defaultSettings: ProjectExportSettings = {
    flexProjectName: "",
    writingSystemCode: "",
    includeFootnotes: false,
    includeCrossRefs: false,
    includeIntro: false,
    includeRemarks: false,
    includeFigures: true,
  };

  // Store all project settings in a single WebView state map
  const [allProjectSettings, setAllProjectSettings] = useWebViewState<Record<string, ProjectExportSettings>>(
    "projectSettings",
    {}
  );

  // Get settings for the current project (or defaults if none saved)
  const currentSettings = useMemo(() => {
    if (!projectId) return defaultSettings;
    return allProjectSettings[projectId] || defaultSettings;
  }, [projectId, allProjectSettings]);

  // Helper to update a single setting for the current project
  const updateSetting = useCallback(<K extends keyof ProjectExportSettings>(
    key: K,
    value: ProjectExportSettings[K]
  ) => {
    if (!projectId) return;
    setAllProjectSettings((prev: Record<string, ProjectExportSettings>) => ({
      ...prev,
      [projectId]: {
        ...(prev[projectId] || defaultSettings),
        [key]: value,
      },
    }));
  }, [projectId, setAllProjectSettings]);

  // Convenience accessors for individual settings
  const savedFlexProjectName = currentSettings.flexProjectName;
  const setSavedFlexProjectName = useCallback((v: string) => updateSetting("flexProjectName", v), [updateSetting]);

  const savedWritingSystemCode = currentSettings.writingSystemCode;
  const setSavedWritingSystemCode = useCallback((v: string) => updateSetting("writingSystemCode", v), [updateSetting]);

  const includeFootnotes = currentSettings.includeFootnotes;
  const setIncludeFootnotes = useCallback((v: boolean) => updateSetting("includeFootnotes", v), [updateSetting]);

  const includeCrossRefs = currentSettings.includeCrossRefs;
  const setIncludeCrossRefs = useCallback((v: boolean) => updateSetting("includeCrossRefs", v), [updateSetting]);

  const includeIntro = currentSettings.includeIntro;
  const setIncludeIntro = useCallback((v: boolean) => updateSetting("includeIntro", v), [updateSetting]);

  const includeRemarks = currentSettings.includeRemarks;
  const setIncludeRemarks = useCallback((v: boolean) => updateSetting("includeRemarks", v), [updateSetting]);

  const includeFigures = currentSettings.includeFigures;
  const setIncludeFigures = useCallback((v: boolean) => updateSetting("includeFigures", v), [updateSetting]);

  // Overwrite setting - independent of project selection (stored in global WebView state)
  const [overwriteEnabled, setOverwriteEnabled] = useWebViewState<boolean>("overwriteEnabled", false);

  // FLEx project state
  const [flexProjects, setFlexProjects] = useState<FlexProjectOption[]>([]);
  const [selectedFlexProject, setSelectedFlexProject] = useState<FlexProjectOption | undefined>();
  const [flexProjectDetails, setFlexProjectDetails] = useState<FlexProjectDetails | undefined>();
  const [isLoadingFlexProjects, setIsLoadingFlexProjects] = useState(false);
  const [flexLoadError, setFlexLoadError] = useState<string | undefined>();

  // Writing system state
  const [selectedWritingSystem, setSelectedWritingSystem] = useState<WritingSystemOption | undefined>();

  // Text name and overwrite confirmation state
  const [textName, setTextName] = useState("");
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [showRenameConfirm, setShowRenameConfirm] = useState(false);
  const [suggestedName, setSuggestedName] = useState("");
  const [expectedExportName, setExpectedExportName] = useState<string | undefined>();
  const [isCheckingName, setIsCheckingName] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ success: boolean; message: string } | undefined>();

  // Last exported text info for "Open in FLEx" button
  const [lastExportedText, setLastExportedText] = useState<{ projectName: string; textGuid: string } | undefined>();

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

  // Available books in the selected project (from platformScripture.booksPresent)
  const [availableBookIds, setAvailableBookIds] = useState<string[]>([]);

  // Secret mode: include resources when Ctrl+click on project selector
  const [includeResources, setIncludeResources] = useState(false);

  // Get the saved FLEx project name (handle potential error)
  const savedFlexProject = isPlatformError(savedFlexProjectName) ? "" : savedFlexProjectName;

  // Load FLEx projects on mount
  useEffect(() => {
    let cancelled = false;

    const fetchFlexProjects = async () => {
      setIsLoadingFlexProjects(true);
      setFlexLoadError(undefined);
      try {
        const projects = await papi.commands.sendCommand(
          "flexExport.listFlexProjects"
        ) as FlexProjectInfo[];

        if (!cancelled) {
          if (projects && projects.length > 0) {
            const options: FlexProjectOption[] = projects.map((p) => ({
              label: p.name,
              name: p.name,
            }));
            setFlexProjects(options);

            // Restore saved FLEx project selection if available
            if (savedFlexProject) {
              const savedOption = options.find((p) => p.name === savedFlexProject);
              if (savedOption) {
                setSelectedFlexProject(savedOption);
              }
            }
          } else {
            // No projects found - FLEx may not be installed or no projects exist
            setFlexProjects([]);
            setFlexLoadError("no_projects");
          }
        }
      } catch (err) {
        console.error("Failed to fetch FLEx projects:", err);
        if (!cancelled) {
          setFlexProjects([]);
          setFlexLoadError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFlexProjects(false);
        }
      }
    };

    fetchFlexProjects();

    return () => {
      cancelled = true;
    };
  }, [savedFlexProject]);

  // Get the saved writing system code (handle potential error)
  const savedWsCode = isPlatformError(savedWritingSystemCode) ? "" : savedWritingSystemCode;

  // Load FLEx project details when a project is selected
  useEffect(() => {
    let cancelled = false;

    const fetchProjectDetails = async () => {
      if (!selectedFlexProject) {
        setFlexProjectDetails(undefined);
        setSelectedWritingSystem(undefined);
        return;
      }

      try {
        const details = await papi.commands.sendCommand(
          "flexExport.getFlexProjectInfo",
          selectedFlexProject.name
        ) as FlexProjectDetails | undefined;

        if (!cancelled && details) {
          setFlexProjectDetails(details);

          // Try to restore saved writing system, fall back to default
          let wsToSelect: WritingSystemInfo | undefined;

          if (savedWsCode && details.vernacularWritingSystems) {
            wsToSelect = details.vernacularWritingSystems.find((ws) => ws.code === savedWsCode);
          }

          // If no saved WS or saved WS not found, use default
          if (!wsToSelect) {
            wsToSelect = details.vernacularWritingSystems?.find((ws) => ws.isDefault)
              || details.vernacularWritingSystems?.[0];
          }

          if (wsToSelect) {
            setSelectedWritingSystem({
              label: `${wsToSelect.name} (${wsToSelect.code})`,
              code: wsToSelect.code,
              isDefault: wsToSelect.isDefault,
            });
          } else {
            setSelectedWritingSystem(undefined);
          }
        }
      } catch (err) {
        console.error("Failed to fetch FLEx project details:", err);
      }
    };

    fetchProjectDetails();

    return () => {
      cancelled = true;
    };
  }, [selectedFlexProject, savedWsCode]);

  // Auto-generate text name from book and chapter range
  useEffect(() => {
    if (!scrRef.book) return;

    const bookName = Canon.bookIdToEnglishName(scrRef.book);
    let generatedName: string;

    if (scrRef.chapterNum === endChapter) {
      generatedName = `${bookName} ${scrRef.chapterNum}`;
    } else {
      generatedName = `${bookName} ${scrRef.chapterNum}-${endChapter}`;
    }

    setTextName(generatedName);
  }, [scrRef.book, scrRef.chapterNum, endChapter]);

  // Check text name in real-time to show expected export name
  useEffect(() => {
    // Don't check if no FLEx project selected or no text name or overwrite is enabled
    if (!selectedFlexProject || !textName || overwriteEnabled) {
      setExpectedExportName(undefined);
      return;
    }

    let cancelled = false;
    setIsCheckingName(true);

    // Debounce: wait 300ms after user stops typing
    const timeoutId = setTimeout(async () => {
      try {
        const result = await papi.commands.sendCommand(
          "flexExport.checkTextName",
          selectedFlexProject.name,
          textName
        ) as { exists: boolean; suggestedName?: string };

        if (!cancelled) {
          if (result.exists && result.suggestedName) {
            setExpectedExportName(result.suggestedName);
          } else {
            setExpectedExportName(undefined);
          }
        }
      } catch (err) {
        console.error("Failed to check text name:", err);
        if (!cancelled) {
          setExpectedExportName(undefined);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingName(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      setIsCheckingName(false);
    };
  }, [selectedFlexProject, textName, overwriteEnabled]);

  // Fetch available projects (only editable projects unless secret mode enabled)
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
              // Secret mode: Ctrl+click on project selector includes resources
              if (!includeResources) {
                const isEditable = await pdp.getSetting("platform.isEditable");
                if (!isEditable) return; // Skip resources unless secret mode
              }

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
  }, [includeResources]);

  // Fetch available books when project changes
  useEffect(() => {
    let cancelled = false;

    const fetchAvailableBooks = async () => {
      if (!projectId) {
        setAvailableBookIds([]);
        return;
      }

      try {
        const pdp = await papi.projectDataProviders.get("platform.base", projectId);
        const booksPresent = await pdp.getSetting("platformScripture.booksPresent") as string;

        if (!cancelled && booksPresent) {
          // Convert binary string to array of book IDs
          const bookIds = Array.from(booksPresent).reduce((ids: string[], char, index) => {
            if (char === "1") {
              const bookId = Canon.bookNumberToId(index + 1);
              if (bookId) ids.push(bookId);
            }
            return ids;
          }, []);
          setAvailableBookIds(bookIds);
        } else if (!cancelled && !booksPresent) {
          // No books present data - clear the filter
          setAvailableBookIds([]);
        }
      } catch (err) {
        console.error("Failed to fetch available books:", err);
        if (!cancelled) {
          setAvailableBookIds([]);
        }
      }
    };

    fetchAvailableBooks();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Navigate to first available book if current book is not in the project
  useEffect(() => {
    if (availableBookIds.length > 0 && !availableBookIds.includes(scrRef.book)) {
      const firstBook = availableBookIds[0];
      setScrRef({ book: firstBook, chapterNum: 1, verseNum: 1 });
      setEndChapter(1);
    }
  }, [availableBookIds, scrRef.book]);

  // Callback to get active book IDs for BookChapterControl filtering
  const getActiveBookIds = useCallback(() => {
    return availableBookIds;
  }, [availableBookIds]);

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

  // Handle Ctrl+click on project selector to enable secret resource mode
  const handleProjectSelectorClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.ctrlKey && !includeResources) {
        event.preventDefault();
        setIncludeResources(true);
      }
    },
    [includeResources]
  );

  // Handle FLEx project selection
  const handleFlexProjectChange = useCallback(
    (option: FlexProjectOption | undefined) => {
      setSelectedFlexProject(option);
      setExportStatus(undefined);
      // Persist the selection to project settings
      setSavedFlexProjectName(option?.name || "");
    },
    [setSavedFlexProjectName]
  );

  // Handle writing system selection
  const handleWritingSystemChange = useCallback(
    (option: WritingSystemOption | undefined) => {
      setSelectedWritingSystem(option);
      // Persist the selection to project settings
      setSavedWritingSystemCode(option?.code || "");
    },
    [setSavedWritingSystemCode]
  );

  // Writing system options with default label (convert WritingSystemInfo to WritingSystemOption)
  const writingSystemOptions = useMemo((): WritingSystemOption[] => {
    if (!flexProjectDetails?.vernacularWritingSystems) return [];
    return flexProjectDetails.vernacularWritingSystems.map((ws) => {
      const defaultSuffix = ws.isDefault ? ` ${localizedStrings["%flexExport_defaultWritingSystem%"] || "(default)"}` : "";
      return {
        label: `${ws.name} (${ws.code})${defaultSuffix}`,
        code: ws.code,
        isDefault: ws.isDefault,
      };
    });
  }, [flexProjectDetails, localizedStrings]);

  // Get text direction setting for RTL support
  const [textDirectionSetting] = useProjectSetting(projectId ?? undefined, "platform.textDirection", "");
  const isRtl = textDirectionSetting === "rtl";

  // Note: Paratext 10 doesn't have font settings yet - using default fonts for preview

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

  // Generate a unique name by appending (2), (3), etc.
  const generateUniqueName = useCallback((baseName: string, attemptNumber: number = 2): string => {
    // Remove existing numbering if present
    const cleanName = baseName.replace(/\s*\(\d+\)$/, '');
    return `${cleanName} (${attemptNumber})`;
  }, []);

  // Handle export button click
  const handleExport = useCallback(async (overrideTextName?: string) => {
    const nameToUse = overrideTextName || textName;
    if (!selectedFlexProject || !nameToUse || !chaptersUSJ.length) return;

    // If overwrite is enabled, show confirmation dialog first
    if (overwriteEnabled && !showOverwriteConfirm) {
      setShowOverwriteConfirm(true);
      return;
    }

    setShowOverwriteConfirm(false);
    setShowRenameConfirm(false);
    setIsExporting(true);
    setExportStatus(undefined);
    setLastExportedText(undefined);

    try {
      // Check if FLEx is running and if project sharing is enabled
      const flexStatus = await papi.commands.sendCommand(
        "flexExport.checkFlexStatus",
        selectedFlexProject.name
      ) as { isRunning: boolean; sharingEnabled: boolean };

      console.log('FLEx status check:', flexStatus);

      // If FLEx is open but sharing is NOT enabled, show error
      if (flexStatus.isRunning && !flexStatus.sharingEnabled) {
        setExportStatus({
          success: false,
          message: "FieldWorks is open without sharing enabled. Please close FLEx or enable Project Sharing in Edit > Project Properties > Sharing tab."
        });
        setIsExporting(false);
        return;
      }

      // If FLEx is running WITH sharing enabled and we're overwriting, use safe redirect workflow
      if (flexStatus.isRunning && flexStatus.sharingEnabled && overwriteEnabled) {
        console.log('Using safe redirect workflow...');

        // 1. Get a safe navigation target
        const navTarget = await papi.commands.sendCommand(
          "flexExport.getSafeNavigationTarget",
          selectedFlexProject.name,
          nameToUse
        ) as { guid?: string; tool: string };

        console.log('Navigation target:', navTarget);

        // 2. Navigate FLEx away from the target text
        // Use the format that worked during testing: database%3d...%26tool%3d...%26guid%3d...%26tag%3d
        const deepLink = navTarget.guid
          ? `silfw://localhost/link?database%3d${encodeURIComponent(selectedFlexProject.name)}%26tool%3d${navTarget.tool}%26guid%3d${navTarget.guid}%26tag%3d`
          : `silfw://localhost/link?database%3d${encodeURIComponent(selectedFlexProject.name)}%26tool%3d${navTarget.tool}%26tag%3d`;

        console.log('Navigating away with deep link:', deepLink);

        try {
          await papi.commands.sendCommand('flexExport.navigateFlex', deepLink);
          console.log('Deep link navigation initiated');
        } catch (navErr) {
          console.error('Deep link navigation failed:', navErr);
        }

        // 3. Wait for navigation to complete (give FLEx time to fully switch views and release the old text)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Filter USJ content based on toggles before export
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

      const result = await papi.commands.sendCommand(
        "flexExport.exportToFlex",
        selectedFlexProject.name,
        nameToUse,
        filteredChapters,
        {
          overwrite: overwriteEnabled,
          vernacularWs: selectedWritingSystem?.code,
        }
      ) as { success: boolean; paragraphCount?: number; textName?: string; textGuid?: string; error?: string; errorCode?: string; suggestedName?: string };

      if (result.success) {
        const successMessage = (localizedStrings["%flexExport_exportSuccess%"] || "Successfully exported {paragraphCount} paragraphs to \"{textName}\"")
          .replace("{paragraphCount}", String(result.paragraphCount || 0))
          .replace("{textName}", result.textName || nameToUse);
        setExportStatus({ success: true, message: successMessage });

        // Store text GUID for "Open in FLEx" button
        if (result.textGuid) {
          setLastExportedText({
            projectName: selectedFlexProject.name,
            textGuid: result.textGuid
          });

          // If FLEx is running with sharing, navigate back to the Texts tool (without specific GUID)
          // This avoids cache timing issues - the user can select the text from the list
          if (flexStatus.isRunning && flexStatus.sharingEnabled) {
            // Wait for FLEx to fully commit the changes before navigating
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Navigate to interlinearEdit tool without a specific GUID - just opens the Texts area
            const textToolLink = `silfw://localhost/link?database%3d${encodeURIComponent(selectedFlexProject.name)}%26tool%3dinterlinearEdit%26tag%3d`;
            console.log('Navigating to Texts tool with deep link:', textToolLink);

            try {
              await papi.commands.sendCommand('flexExport.navigateFlex', textToolLink);
              console.log('Navigation to Texts tool initiated');

              // Optionally try to navigate to the specific created text
              // If it fails (GUID not ready), we'll just stay in Texts area
              if (result.textGuid) {
                await new Promise(resolve => setTimeout(resolve, 500)); // Brief wait for Texts to load
                const specificTextLink = `silfw://localhost/link?database%3d${encodeURIComponent(selectedFlexProject.name)}%26tool%3dinterlinearEdit%26guid%3d${result.textGuid}%26tag%3d`;
                console.log('Attempting to navigate to specific text:', specificTextLink);

                try {
                  await papi.commands.sendCommand('flexExport.navigateFlex', specificTextLink);
                  console.log('Successfully navigated to specific text');
                } catch (specificNavErr) {
                  console.log('Could not navigate to specific text (GUID not ready yet), staying in Texts area');
                  // Silently fail - user can click the text from the list
                }
              }
            } catch (navErr) {
              console.error('Failed to navigate to Texts tool:', navErr);
            }
          }
        }
      } else {
        // Check if it's a TEXT_EXISTS error and overwrite is disabled
        if (result.errorCode === "TEXT_EXISTS" && !overwriteEnabled) {
          // Use the suggested name from the bridge (it already checked what exists)
          const suggested = result.suggestedName || generateUniqueName(textName);
          setSuggestedName(suggested);
          setShowRenameConfirm(true);
        } else if (result.errorCode === "PROJECT_LOCKED") {
          // Special handling for locked project error
          setExportStatus({
            success: false,
            message: result.error || "Project is locked. Please close FLEx or enable Project Sharing."
          });
        } else {
          const errorMessage = (localizedStrings["%flexExport_exportFailed%"] || "Export failed: {error}")
            .replace("{error}", result.error || "Unknown error");
          setExportStatus({ success: false, message: errorMessage });
        }
      }
    } catch (err) {
      console.error('Export error:', err);

      // Extract error message from various error formats
      let errorText = "Unknown error";
      if (err instanceof Error) {
        errorText = err.message;
      } else if (typeof err === 'object' && err !== null) {
        // Try to extract error message from object
        const errObj = err as Record<string, unknown>;
        errorText = (errObj.error as string) ||
                   (errObj.message as string) ||
                   JSON.stringify(err);
      } else if (typeof err === 'string') {
        errorText = err;
      }

      const errorMessage = (localizedStrings["%flexExport_exportFailed%"] || "Export failed: {error}")
        .replace("{error}", errorText);
      setExportStatus({ success: false, message: errorMessage });
    } finally {
      setIsExporting(false);
    }
  }, [selectedFlexProject, textName, chaptersUSJ, overwriteEnabled, showOverwriteConfirm, selectedWritingSystem, scrRef.chapterNum, filterUsjContent, localizedStrings, generateUniqueName]);

  // Cancel overwrite confirmation
  const handleCancelOverwrite = useCallback(() => {
    setShowOverwriteConfirm(false);
  }, []);

  // Accept suggested renamed text
  const handleAcceptRename = useCallback(() => {
    handleExport(suggestedName);
  }, [handleExport, suggestedName]);

  // Cancel rename and stay on current screen
  const handleCancelRename = useCallback(() => {
    setShowRenameConfirm(false);
    setSuggestedName("");
  }, []);

  // Open the last exported text in FLEx using deep link
  const handleOpenInFlex = useCallback(async () => {
    if (!lastExportedText) return;

    const deepLink = `silfw://localhost/link?database%3d${encodeURIComponent(lastExportedText.projectName)}%26tool%3dinterlinearEdit%26guid%3d${lastExportedText.textGuid}%26tag%3d`;
    await papi.commands.sendCommand('platform.openExternal', deepLink);
  }, [lastExportedText]);

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
    <div id="flex-export-container" className="tw-p-4 tw-min-h-screen tw-bg-background tw-text-foreground" dir={isUiRtl ? "rtl" : "ltr"}>
      <div id="flex-export-content" className="tw-mx-auto">
        {/* Settings Row - Three inline boxes that wrap on narrow screens */}
        <div id="settings-row" className="tw-flex tw-flex-wrap tw-items-start tw-gap-4 tw-mb-8">
          {/* Paratext Settings Box */}
          <div id="paratext-settings-box" className="tw-shrink-0 tw-border tw-border-border tw-rounded-md tw-bg-card">
            <div id="paratext-settings-header" className="tw-p-2.5 tw-ps-4 tw-border-b tw-border-border tw-bg-muted">
              <Label id="paratext-settings-title" className="tw-text-sm tw-font-medium tw-text-foreground">
                {localizedStrings["%flexExport_paratextSettings%"]}
              </Label>
            </div>
            <div id="paratext-settings-content" className="tw-px-4 tw-py-3 tw-space-y-3">
              {/* Project Selection - Ctrl+click to include resources (secret mode) */}
              <div id="paratext-project-row" className="tw-flex tw-items-center tw-gap-3">
                <Label id="paratext-project-label" htmlFor="paratext-project-selector" className="tw-text-sm tw-text-foreground tw-whitespace-nowrap">
                  {localizedStrings["%flexExport_project%"]}
                </Label>
                <div id="paratext-project-selector-wrapper" onMouseDown={handleProjectSelectorClick}>
                  <ComboBox<ProjectOption>
                    id="paratext-project-selector"
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
              </div>

              {/* Scripture Reference Selector */}
              <div id="scripture-reference-row">
                <Label id="scripture-reference-label" className="tw-text-sm tw-font-medium tw-mb-2 tw-block tw-text-foreground">
                  {localizedStrings["%flexExport_selectBookChapter%"]}
                </Label>
                <div id="scripture-reference-controls" className="tw-flex tw-items-center tw-gap-3 tw-flex-wrap">
                  <BookChapterControl
                    scrRef={scrRef}
                    handleSubmit={handleStartRefChange}
                    getActiveBookIds={availableBookIds.length > 0 ? getActiveBookIds : undefined}
                  />
                  <Label id="end-chapter-label" htmlFor="end-chapter-selector" className="tw-text-sm tw-text-foreground">{localizedStrings["%flexExport_toChapter%"]} </Label>
                  <ComboBox<number>
                    id="end-chapter-selector"
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
          </div>

          {/* Include in Export Box */}
          <div id="include-export-box" className="tw-shrink-0 tw-border tw-border-border tw-rounded-md tw-bg-card">
            <div id="include-export-header" className="tw-p-2.5 tw-ps-4 tw-border-b tw-border-border tw-bg-muted">
              <Label id="include-export-title" className="tw-text-sm tw-font-medium tw-text-foreground">
                {localizedStrings["%flexExport_includeInExport%"]}
              </Label>
            </div>
            <div id="include-export-content" className="tw-px-4 tw-py-3 tw-flex tw-flex-col tw-gap-1">
              <label id="include-footnotes-row" className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  id="include-footnotes-checkbox"
                  checked={includeFootnotes}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeFootnotes(checked === true)}
                />
                <span id="include-footnotes-label" className="tw-text-sm tw-text-foreground">{localizedStrings["%flexExport_footnotes%"]}</span>
              </label>
              <label id="include-crossrefs-row" className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  id="include-crossrefs-checkbox"
                  checked={includeCrossRefs}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeCrossRefs(checked === true)}
                />
                <span id="include-crossrefs-label" className="tw-text-sm tw-text-foreground">{localizedStrings["%flexExport_crossReferences%"]}</span>
              </label>
              <label id="include-intro-row" className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  id="include-intro-checkbox"
                  checked={includeIntro}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeIntro(checked === true)}
                  disabled={scrRef.chapterNum !== 1}
                />
                <span id="include-intro-label" className={`tw-text-sm ${scrRef.chapterNum !== 1 ? "tw-text-muted-foreground" : "tw-text-foreground"}`}>
                  {localizedStrings["%flexExport_introduction%"]}
                </span>
              </label>
              <label id="include-remarks-row" className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  id="include-remarks-checkbox"
                  checked={includeRemarks}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeRemarks(checked === true)}
                />
                <span id="include-remarks-label" className="tw-text-sm tw-text-foreground">{localizedStrings["%flexExport_remarks%"]}</span>
              </label>
              <label id="include-figures-row" className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  id="include-figures-checkbox"
                  checked={includeFigures}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeFigures(checked === true)}
                />
                <span id="include-figures-label" className="tw-text-sm tw-text-foreground">{localizedStrings["%flexExport_figures%"]}</span>
              </label>
            </div>
          </div>

          {/* FLEx Settings Box */}
          <div id="flex-settings-box" className="tw-shrink-0 tw-border tw-border-border tw-rounded-md tw-bg-card tw-mb-4">
            <div id="flex-settings-header" className="tw-p-2.5 tw-ps-4 tw-border-b tw-border-border tw-bg-muted">
              <Label id="flex-settings-title" className="tw-text-sm tw-font-medium tw-text-foreground">
                {localizedStrings["%flexExport_flexSettings%"]}
              </Label>
            </div>
            <div id="flex-settings-content" className="tw-px-4 tw-py-3 tw-space-y-3">
              {/* Error message when FLEx is not available */}
              {flexLoadError && (
                <div id="flex-error-message" className="tw-p-2 tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-md dark:tw-bg-red-900/20 dark:tw-border-red-700">
                  <p className="tw-text-xs tw-text-red-800 dark:tw-text-red-200">
                    {flexLoadError === "no_projects"
                      ? localizedStrings["%flexExport_flexNotFound%"]
                      : (localizedStrings["%flexExport_flexLoadError%"] || "").replace("{error}", flexLoadError)}
                  </p>
                </div>
              )}

              {/* FLEx Project Selector */}
              <div id="flex-project-row" className="tw-flex tw-items-center tw-gap-3">
                <Label id="flex-project-label" htmlFor="flex-project-selector" className="tw-text-sm tw-text-foreground tw-whitespace-nowrap">
                  {localizedStrings["%flexExport_project%"]}
                </Label>
                <ComboBox<FlexProjectOption>
                  id="flex-project-selector"
                  options={flexProjects || []}
                  value={selectedFlexProject}
                  onChange={handleFlexProjectChange}
                  getOptionLabel={(option: FlexProjectOption) => option.label}
                  buttonPlaceholder={localizedStrings["%flexExport_selectFlexProject%"]}
                  textPlaceholder={localizedStrings["%flexExport_searchFlexProjects%"]}
                  commandEmptyMessage={localizedStrings["%flexExport_noFlexProjectsFound%"]}
                  buttonVariant="outline"
                />
              </div>

              {/* Writing System Selector */}
              {flexProjectDetails && writingSystemOptions.length > 0 && (
                <div id="writing-system-row" className="tw-flex tw-items-center tw-gap-3">
                  <Label id="writing-system-label" htmlFor="writing-system-selector" className="tw-text-sm tw-text-foreground tw-whitespace-nowrap">
                    {localizedStrings["%flexExport_writingSystem%"]}
                  </Label>
                  <ComboBox<WritingSystemOption>
                    id="writing-system-selector"
                    options={writingSystemOptions || []}
                    value={selectedWritingSystem}
                    onChange={handleWritingSystemChange}
                    getOptionLabel={(ws: WritingSystemOption) => ws.label}
                    buttonPlaceholder={localizedStrings["%flexExport_writingSystem%"]}
                    textPlaceholder={localizedStrings["%flexExport_searchWritingSystems%"] || "Search writing systems..."}
                    commandEmptyMessage={localizedStrings["%flexExport_noWritingSystemsFound%"] || "No writing systems found"}
                    buttonVariant="outline"
                  />
                </div>
              )}

              {/* Text Name Field */}
              <div id="text-name-section" className="tw-flex tw-flex-col tw-gap-1">
                <div id="text-name-row" className="tw-flex tw-items-center tw-gap-3">
                  <Label id="text-name-label" htmlFor="text-name-input" className="tw-text-sm tw-text-foreground tw-whitespace-nowrap">
                    {localizedStrings["%flexExport_textName%"]}
                  </Label>
                  <Input
                    id="text-name-input"
                    value={textName}
                    onChange={(e) => setTextName(e.target.value)}
                    placeholder={localizedStrings["%flexExport_textNamePlaceholder%"]}
                    className="tw-w-40"
                  />
                </div>
                {/* Expected export name hint */}
                {expectedExportName && !overwriteEnabled && (
                  <div id="expected-name-hint" className="tw-text-xs tw-text-muted-foreground tw-ml-28 tw-italic">
                    Will be created as "{expectedExportName}"
                  </div>
                )}
              </div>

              {/* Overwrite Toggle */}
              <div id="overwrite-row" className="tw-flex tw-items-center tw-gap-3">
                <Switch
                  id="overwrite-toggle"
                  checked={overwriteEnabled}
                  onCheckedChange={setOverwriteEnabled}
                />
                <Label htmlFor="overwrite-toggle" className="tw-text-sm tw-text-foreground tw-cursor-pointer">
                  {localizedStrings["%flexExport_overwrite%"]}
                </Label>
              </div>

              {/* Export Button and Status */}
              <div id="export-button-row" className="tw-flex tw-items-center tw-gap-3 tw-pt-1">
                <Button
                  id="export-button"
                  onClick={() => handleExport()}
                  disabled={!selectedFlexProject || !textName || !chaptersUSJ.length || isExporting}
                >
                  {isExporting
                    ? localizedStrings["%flexExport_exporting%"]
                    : localizedStrings["%flexExport_export%"]}
                </Button>

                {exportStatus && (
                  <div className="tw-flex tw-items-center tw-gap-3">
                    <span id="export-status-message" className={`tw-text-sm ${exportStatus.success ? "tw-text-green-600" : "tw-text-red-600"}`}>
                      {exportStatus.message}
                    </span>
                    {exportStatus.success && lastExportedText && (
                      <Button
                        id="open-in-flex-button"
                        variant="outline"
                        size="sm"
                        onClick={handleOpenInFlex}
                      >
                        Open in FLEx
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Overwrite Confirmation Modal */}
              <Modal open={showOverwriteConfirm} onClose={handleCancelOverwrite}>
                <ModalHeader>
                  <ModalTitle>{localizedStrings["%flexExport_overwrite%"] || "Overwrite?"}</ModalTitle>
                  <ModalDescription>
                    {(localizedStrings["%flexExport_overwriteConfirmMessage%"] || "")
                      .replace("{textName}", textName)}
                  </ModalDescription>
                </ModalHeader>
                <ModalFooter>
                  <Button variant="outline" onClick={handleCancelOverwrite}>
                    {localizedStrings["%flexExport_overwriteConfirmNo%"] || "Cancel"}
                  </Button>
                  <Button variant="destructive" onClick={() => handleExport()}>
                    {localizedStrings["%flexExport_overwriteConfirmYes%"] || "Overwrite"}
                  </Button>
                </ModalFooter>
              </Modal>

              {/* Rename Confirmation Modal */}
              <Modal open={showRenameConfirm} onClose={handleCancelRename}>
                <ModalHeader>
                  <ModalTitle>{localizedStrings["%flexExport_textName%"] || "Text Name"}</ModalTitle>
                  <ModalDescription>
                    {(localizedStrings["%flexExport_renameConfirmMessage%"] || 'A text named "{textName}" already exists. Create as "{suggestedName}" instead?')
                      .replace("{textName}", textName)
                      .replace("{suggestedName}", suggestedName)}
                  </ModalDescription>
                </ModalHeader>
                <ModalFooter>
                  <Button variant="outline" onClick={handleCancelRename}>
                    {localizedStrings["%flexExport_renameConfirmNo%"] || "Cancel"}
                  </Button>
                  <Button onClick={handleAcceptRename}>
                    {(localizedStrings["%flexExport_renameConfirmYes%"] || 'Use "{suggestedName}"')
                      .replace("{suggestedName}", suggestedName)}
                  </Button>
                </ModalFooter>
              </Modal>
            </div>
          </div>
        </div>

        {/* Scripture Preview */}
        <div id="scripture-preview-box" className="tw-mt-4 tw-border tw-border-border tw-rounded-md tw-bg-card">
          <div id="scripture-preview-header" className="tw-p-3 tw-ps-4 tw-border-b tw-border-border tw-bg-muted tw-flex tw-justify-between tw-items-center tw-flex-wrap tw-gap-2">
            <Label id="scripture-preview-title" className="tw-text-sm tw-font-medium tw-text-foreground">
              {viewMode === "formatted" && localizedStrings["%flexExport_scripturePreview%"]}
              {viewMode === "usfm" && localizedStrings["%flexExport_usfmPreview%"]}
              {viewMode === "usj" && localizedStrings["%flexExport_usjJsonData%"]}
            </Label>
            <div id="view-mode-buttons" className="tw-flex tw-gap-2">
              <Button
                id="view-mode-formatted"
                variant={viewMode === "formatted" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("formatted")}
              >
                {localizedStrings["%flexExport_formatted%"]}
              </Button>
              <Button
                id="view-mode-usfm"
                variant={viewMode === "usfm" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("usfm")}
              >
                {localizedStrings["%flexExport_usfm%"]}
              </Button>
              <Button
                id="view-mode-usj"
                variant={viewMode === "usj" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("usj")}
              >
                {localizedStrings["%flexExport_usjData%"]}
              </Button>
            </div>
          </div>
          <div id="scripture-preview-content" className="tw-p-4 tw-min-h-64 tw-max-h-96 tw-overflow-auto">
            {viewMode === "formatted" && (
              <div
                id="preview-formatted"
                className="tw-leading-relaxed tw-text-foreground"
                dir={isRtl ? "rtl" : "ltr"}
              >
                {formattedPreview}
              </div>
            )}
            {viewMode === "usfm" && (
              <pre
                id="preview-usfm"
                className="tw-text-foreground tw-font-mono"
                dir={isRtl ? "rtl" : "ltr"}
                style={{
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                {usfmText}
              </pre>
            )}
            {viewMode === "usj" && (
              <pre id="preview-usj" className="tw-text-xs tw-font-mono tw-whitespace-pre-wrap tw-text-foreground">
                {renderUsjWithDirection || localizedStrings["%flexExport_noUsjData%"]}
              </pre>
            )}
          </div>
        </div>

        {/* Status */}
        <div id="loading-status" className="tw-mt-4 tw-text-xs tw-text-muted-foreground">
          {isLoading && localizedStrings["%flexExport_loadingScripture%"]}
          {!isLoading && chaptersUSJ.length > 0 && (
            <span id="loaded-chapters-status">
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
