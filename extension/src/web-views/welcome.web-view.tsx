import { WebViewProps } from "@papi/core";
import papi from "@papi/frontend";
import { useLocalizedStrings, useProjectSetting, useSetting } from "@papi/frontend/react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Button, Checkbox, ComboBox, Input, Label, Switch, useEvent } from "platform-bible-react";
import { ChapterOnlyBookControl } from "./components/ChapterOnlyBookControl";
import { isPlatformError, getChaptersForBook } from "platform-bible-utils";
import { Canon, SerializedVerseRef } from "@sillsdev/scripture";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";

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

// Export progress step types
type ExportStep = {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'warning' | 'error';
};

function ExportProgressBar({ steps }: { steps: ExportStep[] }) {
  if (!steps.length) return null;

  const activeStep = steps.find(s => s.status === 'active');

  return (
    <div className="tw-mt-1">
      <div className="tw-flex tw-gap-1 tw-mb-1">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`tw-h-2 tw-flex-1 tw-rounded-sm tw-transition-colors tw-duration-300 ${
              step.status === 'done' ? 'tw-bg-green-600' :
              step.status === 'active' ? 'tw-bg-blue-500 tw-animate-pulse' :
              step.status === 'warning' ? 'tw-bg-yellow-500' :
              step.status === 'error' ? 'tw-bg-red-500' :
              'tw-bg-gray-300'
            }`}
          />
        ))}
      </div>
      {activeStep && (
        <div className="tw-text-xs tw-opacity-75">
          {activeStep.label}
        </div>
      )}
    </div>
  );
}

// Single, unified status strip rendered above the Scripture Preview. Replaces
// the per-section error/progress/result blocks that previously lived inside
// the FLEx Settings panel — those caused horizontal overflow when long
// messages couldn't wrap (the panel was a tw-shrink-0 flex item, so it grew
// to fit the longest line). The strip occupies a reserved min-height even
// when idle, so showing/clearing a message never triggers layout shift.
type StatusVariant = "info" | "progress" | "success" | "warning" | "error";

const STATUS_VARIANT_STYLES: Record<StatusVariant, { container: string; Icon: React.ComponentType<{ className?: string }>; spinning?: boolean }> = {
  info: {
    container: "tw-bg-blue-50 tw-border-blue-200 tw-text-blue-900 dark:tw-bg-blue-900/20 dark:tw-border-blue-700 dark:tw-text-blue-200",
    Icon: Info,
  },
  progress: {
    container: "tw-bg-blue-50 tw-border-blue-200 tw-text-blue-900 dark:tw-bg-blue-900/20 dark:tw-border-blue-700 dark:tw-text-blue-200",
    Icon: Loader2,
    spinning: true,
  },
  success: {
    container: "tw-bg-green-50 tw-border-green-200 tw-text-green-900 dark:tw-bg-green-900/20 dark:tw-border-green-700 dark:tw-text-green-200",
    Icon: CheckCircle2,
  },
  warning: {
    container: "tw-bg-amber-50 tw-border-amber-200 tw-text-amber-900 dark:tw-bg-amber-900/20 dark:tw-border-amber-700 dark:tw-text-amber-200",
    Icon: AlertTriangle,
  },
  error: {
    container: "tw-bg-red-50 tw-border-red-200 tw-text-red-900 dark:tw-bg-red-900/20 dark:tw-border-red-700 dark:tw-text-red-200",
    Icon: AlertCircle,
  },
};

type StatusStripProps = {
  variant?: StatusVariant;
  message?: string;
  steps?: ExportStep[];
  trailing?: React.ReactNode;
};

function StatusStrip({ variant, message, steps, trailing }: StatusStripProps) {
  const hasMessage = !!variant && (!!message || (steps && steps.length > 0));
  const style = hasMessage ? STATUS_VARIANT_STYLES[variant] : undefined;

  const containerClasses = hasMessage && style
    ? `tw-min-h-[2.75rem] tw-w-full tw-rounded-md tw-border tw-p-2.5 tw-flex tw-items-center tw-gap-4 ${style.container}`
    : "tw-min-h-[2.75rem] tw-w-full tw-flex tw-items-center tw-justify-end";

  return (
    <div
      id="status-strip"
      role={hasMessage ? "status" : undefined}
      aria-live={hasMessage ? "polite" : undefined}
      className={containerClasses}
    >
      {hasMessage && style && (
        <>
          <span className="tw-flex tw-h-5 tw-w-5 tw-shrink-0 tw-items-center tw-justify-center tw-mr-1">
            <style.Icon className={`tw-h-4 tw-w-4 ${style.spinning ? "tw-animate-spin" : ""}`} />
          </span>
          <div className="tw-flex-1 tw-min-w-0">
            {message && (
              <p className="tw-text-sm tw-whitespace-normal tw-break-words tw-leading-snug">
                {message}
              </p>
            )}
            {steps && steps.length > 0 && (
              <div className={message ? "tw-mt-2" : ""}>
                <ExportProgressBar steps={steps} />
              </div>
            )}
          </div>
        </>
      )}
      {trailing && (
        <div className="tw-shrink-0 tw-ms-auto">
          {trailing}
        </div>
      )}
    </div>
  );
}

// FLEx project types (matching bridge service).
// The bridge populates writing-system arrays on every list/info response,
// so list and detail shapes are now identical. See flex-bridge.service.ts.
interface WritingSystemInfo {
  code: string;
  name: string;
  isDefault: boolean;
}

interface FlexProjectInfo {
  name: string;
  path: string;
  vernacularWs: string;
  analysisWs: string;
  vernacularWritingSystems: WritingSystemInfo[];
  analysisWritingSystems: WritingSystemInfo[];
}

type FlexProjectDetails = FlexProjectInfo;

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

// Per-project export settings (stored in WebView state)
interface ProjectExportSettings {
  flexProjectName: string;
  writingSystemCode: string;
  includeFootnotes: boolean;
  includeCrossRefs: boolean;
  includeIntro: boolean;
  includeRemarks: boolean;
  includeFigures: boolean;
  includeBookHeaders: boolean;
}

// Default settings for new projects. The \id line is always emitted regardless
// of toggles.
const DEFAULT_PROJECT_SETTINGS: ProjectExportSettings = {
  flexProjectName: "",
  writingSystemCode: "",
  includeFootnotes: false,
  includeCrossRefs: false,
  includeIntro: false,
  includeRemarks: false,
  includeFigures: true,
  includeBookHeaders: false,
};

// Default scripture reference
const DEFAULT_SCR_REF: SerializedVerseRef = { book: "GEN", chapterNum: 1, verseNum: 1 };

// Network event the host fires every time the menu item is invoked. Carries
// the Paratext project + scripture ref of the menu invocation context. The
// host-side openWebView path with `existingId: "?"` does NOT push new state
// to a running React component on reuse (paranext-core just brings the panel
// to front), so this event is the side channel used to keep the panel in sync
// when reopened from a different project or chapter. See main.ts. Issue #14.
const NAVIGATION_EVENT_TYPE = "flexExport.navigationContext";
interface NavigationContext {
  projectId?: string;
  initialScrRef?: SerializedVerseRef;
  /**
   * Reason the host did NOT auto-select a project. Surfaced inline in the
   * StatusStrip instead of as a host-level toast so the explanation is
   * adjacent to the empty Project field the user is staring at.
   */
  notExportableReason?: "resource";
}

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
  "%flexExport_bookHeaders%": "Book Headers (\\h, \\toc)",
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
  "%flexExport_exportSuccessSingular%": "Successfully exported {paragraphCount} paragraph to \"{textName}\"",
  "%flexExport_exportFailed%": "Export failed: {error}",
  "%flexExport_windowsOnly%": "This feature is only available on Windows",
  "%flexExport_noFlexProjectSelected%": "No FLEx project selected",
  "%flexExport_flexNotFound%": "FLEx is not installed or no projects were found. Please install FLEx and create at least one project.",
  "%flexExport_flexLoadError%": "Couldn't load FLEx projects. Check that FieldWorks 9 is installed, then close and reopen this dialog. ({error})",
  "%flexExport_flexDetailsError%": "Couldn't read details for \"{name}\". The project may be open in FLEx with sharing off, or it may need migration. Try opening it in FieldWorks first, then come back.",
  "%flexExport_paratextProjectsError%": "Couldn't load the list of Paratext projects. Try restarting Paratext. ({error})",
  "%flexExport_booksError%": "Couldn't read which books are in \"{projectName}\". The book/chapter selectors may show all options. If exporting fails, try opening the project in Paratext first.",
  "%flexExport_chaptersError%": "Couldn't load {book} {chapter}. The chapter may not exist in this project, or text data is unavailable. Try a different chapter.",
  "%flexExport_sharingDisabled%": "FLEx is open with sharing turned off for \"{projectName}\". Enable Project Sharing in FLEx (Edit > FieldWorks Project Properties > Sharing) or close FLEx, then try again.",
  "%flexExport_projectLocked%": "FLEx has \"{projectName}\" locked. Close FLEx, or enable Project Sharing in FLEx (Edit > FieldWorks Project Properties > Sharing), then try again.",
  "%flexExport_verifyTimeout%": "Text was written, but FLEx hasn't confirmed it yet. Refresh FLEx (close and reopen the project) to see \"{textName}\".",
  "%flexExport_resourceNotExportable%": "Resources can't be exported to FLEx. Pick a Paratext project from the dropdown above to choose a source.",
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

  // Get initial scripture reference from state (captured when dialog was opened).
  // This is only authoritative on first mount; subsequent menu invocations push
  // updated context via the NAVIGATION_EVENT_TYPE network event below.
  const initialScrRef = state?.initialScrRef as SerializedVerseRef | undefined;

  // Scripture reference state - initialized from the captured reference
  const [scrRef, setScrRef] = useState<SerializedVerseRef>(initialScrRef || DEFAULT_SCR_REF);

  // End chapter for range selection (defaults to start chapter)
  const [endChapter, setEndChapter] = useState(initialScrRef?.chapterNum || 1);

  // Reason the host couldn't auto-select a source project (e.g. invoked from
  // a resource pane). Surfaced as an info-variant message in the StatusStrip
  // until the user picks an editable project.
  const [notExportableReason, setNotExportableReason] = useState<"resource" | undefined>();

  // Pending nav target — when a nav event arrives carrying a different projectId
  // than the current panel's projectId, we stash the scrRef here and defer
  // applying it until the projectId prop has actually updated and the new
  // project's available-books list has loaded. This avoids the
  // availableBookIds fallback resetting scrRef to the old project's first
  // book in the brief window before the new project's books arrive.
  const pendingNavRef = useRef<SerializedVerseRef | undefined>(undefined);

  // Subscribe to navigation context pushed by the host on every menu
  // invocation. See NAVIGATION_EVENT_TYPE comment.
  const navigationEvent = useMemo(
    () => papi.network.getNetworkEvent<NavigationContext>(NAVIGATION_EVENT_TYPE),
    []
  );
  useEvent(
    navigationEvent,
    useCallback(
      (ctx: NavigationContext) => {
        const targetRef = ctx.initialScrRef;
        const targetProjectId = ctx.projectId;

        // Track the host's reason for not auto-selecting a project. Cleared
        // when the user picks an editable project below.
        setNotExportableReason(ctx.notExportableReason);

        if (targetProjectId && targetProjectId !== projectId) {
          // Different PT project — switch via WebViewDefinition so the
          // projectId prop updates and downstream effects (books list, USJ
          // fetch, etc.) refire. Apply the scrRef once the books for the
          // new project arrive (see availableBookIdsForProjectId effect).
          if (targetRef) pendingNavRef.current = { ...targetRef, verseNum: 1 };
          updateWebViewDefinition({ projectId: targetProjectId });
        } else if (targetRef) {
          // Same project — apply ref immediately
          setScrRef({ ...targetRef, verseNum: 1 });
          setEndChapter(targetRef.chapterNum || 1);
        }
      },
      [projectId, updateWebViewDefinition]
    )
  );

  // ---- Persistence ----
  //
  // Two-tier model:
  //   1. `savedX` / `setSavedX` — useWebViewState slots backed by the WebView's
  //      persisted state. These are READ at render time (so we always see the
  //      latest disk value when the key changes — e.g. PT project switch via
  //      nav event) but WRITTEN only on a successful export.
  //   2. `x` / `setX` — local React state that drives the UI. Seeded from the
  //      saved slot on key change, mutated freely by the user.
  //
  // This separation means that fiddling with the dropdowns/checkboxes does
  // NOT mutate persisted state — only a successful export does. See
  // handleExport's success branch below. (Auto-heal writes that *clear* a
  // saved value when its target no longer exists are intentional exceptions.)
  //
  // Keys:
  //   flexProjectName-<ptProjectId>                 — default FLEx project for this PT project
  //   writingSystemCode-<ptProjectId>-<flexProject> — WS used last with this (PT, FLEx) pair
  //   include*-<ptProjectId>                        — content-filter toggles per PT project
  //   overwriteEnabled                              — session-scoped, intentionally not per-project

  const [savedFlexProjectName, setSavedFlexProjectName] = useWebViewState<string>(
    `flexProjectName-${projectId || "default"}`,
    ""
  );

  // FLEx project state
  const [flexProjects, setFlexProjects] = useState<FlexProjectOption[]>([]);
  // Full per-project info (writing systems etc.) keyed by project name. Populated
  // alongside the project list so per-selection lookup is synchronous and we
  // never need a second bridge round trip just to render WS options.
  const [flexProjectsByName, setFlexProjectsByName] = useState<Map<string, FlexProjectInfo>>(() => new Map());
  const [selectedFlexProject, setSelectedFlexProject] = useState<FlexProjectOption | undefined>();

  // WS persistence is keyed per (PT project, FLEx project) pair — the WS list
  // belongs to the FLEx project, so a saved code is only meaningful while
  // that pairing is selected. When the user switches FLEx project, the
  // useWebViewState key changes and we read whatever WS was last successfully
  // exported with that *new* pair (or "" if none).
  const wsPersistenceKey = `writingSystemCode-${projectId || "default"}-${selectedFlexProject?.name || ""}`;
  const [savedWritingSystemCode, setSavedWritingSystemCode] = useWebViewState<string>(
    wsPersistenceKey,
    ""
  );

  // Persisted filter toggles (read on key change, written only on export success)
  const [savedIncludeFootnotes, setSavedIncludeFootnotes] = useWebViewState<boolean>(
    `includeFootnotes-${projectId || "default"}`,
    false
  );
  const [savedIncludeCrossRefs, setSavedIncludeCrossRefs] = useWebViewState<boolean>(
    `includeCrossRefs-${projectId || "default"}`,
    false
  );
  const [savedIncludeIntro, setSavedIncludeIntro] = useWebViewState<boolean>(
    `includeIntro-${projectId || "default"}`,
    false
  );
  const [savedIncludeRemarks, setSavedIncludeRemarks] = useWebViewState<boolean>(
    `includeRemarks-${projectId || "default"}`,
    false
  );
  const [savedIncludeFigures, setSavedIncludeFigures] = useWebViewState<boolean>(
    `includeFigures-${projectId || "default"}`,
    true
  );
  const [savedIncludeBookHeaders, setSavedIncludeBookHeaders] = useWebViewState<boolean>(
    `includeBookHeaders-${projectId || "default"}`,
    false
  );

  // Coerce a useWebViewState boolean read (which may be a PlatformError) to a real boolean.
  const coerceBool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

  // Local UI state for filter toggles, seeded from the persisted slots.
  const [includeFootnotes, setIncludeFootnotes] = useState<boolean>(coerceBool(savedIncludeFootnotes, false));
  const [includeCrossRefs, setIncludeCrossRefs] = useState<boolean>(coerceBool(savedIncludeCrossRefs, false));
  const [includeIntro, setIncludeIntro] = useState<boolean>(coerceBool(savedIncludeIntro, false));
  const [includeRemarks, setIncludeRemarks] = useState<boolean>(coerceBool(savedIncludeRemarks, false));
  const [includeFigures, setIncludeFigures] = useState<boolean>(coerceBool(savedIncludeFigures, true));
  const [includeBookHeaders, setIncludeBookHeaders] = useState<boolean>(coerceBool(savedIncludeBookHeaders, false));

  // Re-seed local UI state from persisted slots when the underlying key changes
  // (i.e. PT project switched via nav event, or the saved value mutated via
  // an export-success write or auto-heal).
  useEffect(() => { setIncludeFootnotes(coerceBool(savedIncludeFootnotes, false)); }, [savedIncludeFootnotes]);
  useEffect(() => { setIncludeCrossRefs(coerceBool(savedIncludeCrossRefs, false)); }, [savedIncludeCrossRefs]);
  useEffect(() => { setIncludeIntro(coerceBool(savedIncludeIntro, false)); }, [savedIncludeIntro]);
  useEffect(() => { setIncludeRemarks(coerceBool(savedIncludeRemarks, false)); }, [savedIncludeRemarks]);
  useEffect(() => { setIncludeFigures(coerceBool(savedIncludeFigures, true)); }, [savedIncludeFigures]);
  useEffect(() => { setIncludeBookHeaders(coerceBool(savedIncludeBookHeaders, false)); }, [savedIncludeBookHeaders]);

  // Overwrite setting - session-scoped (intentionally not persisted per project — destructive default is unsafe to remember)
  const [overwriteEnabled, setOverwriteEnabled] = useState<boolean>(false);
  const [flexProjectDetails, setFlexProjectDetails] = useState<FlexProjectDetails | undefined>();
  const [isLoadingFlexProjects, setIsLoadingFlexProjects] = useState(false);
  const [flexLoadError, setFlexLoadError] = useState<string | undefined>();
  // Soft-failure states for the four async fetches that previously failed
  // silently (chapters preview empty, dropdowns empty, etc. with no
  // explanation). Surfaced as actionable warnings in the StatusStrip.
  const [flexDetailsError, setFlexDetailsError] = useState<string | undefined>();
  const [paratextProjectsError, setParatextProjectsError] = useState<string | undefined>();
  const [booksError, setBooksError] = useState<string | undefined>();
  const [chaptersError, setChaptersError] = useState<{ book: string; chapter: number } | undefined>();

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
  const [exportStatus, setExportStatus] = useState<{ variant: "success" | "warning" | "error"; message: string } | undefined>();
  const [exportSteps, setExportSteps] = useState<ExportStep[]>([]);

  // Helper to update a single export step's status
  const updateStep = useCallback((stepId: string, status: ExportStep['status']) => {
    setExportSteps(prev => prev.map(s => s.id === stepId ? { ...s, status } : s));
  }, []);

  // Counter incremented after each successful export to re-trigger the "Will be created as" check
  const [exportCount, setExportCount] = useState(0);

  // Get chapter count for current book
  const chapterCount = useMemo(() => {
    const bookNum = Canon.bookIdToNumber(scrRef.book);
    const count = getChaptersForBook(bookNum);
    return count > 0 ? count : 1;
  }, [scrRef.book]);

  // When start chapter changes, reset end chapter to match (and clamp to valid range)
  // Verse is always normalized to 1 — selection is chapter-level only
  const handleStartRefChange = useCallback(
    (newScrRef: { book: string; chapterNum: number; verseNum: number }) => {
      setScrRef({ ...newScrRef, verseNum: 1 });
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
  if (isPlatformError(savedFlexProjectName)) {
    console.log('[Persistence] Auto-heal: PlatformError on savedFlexProjectName, using default');
  }
  const savedFlexProject = isPlatformError(savedFlexProjectName) ? "" : savedFlexProjectName;

  // Load FLEx projects on mount.
  //
  // Runs exactly once (empty deps). Persistence-restore lives in a separate
  // effect below so its auto-heal write to `savedFlexProjectName` cannot
  // re-fire this fetch — that re-entrancy was launching duplicate background
  // bridge processes (issue #11).
  //
  // The bridge's --list-projects now returns full writing-system metadata for
  // every project in a single call (parsed from on-disk .fwdata files, no LCM
  // open), so we no longer need a separate per-project preload pass. Issues
  // #11 and #13 trace back to that preload.
  useEffect(() => {
    let cancelled = false;

    const fetchFlexProjects = async () => {
      setIsLoadingFlexProjects(true);
      setFlexLoadError(undefined);
      try {
        const projects = await papi.commands.sendCommand(
          "flexExport.listFlexProjects"
        ) as FlexProjectInfo[];

        if (cancelled) return;

        if (projects && projects.length > 0) {
          const options: FlexProjectOption[] = projects.map((p) => ({
            label: p.name,
            name: p.name,
          }));
          const lookup = new Map<string, FlexProjectInfo>();
          for (const p of projects) {
            lookup.set(p.name, p);
          }
          setFlexProjects(options);
          setFlexProjectsByName(lookup);
        } else {
          // No projects found - FLEx may not be installed or no projects exist
          setFlexProjects([]);
          setFlexProjectsByName(new Map());
          setFlexLoadError("no_projects");
        }
      } catch (err) {
        console.error("Failed to fetch FLEx projects:", err);
        if (!cancelled) {
          setFlexProjects([]);
          setFlexProjectsByName(new Map());
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
  }, []);

  // Restore the saved FLEx project once both the project list and the saved
  // name are available. Kept separate from the fetch effect so the auto-heal
  // write below does not re-trigger the list fetch.
  useEffect(() => {
    if (flexProjects.length === 0) return;
    if (!savedFlexProjectName) return;

    const savedOption = flexProjects.find((p) => p.name === savedFlexProjectName);
    if (savedOption) {
      console.log('[Persistence] Restored FLEx project:', savedOption.label);
      setSelectedFlexProject(savedOption);
    } else {
      console.log('[Persistence] Auto-heal: FLEx project not found, resetting:', savedFlexProjectName);
      setSavedFlexProjectName("");
    }
    // setSavedFlexProjectName is stable; intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flexProjects, savedFlexProjectName]);

  // Get the saved writing system code (handle potential error)
  if (isPlatformError(savedWritingSystemCode)) {
    console.log('[Persistence] Auto-heal: PlatformError on savedWritingSystemCode, using default');
  }
  const savedWsCode = isPlatformError(savedWritingSystemCode) ? "" : savedWritingSystemCode;

  // Load FLEx project details when a project is selected.
  //
  // Writing-system data already arrived with the list response, so we look it
  // up synchronously from `flexProjectsByName`. The async getFlexProjectInfo
  // call remains as a defensive fallback for the rare case where a project
  // appears in the dropdown but is missing from the lookup map (e.g. saved
  // selection restored before the list resolved).
  useEffect(() => {
    let cancelled = false;

    const fetchProjectDetails = async () => {
      if (!selectedFlexProject) {
        setFlexProjectDetails(undefined);
        setSelectedWritingSystem(undefined);
        setFlexDetailsError(undefined);
        return;
      }

      setFlexDetailsError(undefined);
      try {
        let details: FlexProjectDetails | undefined =
          flexProjectsByName.get(selectedFlexProject.name);

        if (!details) {
          details = await papi.commands.sendCommand(
            "flexExport.getFlexProjectInfo",
            selectedFlexProject.name
          ) as FlexProjectDetails | undefined;
        }

        if (!cancelled && details) {
          setFlexProjectDetails(details);

          // Select writing system: restore saved, or use default/only available
          const wsCount = details.vernacularWritingSystems?.length || 0;
          console.log('[WS] Available writing systems:', wsCount);
          let wsToSelect: WritingSystemInfo | undefined;

          if (wsCount === 1) {
            // Only one WS available - use it automatically (no selector shown)
            wsToSelect = details.vernacularWritingSystems?.[0];
            console.log('[WS] Auto-selecting only available writing system:', wsToSelect?.code);
          } else if (savedWsCode && details.vernacularWritingSystems) {
            // Multiple WS - try to restore saved selection
            wsToSelect = details.vernacularWritingSystems.find((ws) => ws.code === savedWsCode);
            if (wsToSelect) {
              console.log('[WS] Restored saved writing system:', wsToSelect.code);
            } else {
              console.log('[Persistence] Auto-heal: WS not found, resetting:', savedWsCode);
              setSavedWritingSystemCode("");
            }
          }

          // If no saved WS or saved WS not found, use default
          if (!wsToSelect && wsCount > 1) {
            wsToSelect = details.vernacularWritingSystems?.find((ws) => ws.isDefault)
              || details.vernacularWritingSystems?.[0];
            console.log('[WS] Using default writing system:', wsToSelect?.code);
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
        if (!cancelled) {
          setFlexDetailsError(selectedFlexProject.name);
        }
      }
    };

    fetchProjectDetails();

    return () => {
      cancelled = true;
    };
  }, [selectedFlexProject, savedWsCode, flexProjectsByName]);

  // Auto-generate text name from book and chapter range (FLExTrans-compatible format)
  useEffect(() => {
    if (!scrRef.book) return;

    const bookName = Canon.bookIdToEnglishName(scrRef.book);
    // Psalms is the only canonical book with more than 100 chapters (150),
    // so it gets 3-digit padding to keep lexicographic sort aligned with
    // numeric order in FLEx. Every other book maxes out below 100 and uses
    // 2-digit padding.
    const padWidth = scrRef.book === "PSA" ? 3 : 2;
    const padChapter = (n: number) => String(n).padStart(padWidth, '0');

    let generatedName: string;

    if (scrRef.chapterNum === endChapter) {
      generatedName = `${bookName} ${padChapter(scrRef.chapterNum)}`;
    } else {
      generatedName = `${bookName} ${padChapter(scrRef.chapterNum)}-${padChapter(endChapter)}`;
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
  }, [selectedFlexProject, textName, overwriteEnabled, exportCount]);

  // Fetch available projects (only editable projects unless secret mode enabled)
  useEffect(() => {
    let cancelled = false;

    const fetchProjects = async () => {
      setParatextProjectsError(undefined);
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
        if (!cancelled) {
          setParatextProjectsError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    fetchProjects();

    return () => {
      cancelled = true;
    };
  }, [includeResources]);

  // Tracks which projectId the current `availableBookIds` was fetched for.
  // Without this, the "navigate to first available book" fallback below can
  // fire against the *previous* project's book list during the brief window
  // between projectId changing and the new project's books arriving — and
  // wipe a freshly-applied nav target. Issue #14 race fix.
  const [availableBookIdsForProjectId, setAvailableBookIdsForProjectId] = useState<string | undefined>();

  // Fetch available books when project changes
  useEffect(() => {
    let cancelled = false;

    const fetchAvailableBooks = async () => {
      if (!projectId) {
        setAvailableBookIds([]);
        setAvailableBookIdsForProjectId(undefined);
        setBooksError(undefined);
        return;
      }

      setBooksError(undefined);
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
          setAvailableBookIdsForProjectId(projectId);
        } else if (!cancelled && !booksPresent) {
          // No books present data - clear the filter
          setAvailableBookIds([]);
          setAvailableBookIdsForProjectId(projectId);
        }
      } catch (err) {
        console.error("Failed to fetch available books:", err);
        if (!cancelled) {
          setAvailableBookIds([]);
          setAvailableBookIdsForProjectId(projectId);
          setBooksError(selectedProject?.label || projectId);
        }
      }
    };

    fetchAvailableBooks();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Apply a deferred nav target once the new project's books have loaded.
  // Pending targets only exist when a nav event arrived for a *different*
  // projectId than was current at the time. Splitting "switch project" and
  // "apply scrRef" into two phases lets the fallback effect below see a
  // consistent (projectId, availableBookIds, scrRef) tuple.
  useEffect(() => {
    if (availableBookIdsForProjectId !== projectId) return;
    const target = pendingNavRef.current;
    if (!target) return;
    pendingNavRef.current = undefined;

    if (availableBookIds.length === 0 || availableBookIds.includes(target.book)) {
      setScrRef({ ...target, verseNum: 1 });
      setEndChapter(target.chapterNum || 1);
    } else {
      // Target book isn't in the new project — fall through to the
      // first-available fallback below.
    }
  }, [availableBookIdsForProjectId, projectId, availableBookIds]);

  // Navigate to first available book if current book is not in the project.
  // Gated on availableBookIds being for the *current* projectId, otherwise
  // a stale book list from the previous project would clobber a fresh nav
  // target. Also skipped while a pending nav target is queued.
  useEffect(() => {
    if (availableBookIdsForProjectId !== projectId) return;
    if (pendingNavRef.current) return;
    if (availableBookIds.length > 0 && !availableBookIds.includes(scrRef.book)) {
      const firstBook = availableBookIds[0];
      setScrRef({ book: firstBook, chapterNum: 1, verseNum: 1 });
      setEndChapter(1);
    }
  }, [availableBookIds, availableBookIdsForProjectId, projectId, scrRef.book]);

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
        // User picked a project — the "resource pane" notice no longer applies.
        setNotExportableReason(undefined);
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
      if (option) {
        setSelectedFlexProject(option);
      }
    },
    []
  );

  // Handle writing system selection
  const handleWritingSystemChange = useCallback(
    (option: WritingSystemOption | undefined) => {
      if (option) {
        setSelectedWritingSystem(option);
      }
    },
    []
  );

  // Clear export status when FLEx project changes
  useEffect(() => {
    setExportStatus(undefined);
  }, [selectedFlexProject]);

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
        setChaptersError(undefined);
        return;
      }

      setIsLoading(true);
      setChaptersError(undefined);
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

        // \id is emitted only when the export starts at chapter 1 — for any
        // other starting chapter the book node simply isn't present in
        // Paratext's USJ, and we deliberately don't synthesise one. Issue #15.

        if (!cancelled) {
          setChaptersUSJ(chapters);
        }
      } catch (err) {
        console.error("Failed to fetch chapters:", err);
        if (!cancelled) {
          setChaptersUSJ([]);
          setChaptersError({ book: scrRef.book, chapter: scrRef.chapterNum });
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
    // Also includes main title markers (mt, mt1...) per FLExTrans convention
    return /^(imt\d?|is\d?|ip|ipi|im|imi|ipq|imq|ipr|iq\d?|ib|ili\d?|iot|io\d?|iex|ie|mt\d?)$/.test(marker);
  };

  // Book header markers (\h running header, \toc1-3 / \toca1-3 table-of-contents
  // entries). These have translatable content; the marker itself is metadata.
  // Filtering is gated on the includeBookHeaders toggle. Issue #15.
  const isBookHeaderMarker = (marker: string): boolean => {
    return /^(h\d?|toc\d|toca\d?)$/.test(marker);
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

          if (node.type === "book") {
            // \id BOOK_CODE — only present when starting at chapter 1 (Paratext
            // stores the book node only in chapter 1's USJ). Issue #15.
            const code = node.code ?? "";
            return `\\id ${code}\n`;
          }
          if (node.type === "chapter" && node.number) {
            return `\\c ${node.number}\n`;
          }
          if (node.type === "verse" && node.number) {
            return `\\v ${node.number} `;
          }
          if (node.type === "para" && node.marker) {
            // Drop book-header markers (\h, \toc*) only when the toggle is off.
            if (!includeBookHeaders && isFirstChapter && isBookHeaderMarker(node.marker)) {
              return "";
            }
            // Skip intro/title markers if not including intro (only for chapter 1)
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
  }, [chaptersUSJ, isLoading, includeFootnotes, includeCrossRefs, includeIntro, includeRemarks, includeFigures, includeBookHeaders, scrRef.chapterNum, localizedStrings]);

  // Convert USJ to formatted HTML-like preview
  const formattedPreview = useMemo(() => {
    if (isLoading) return <div>{localizedStrings["%flexExport_loading%"]}</div>;
    if (!chaptersUSJ.length) return <div>{localizedStrings["%flexExport_noScriptureData%"]}</div>;

    const renderContent = (content: (UsjNode | string)[], key = "", isFirstChapter = false): React.ReactNode[] => {
      return content.map((item, idx) => {
        const itemKey = `${key}-${idx}`;
        if (typeof item === "string") return <span key={itemKey}>{item}</span>;

        const node = item as UsjNode;

        if (node.type === "book") {
          // Render \id BOOK_CODE as a small monospace label. Only present when
          // the export starts at chapter 1 (Paratext stores the book node only
          // in chapter 1's USJ). Issue #15.
          return (
            <div
              key={itemKey}
              className="tw-text-xs tw-font-mono tw-text-muted-foreground tw-mb-2"
            >
              \id {node.code ?? ""}
            </div>
          );
        }
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
          // Drop book-header markers (\h, \toc*) when the toggle is off.
          if (!includeBookHeaders && isFirstChapter && isBookHeaderMarker(node.marker)) {
            return null;
          }
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
          // Render book headers (\h, \toc*) with their SFM tag visible, like \id.
          if (isBookHeaderMarker(node.marker)) {
            return (
              <div
                key={itemKey}
                className="tw-text-xs tw-font-mono tw-text-muted-foreground tw-mb-2"
              >
                {`\\${node.marker} `}
                {node.content && renderContent(node.content, itemKey, isFirstChapter)}
              </div>
            );
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
  }, [chaptersUSJ, isLoading, includeFootnotes, includeCrossRefs, includeIntro, includeRemarks, includeFigures, includeBookHeaders, scrRef.chapterNum, localizedStrings]);

  // Filter USJ content based on toggles
  const filterUsjContent = useCallback(
    (content: (UsjNode | string)[], isFirstChapter: boolean): (UsjNode | string)[] => {
      return content
        .map((item) => {
          if (typeof item === "string") return item;
          const node = item as UsjNode;

          // The book identification node (\id) passes through the filter
          // unchanged when present. It only appears when the export starts at
          // chapter 1; for later starting chapters it isn't in Paratext's USJ
          // and we don't synthesise one. Issue #15.

          if (node.type === "para" && node.marker) {
            // Drop \h and \toc* only when the user has unchecked Book Headers.
            // When kept, the marker is analysis and the content is vernacular
            // (translatable book name).
            if (!includeBookHeaders && isFirstChapter && isBookHeaderMarker(node.marker)) {
              return null;
            }
            // Skip intro/title markers if not including intro (only for chapter 1)
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
    [includeFootnotes, includeCrossRefs, includeIntro, includeRemarks, includeFigures, includeBookHeaders]
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

    // Initialize progress steps
    const steps: ExportStep[] = [
      { id: 'export', label: 'Exporting text...', status: 'active' },
      { id: 'verify', label: 'Verifying text...', status: 'pending' },
      { id: 'complete', label: 'Complete', status: 'pending' },
    ];
    setExportSteps(steps);

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
          variant: "error",
          message: (localizedStrings["%flexExport_sharingDisabled%"] || "")
            .replace("{projectName}", selectedFlexProject.name),
        });
        updateStep('export', 'error');
        setIsExporting(false);
        return;
      }

      // Note: FLEx navigation is handled early (when project details load), not at export time.
      // By the time the user clicks Export, FLEx has already been moved to the Lexicon.

      // Filter USJ content based on toggles before export.
      // The export's first chapter (idx 0) is treated as the "first chapter" for
      // chapter-1-only filters (book headers, intro). The user may be exporting
      // a range starting at chapter 5 — in that case the USJ for chapter 5 has
      // no book/header content of its own, so those filters are no-ops. \id is
      // only present when the range starts at chapter 1 (Paratext stores it
      // only in chapter 1's USJ; we don't synthesise one). Issue #15.
      const filteredChapters = chaptersUSJ.map((chapter, idx) => {
        const isFirstChapter = idx === 0;
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
        updateStep('export', 'done');
        updateStep('verify', 'active');

        // Persist user's working choices for this PT project. WS is keyed by
        // (PT, FLEx) pair via wsPersistenceKey, so it lands in the slot for
        // the FLEx project we just exported to. Filters are per PT project.
        try {
          if (selectedFlexProject) {
            setSavedFlexProjectName(selectedFlexProject.name);
          }
          if (selectedWritingSystem) {
            setSavedWritingSystemCode(selectedWritingSystem.code);
          }
          setSavedIncludeFootnotes(includeFootnotes);
          setSavedIncludeCrossRefs(includeCrossRefs);
          setSavedIncludeIntro(includeIntro);
          setSavedIncludeRemarks(includeRemarks);
          setSavedIncludeFigures(includeFigures);
          setSavedIncludeBookHeaders(includeBookHeaders);
        } catch (saveErr) {
          console.warn('[Persistence] Failed to save settings on export success:', saveErr);
        }

        const exportedCount = result.paragraphCount || 0;
        const isSingular = exportedCount === 1;
        const messageTemplate = isSingular
          ? localizedStrings["%flexExport_exportSuccessSingular%"]
            || "Successfully exported {paragraphCount} paragraph to \"{textName}\""
          : localizedStrings["%flexExport_exportSuccess%"]
            || "Successfully exported {paragraphCount} paragraphs to \"{textName}\"";
        const successMessage = messageTemplate
          .replace("{paragraphCount}", String(exportedCount))
          .replace("{textName}", result.textName || nameToUse);
        setExportStatus({ variant: "success", message: successMessage });
        setExportCount(prev => prev + 1);

        if (result.textGuid) {
          // Verify text is accessible (confirms export fully committed)
          if (flexStatus.isRunning && flexStatus.sharingEnabled) {
            console.log('Verifying text is accessible...');
            const maxRetries = 5;
            let textVerified = false;

            for (let i = 0; i < maxRetries; i++) {
              try {
                const verifyResult = await papi.commands.sendCommand(
                  'flexExport.verifyText',
                  selectedFlexProject.name,
                  result.textGuid
                ) as { success: boolean; isAccessible: boolean; paragraphCount: number };

                if (verifyResult.success && verifyResult.isAccessible) {
                  console.log(`Text verified on attempt ${i + 1}: ${verifyResult.paragraphCount} paragraphs`);
                  textVerified = true;
                  break;
                }
              } catch (verifyErr) {
                console.log(`Verification attempt ${i + 1} failed:`, verifyErr);
              }

              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 500));
            }

            updateStep('verify', textVerified ? 'done' : 'warning');
            if (!textVerified) {
              // Export wrote successfully but FLEx hasn't surfaced the new
              // text yet. Override the green success status with an actionable
              // warning so the user knows to refresh FLEx.
              setExportStatus({
                variant: "warning",
                message: (localizedStrings["%flexExport_verifyTimeout%"] || "")
                  .replace("{textName}", result.textName || nameToUse),
              });
            }
          } else {
            updateStep('verify', 'done');
          }
        } else {
          updateStep('verify', 'done');
        }

        updateStep('complete', 'done');
      } else {
        updateStep('export', 'error');

        // Check if it's a TEXT_EXISTS error and overwrite is disabled
        if (result.errorCode === "TEXT_EXISTS" && !overwriteEnabled) {
          // Use the suggested name from the bridge (it already checked what exists)
          const suggested = result.suggestedName || generateUniqueName(textName);
          setSuggestedName(suggested);
          setShowRenameConfirm(true);
        } else if (result.errorCode === "PROJECT_LOCKED") {
          // Special handling for locked project error
          setExportStatus({
            variant: "error",
            message: (localizedStrings["%flexExport_projectLocked%"] || "")
              .replace("{projectName}", selectedFlexProject.name),
          });
        } else {
          const errorMessage = (localizedStrings["%flexExport_exportFailed%"] || "Export failed: {error}")
            .replace("{error}", result.error || "Unknown error");
          setExportStatus({ variant: "error", message: errorMessage });
        }
      }
    } catch (err) {
      console.error('Export error:', err);
      updateStep('export', 'error');

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
      setExportStatus({ variant: "error", message: errorMessage });
    } finally {
      setIsExporting(false);
      // Clear progress steps after a delay so user can see final state
      setTimeout(() => setExportSteps([]), 5000);
    }
  }, [
    selectedFlexProject,
    textName,
    chaptersUSJ,
    overwriteEnabled,
    showOverwriteConfirm,
    selectedWritingSystem,
    scrRef.chapterNum,
    scrRef.book,
    filterUsjContent,
    localizedStrings,
    generateUniqueName,
    updateStep,
    includeFootnotes,
    includeCrossRefs,
    includeIntro,
    includeRemarks,
    includeFigures,
    includeBookHeaders,
    setSavedFlexProjectName,
    setSavedWritingSystemCode,
    setSavedIncludeFootnotes,
    setSavedIncludeCrossRefs,
    setSavedIncludeIntro,
    setSavedIncludeRemarks,
    setSavedIncludeFigures,
    setSavedIncludeBookHeaders,
  ]);

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

  // Format USJ as JSON for debug view (with filtering applied)
  const usjJson = useMemo(() => {
    if (!chaptersUSJ.length) return "";

    // Mirror the export pipeline so the preview shows what the bridge will see.
    // \id is only present when the export starts at chapter 1; we don't
    // synthesise one for later starting chapters. Issue #15.
    const filteredChapters = chaptersUSJ.map((chapter, idx) => {
      const isFirstChapter = idx === 0;
      if (chapter.content) {
        return {
          ...chapter,
          content: filterUsjContent(chapter.content as (UsjNode | string)[], isFirstChapter),
        };
      }
      return chapter;
    });

    return JSON.stringify(filteredChapters, null, 2);
  }, [chaptersUSJ, filterUsjContent]);

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

  // Resolve a single set of props for the unified StatusStrip from the
  // multiple state sources that previously each rendered their own block.
  // Priority: terminal export result > in-progress export > FLEx load gate.
  const statusStripProps = useMemo<StatusStripProps>(() => {
    if (exportStatus) {
      return {
        variant: exportStatus.variant,
        message: exportStatus.message,
        steps: exportSteps.length > 0 ? exportSteps : undefined,
      };
    }
    if (isExporting && exportSteps.length > 0) {
      return {
        variant: "progress",
        message: localizedStrings["%flexExport_exporting%"],
        steps: exportSteps,
      };
    }
    if (flexLoadError) {
      const message = flexLoadError === "no_projects"
        ? localizedStrings["%flexExport_flexNotFound%"]
        : (localizedStrings["%flexExport_flexLoadError%"] || "").replace("{error}", flexLoadError);
      return { variant: "error", message };
    }
    // Soft-failure surfaces, ordered upstream-first: fix the higher-level
    // problem first and the downstream warnings clear themselves.
    if (flexDetailsError) {
      return {
        variant: "warning",
        message: (localizedStrings["%flexExport_flexDetailsError%"] || "")
          .replace("{name}", flexDetailsError),
      };
    }
    if (paratextProjectsError) {
      return {
        variant: "warning",
        message: (localizedStrings["%flexExport_paratextProjectsError%"] || "")
          .replace("{error}", paratextProjectsError),
      };
    }
    if (booksError) {
      return {
        variant: "warning",
        message: (localizedStrings["%flexExport_booksError%"] || "")
          .replace("{projectName}", booksError),
      };
    }
    if (chaptersError) {
      return {
        variant: "warning",
        message: (localizedStrings["%flexExport_chaptersError%"] || "")
          .replace("{book}", chaptersError.book)
          .replace("{chapter}", String(chaptersError.chapter)),
      };
    }
    if (notExportableReason === "resource") {
      return {
        variant: "info",
        message: localizedStrings["%flexExport_resourceNotExportable%"],
      };
    }
    // Help message when FLEx project is not selected
    if (!selectedFlexProject) {
      return {
        variant: "info",
        message: "Please select a Fieldworks Project and then click Export to FLEx.",
      };
    }
    return {};
  }, [
    exportStatus,
    isExporting,
    exportSteps,
    flexLoadError,
    flexDetailsError,
    paratextProjectsError,
    booksError,
    chaptersError,
    notExportableReason,
    selectedFlexProject,
    localizedStrings,
  ]);

  return (
    <div id="flex-export-container" className="tw-p-4 tw-min-h-screen tw-bg-background tw-text-foreground tw-font-sans" dir={isUiRtl ? "rtl" : "ltr"}>
      {/* Local override for ComboBox dropdown items in platform-bible-react:
          - Pin the leading check icon to its intrinsic size (upstream Check
            in combo-box.component.tsx is missing tw-shrink-0).
          - Top-align icon and label so the icon doesn't drift to the vertical
            middle when a long option label wraps (upstream CommandItem in
            command.tsx uses tw-items-center).
          Remove once both upstream fixes land. */}
      <style>{`
        [cmdk-item] { align-items: flex-start !important; }
        [cmdk-item] > svg { flex: none !important; }
      `}</style>
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
              <div id="paratext-project-row" className="tw-flex tw-items-center tw-gap-2">
                <Label id="paratext-project-label" htmlFor="paratext-project-selector" className="tw-text-sm tw-text-foreground tw-whitespace-nowrap tw-me-2">
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
                  <ChapterOnlyBookControl
                    scrRef={scrRef}
                    handleSubmit={handleStartRefChange}
                    getActiveBookIds={availableBookIds.length > 0 ? getActiveBookIds : undefined}
                    className="tw-h-9 tw-px-3"
                  />
                  <Label id="end-chapter-label" htmlFor="end-chapter-selector" className="tw-text-sm tw-text-foreground tw-mx-2">{localizedStrings["%flexExport_toChapter%"]}</Label>
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
              <Label id="include-book-headers-row" className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  id="include-book-headers-checkbox"
                  checked={includeBookHeaders}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeBookHeaders(checked === true)}
                  disabled={scrRef.chapterNum !== 1}
                />
                <span
                  id="include-book-headers-label"
                  className={`tw-text-sm tw-ms-2 ${scrRef.chapterNum !== 1 ? "tw-text-muted-foreground" : "tw-text-foreground"}`}
                >
                  {localizedStrings["%flexExport_bookHeaders%"]}
                </span>
              </Label>
              <Label id="include-intro-row" className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  id="include-intro-checkbox"
                  checked={includeIntro}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeIntro(checked === true)}
                  disabled={scrRef.chapterNum !== 1}
                />
                <span id="include-intro-label" className={`tw-text-sm tw-ms-2 ${scrRef.chapterNum !== 1 ? "tw-text-muted-foreground" : "tw-text-foreground"}`}>
                  {localizedStrings["%flexExport_introduction%"]}
                </span>
              </Label>
              <Label id="include-figures-row" className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  id="include-figures-checkbox"
                  checked={includeFigures}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeFigures(checked === true)}
                />
                <span id="include-figures-label" className="tw-text-sm tw-ms-2 tw-text-foreground">{localizedStrings["%flexExport_figures%"]}</span>
              </Label>
              <Label id="include-crossrefs-row" className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  id="include-crossrefs-checkbox"
                  checked={includeCrossRefs}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeCrossRefs(checked === true)}
                />
                <span id="include-crossrefs-label" className="tw-text-sm tw-ms-2 tw-text-foreground">{localizedStrings["%flexExport_crossReferences%"]}</span>
              </Label>
              <Label id="include-remarks-row" className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  id="include-remarks-checkbox"
                  checked={includeRemarks}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeRemarks(checked === true)}
                />
                <span id="include-remarks-label" className="tw-text-sm tw-ms-2 tw-text-foreground">{localizedStrings["%flexExport_remarks%"]}</span>
              </Label>
              <Label id="include-footnotes-row" className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                <Checkbox
                  id="include-footnotes-checkbox"
                  checked={includeFootnotes}
                  onCheckedChange={(checked: boolean | "indeterminate") => setIncludeFootnotes(checked === true)}
                />
                <span id="include-footnotes-label" className="tw-text-sm tw-ms-2 tw-text-foreground">{localizedStrings["%flexExport_footnotes%"]}</span>
              </Label>
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
              {/* FLEx Project Selector */}
              <div id="flex-project-row" className="tw-flex tw-items-center tw-gap-2">
                <Label id="flex-project-label" htmlFor="flex-project-selector" className="tw-text-sm tw-text-foreground tw-whitespace-nowrap tw-me-2">
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

              {/* Writing System Selector - only shown when multiple vernacular WS exist */}
              {flexProjectDetails && writingSystemOptions.length > 1 && (
                <div id="writing-system-row" className="tw-flex tw-items-center tw-gap-2">
                  <Label id="writing-system-label" htmlFor="writing-system-selector" className="tw-text-sm tw-text-foreground tw-whitespace-nowrap tw-me-2">
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
                <div id="text-name-row" className="tw-flex tw-items-center tw-gap-2">
                  <Label id="text-name-label" htmlFor="text-name-input" className="tw-text-sm tw-text-foreground tw-whitespace-nowrap tw-me-2">
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
              <div id="overwrite-row" className="tw-flex tw-items-center tw-gap-2">
                <Switch
                  id="overwrite-toggle"
                  checked={overwriteEnabled}
                  onCheckedChange={setOverwriteEnabled}
                />
                <Label htmlFor="overwrite-toggle" className="tw-text-sm tw-text-foreground tw-cursor-pointer tw-ms-2">
                  {localizedStrings["%flexExport_overwrite%"]}
                </Label>
              </div>

              {/* Export action and status feedback now live in the unified
                  StatusStrip rendered above the Scripture Preview. */}

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

        {/* Unified status + primary action. Always rendered (with reserved
            min-height) so showing/clearing a message never causes layout
            shift, and the long-message wrap problem inside the FLEx Settings
            box is gone. The Export button is anchored at the right end. */}
        <StatusStrip
          {...statusStripProps}
          trailing={
            <Button
              id="export-button"
              onClick={() => handleExport()}
              disabled={!selectedFlexProject || !textName || !chaptersUSJ.length || isExporting}
            >
              {isExporting
                ? localizedStrings["%flexExport_exporting%"]
                : localizedStrings["%flexExport_export%"]}
            </Button>
          }
        />

        {/* Scripture Preview */}
        <div id="scripture-preview-box" className="tw-mt-3 tw-border tw-border-border tw-rounded-md tw-bg-card">
          <div id="scripture-preview-header" className="tw-p-2.5 tw-ps-4 tw-border-b tw-border-border tw-bg-muted tw-flex tw-justify-between tw-items-center tw-flex-wrap tw-gap-2">
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
          <div id="scripture-preview-content" className="tw-p-3 tw-min-h-64 tw-max-h-96 tw-overflow-auto">
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
        <div id="loading-status" className="tw-mt-2 tw-text-xs tw-text-muted-foreground">
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

        {/* FLExTrans attribution */}
        <div id="flextrans-attribution" className="tw-mt-4 tw-text-center tw-text-xs tw-text-muted-foreground">
          Brought to you by the FLExTrans team, SIL Global
        </div>
      </div>
    </div>
  );
};
