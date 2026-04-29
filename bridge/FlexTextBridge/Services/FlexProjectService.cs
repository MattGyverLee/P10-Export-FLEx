using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Xml;
using Microsoft.Win32;
using SIL.LCModel;
using SIL.LCModel.Core.Text;
using SIL.LCModel.Infrastructure;
using SIL.LCModel.Utils;
using SIL.WritingSystems;

namespace FlexTextBridge.Services
{
    /// <summary>
    /// Service for discovering and opening FLEx projects.
    /// </summary>
    public class FlexProjectService : IDisposable
    {
        private LcmCache _cache;
        private bool _initialized;

        /// <summary>
        /// Initialize the FLEx/LCM libraries. Must be called before any other operations.
        /// </summary>
        public void Initialize()
        {
            if (_initialized) return;

            // Initialize ICU for Unicode support
            CustomIcu.InitIcuDataDir();

            // Initialize SLDR (writing systems) in offline mode
            if (!Sldr.IsInitialized)
            {
                Sldr.Initialize(true); // offline mode
            }

            _initialized = true;
        }

        /// <summary>
        /// Get the FieldWorks installation directory from the registry.
        /// </summary>
        public string GetFieldWorksDirectory()
        {
            string fwDir = null;

            // Try registry (HKLM\SOFTWARE\SIL\FieldWorks\9)
            try
            {
                using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\SIL\FieldWorks\9"))
                {
                    fwDir = key?.GetValue("RootCodeDir") as string;
                }
            }
            catch
            {
                // Ignore registry errors
            }

            // Fallback to common locations
            if (string.IsNullOrEmpty(fwDir) || !Directory.Exists(fwDir))
            {
                var commonPaths = new[]
                {
                    @"C:\Program Files\SIL\FieldWorks 9",
                    @"C:\Program Files (x86)\SIL\FieldWorks 9",
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "SIL", "FieldWorks 9")
                };

                fwDir = commonPaths.FirstOrDefault(Directory.Exists);
            }

            return fwDir;
        }

        /// <summary>
        /// Get the FieldWorks projects directory from the registry or default location.
        /// </summary>
        public string GetProjectsDirectory()
        {
            string projectsDir = null;

            // Try registry first (HKLM\SOFTWARE\SIL\FieldWorks\9)
            try
            {
                using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\SIL\FieldWorks\9"))
                {
                    projectsDir = key?.GetValue("ProjectsDir") as string;
                }
            }
            catch
            {
                // Ignore registry errors
            }

            // Fallback to default location
            if (string.IsNullOrEmpty(projectsDir) || !Directory.Exists(projectsDir))
            {
                projectsDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                    "SIL", "FieldWorks", "Projects");
            }

            return projectsDir;
        }

        /// <summary>
        /// Discover all FLEx projects on the system, with full writing system metadata.
        /// Reads metadata directly from on-disk project files (.fwdata XML) without
        /// opening an LCM cache, so this never acquires lock files, never triggers
        /// data migration, and never bumps project mtimes. See issues #11 and #13.
        /// </summary>
        public List<Models.ProjectInfo> DiscoverProjects()
        {
            Initialize();

            var projectsDir = GetProjectsDirectory();
            if (!Directory.Exists(projectsDir))
            {
                return new List<Models.ProjectInfo>();
            }

            var candidates = new List<string>();
            foreach (var dir in Directory.GetDirectories(projectsDir))
            {
                var projectName = Path.GetFileName(dir);
                var fwdataFile = Path.Combine(dir, projectName + ".fwdata");
                if (File.Exists(fwdataFile))
                    candidates.Add(dir);
            }

            // Parse each project's .fwdata in parallel — each parse is independent
            // and disk-bound, so a small thread pool keeps wall time down without
            // thrashing the disk on spinning media.
            var results = new ConcurrentBag<Models.ProjectInfo>();
            var parallelism = Math.Min(8, Math.Max(1, Environment.ProcessorCount));
            Parallel.ForEach(
                candidates,
                new ParallelOptions { MaxDegreeOfParallelism = parallelism },
                dir =>
                {
                    var projectName = Path.GetFileName(dir);
                    results.Add(ReadProjectMetadataFromFiles(dir, projectName));
                });

            return results.OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase).ToList();
        }

        /// <summary>
        /// Read project metadata (active vernacular and analysis writing systems)
        /// directly from the .fwdata XML, bypassing LCM. The first code listed in
        /// CurVernWss / CurAnalysisWss is treated as the project default.
        /// On any parse failure, returns a ProjectInfo with empty WS lists rather
        /// than throwing — the chooser then shows the project name with no WS
        /// options, which is a sane degraded state.
        /// </summary>
        private static Models.ProjectInfo ReadProjectMetadataFromFiles(string projectDir, string projectName)
        {
            var info = new Models.ProjectInfo
            {
                Name = projectName,
                Path = projectDir,
                VernacularWritingSystems = new List<Models.WritingSystemInfo>(),
                AnalysisWritingSystems = new List<Models.WritingSystemInfo>(),
            };

            var fwdataPath = Path.Combine(projectDir, projectName + ".fwdata");
            try
            {
                var (vernRaw, analysisRaw) = ReadCurrentWritingSystemsFromFwdata(fwdataPath);
                info.VernacularWritingSystems = ParseWsList(vernRaw);
                info.AnalysisWritingSystems = ParseWsList(analysisRaw);
                info.VernacularWs = info.VernacularWritingSystems.FirstOrDefault()?.Code;
                info.AnalysisWs = info.AnalysisWritingSystems.FirstOrDefault()?.Code;
            }
            catch
            {
                // Swallow per-project parse errors so one bad .fwdata doesn't hide
                // every other project from the chooser.
            }

            return info;
        }

        /// <summary>
        /// Stream the .fwdata XML looking for the LangProject rt element and pull
        /// the space-separated CurVernWss / CurAnalysisWss writing system codes
        /// out of its &lt;Uni&gt; children. Uses XmlReader so we don't load the
        /// whole multi-megabyte file into memory, and FileShare.ReadWrite so a
        /// concurrently-running FLEx instance never blocks the read.
        /// </summary>
        private static (string vernacular, string analysis) ReadCurrentWritingSystemsFromFwdata(string fwdataPath)
        {
            string curVernRaw = null;
            string curAnalysisRaw = null;

            var settings = new XmlReaderSettings
            {
                DtdProcessing = DtdProcessing.Ignore,
                IgnoreComments = true,
                IgnoreWhitespace = true,
                IgnoreProcessingInstructions = true,
                CloseInput = true,
            };

            using (var fileStream = new FileStream(
                fwdataPath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.ReadWrite | FileShare.Delete))
            using (var reader = XmlReader.Create(fileStream, settings))
            {
                while (reader.Read())
                {
                    if (reader.NodeType != XmlNodeType.Element || reader.Name != "rt")
                        continue;

                    if (reader.GetAttribute("class") != "LangProject")
                        continue;

                    // Walk children of the LangProject rt element.
                    using (var subtree = reader.ReadSubtree())
                    {
                        subtree.Read(); // position on <rt class="LangProject" ...>
                        while (subtree.Read())
                        {
                            if (subtree.NodeType != XmlNodeType.Element)
                                continue;

                            if (subtree.Name == "CurVernWss")
                                curVernRaw = ReadInnerUniText(subtree);
                            else if (subtree.Name == "CurAnalysisWss")
                                curAnalysisRaw = ReadInnerUniText(subtree);

                            if (curVernRaw != null && curAnalysisRaw != null)
                                break;
                        }
                    }
                    break; // LangProject processed; nothing more we need from the file
                }
            }

            return (curVernRaw, curAnalysisRaw);
        }

        /// <summary>
        /// Reader is positioned on a CurVernWss / CurAnalysisWss start element.
        /// Read forward to its &lt;Uni&gt; child and return the text content.
        /// </summary>
        private static string ReadInnerUniText(XmlReader reader)
        {
            using (var sub = reader.ReadSubtree())
            {
                while (sub.Read())
                {
                    if (sub.NodeType == XmlNodeType.Element && sub.Name == "Uni")
                        return sub.ReadElementContentAsString();
                }
            }
            return null;
        }

        /// <summary>
        /// Split a space-separated WS code list into WritingSystemInfo entries.
        /// The first entry is marked IsDefault — that matches LCM's
        /// CurrentVernacularWritingSystems / CurrentAnalysisWritingSystems ordering.
        /// </summary>
        private static List<Models.WritingSystemInfo> ParseWsList(string raw)
        {
            var result = new List<Models.WritingSystemInfo>();
            if (string.IsNullOrWhiteSpace(raw))
                return result;

            var codes = raw.Trim().Split(
                new[] { ' ', '\t', '\r', '\n' },
                StringSplitOptions.RemoveEmptyEntries);

            for (int i = 0; i < codes.Length; i++)
            {
                result.Add(new Models.WritingSystemInfo
                {
                    Code = codes[i],
                    Name = LookupWsDisplayName(codes[i]),
                    IsDefault = (i == 0),
                });
            }
            return result;
        }

        /// <summary>
        /// Best-effort friendly name for a writing system tag. .NET recognises
        /// well-formed BCP-47 tags and gives us a localised display name for
        /// known ones (e.g. "en" -> "English"). Unknown tags (private-use,
        /// custom variants like "arz-Qaaa-fonipa-x-Aima") fall back to the code.
        /// We can't replicate LCM's WritingSystem.DisplayLabel exactly without
        /// opening the project, but the code is recognisable enough for a picker.
        /// </summary>
        private static string LookupWsDisplayName(string code)
        {
            try
            {
                var culture = CultureInfo.GetCultureInfo(code);
                if (culture == null)
                    return code;
                var display = culture.DisplayName;
                if (string.IsNullOrEmpty(display))
                    return code;
                if (display.IndexOf("Unknown", StringComparison.OrdinalIgnoreCase) >= 0)
                    return code;
                if (display.Contains(code))
                    return display;
                return $"{display} ({code})";
            }
            catch
            {
                return code;
            }
        }

        /// <summary>
        /// Open a FLEx project for read/write operations.
        /// </summary>
        public LcmCache OpenProject(string projectName)
        {
            Initialize();

            var projectsDir = GetProjectsDirectory();
            var projectDir = Path.Combine(projectsDir, projectName);
            var fwdataPath = Path.Combine(projectDir, projectName + ".fwdata");

            if (!File.Exists(fwdataPath))
            {
                throw new FileNotFoundException($"Project '{projectName}' not found at {fwdataPath}");
            }

            // Create the project identifier
            var projectId = new FlexProjectIdentifier(fwdataPath);

            // Set up LCM directories
            var dirs = new FlexLcmDirectories(projectsDir);

            // Create progress handler (silent for CLI)
            var progress = new SilentProgressHandler();

            // Create UI handler (silent for CLI)
            var ui = new SilentLcmUIHandler();

            // LCM settings
            var settings = new LcmSettings { DisableDataMigration = false };

            // Open the cache
            _cache = LcmCache.CreateCacheFromExistingData(
                projectId,
                "en",
                ui,
                dirs,
                settings,
                progress);

            return _cache;
        }

        /// <summary>
        /// Get the currently open cache.
        /// </summary>
        public LcmCache Cache => _cache;

        /// <summary>
        /// Save all pending changes to the project.
        /// This must be called after making modifications to persist them to disk.
        /// </summary>
        public void Save()
        {
            if (_cache == null)
                throw new InvalidOperationException("No project is currently open");

            // Get the UndoStackManager and call Save to persist changes
            var undoStackManager = _cache.ServiceLocator.GetInstance<IUndoStackManager>();
            undoStackManager.Save();
        }

        /// <summary>
        /// Get detailed project information including all active writing systems.
        /// Reads metadata directly from the .fwdata XML — no LCM cache is opened,
        /// so this never acquires lock files, never triggers data migration,
        /// and never bumps the project's mtime. See issues #11 and #13.
        /// </summary>
        public Models.ProjectInfo GetProjectInfo(string projectName)
        {
            var projectsDir = GetProjectsDirectory();
            var projectDir = Path.Combine(projectsDir, projectName);
            var fwdataPath = Path.Combine(projectDir, projectName + ".fwdata");

            if (!File.Exists(fwdataPath))
            {
                throw new FileNotFoundException($"Project '{projectName}' not found at {fwdataPath}");
            }

            return ReadProjectMetadataFromFiles(projectDir, projectName);
        }

        public void Dispose()
        {
            _cache?.Dispose();
            _cache = null;

            if (Sldr.IsInitialized)
            {
                Sldr.Cleanup();
            }
        }
    }

    /// <summary>
    /// Project identifier for LcmCache.
    /// Implements IProjectIdentifier with properties that work across LibLCM versions.
    /// </summary>
    internal class FlexProjectIdentifier : IProjectIdentifier
    {
        private readonly string _path;
        private readonly string _projectFolder;
        private readonly string _name;

        public FlexProjectIdentifier(string path)
        {
            _path = path;
            _projectFolder = System.IO.Path.GetDirectoryName(path);
            _name = System.IO.Path.GetFileNameWithoutExtension(path);
        }

        // Core properties (always required)
        public string Name => _name;
        public string ProjectFolder => _projectFolder;
        public BackendProviderType Type => BackendProviderType.kXML;
        public string UiName => _name;

        // Path property - some versions have getter only, some have getter/setter
        public string Path
        {
            get => _path;
            set { /* Ignore sets - we're read-only */ }
        }

        // Handle/PipeHandle - may or may not exist in all versions
        public string Handle => _name;
        public string PipeHandle => _name;

        // SharedProjectFolder - for remote projects (not used in our case)
        public string SharedProjectFolder => null;
    }

    /// <summary>
    /// LCM directories configuration.
    /// </summary>
    internal class FlexLcmDirectories : ILcmDirectories
    {
        public FlexLcmDirectories(string projectsDir)
        {
            ProjectsDirectory = projectsDir;
            DefaultProjectsDirectory = projectsDir;
            TemplateDirectory = System.IO.Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "SIL", "FieldWorks", "Templates");
        }

        public string ProjectsDirectory { get; }
        public string TemplateDirectory { get; }
        public string DefaultProjectsDirectory { get; }
    }

    /// <summary>
    /// Silent progress handler for CLI operations.
    /// Compatible with IThreadedProgress interface across LibLCM versions.
    /// </summary>
    internal class SilentProgressHandler : IThreadedProgress
    {
        private readonly ISynchronizeInvoke _synchronizeInvoke;

        public SilentProgressHandler()
        {
            _synchronizeInvoke = new SingleThreadedSynchronizeInvoker();
        }

        // IProgress properties
        public event CancelEventHandler Canceling;
        public string Title { get; set; }
        public string Message { get; set; }
        public int Position { get; set; }
        public int StepSize { get; set; }
        public int Minimum { get; set; }
        public int Maximum { get; set; }
        public ISynchronizeInvoke SynchronizeInvoke => _synchronizeInvoke;
        public bool IsIndeterminate { get; set; }
        public bool AllowCancel { get; set; }

        // IThreadedProgress properties
        public bool Canceled => false;
        public bool IsCanceling => false;

        // IProgress methods
        public void Step(int amount) { }

        // IThreadedProgress methods
        public object RunTask(Func<IThreadedProgress, object[], object> backgroundTask, params object[] parameters)
        {
            return backgroundTask(this, parameters);
        }

        public object RunTask(bool fDisplayUi, Func<IThreadedProgress, object[], object> backgroundTask, params object[] parameters)
        {
            return backgroundTask(this, parameters);
        }
    }

    /// <summary>
    /// Silent LCM UI handler for CLI operations.
    /// Compatible with ILcmUI interface across LibLCM versions.
    /// </summary>
    internal class SilentLcmUIHandler : ILcmUI
    {
        private readonly ISynchronizeInvoke _synchronizeInvoke;

        public SilentLcmUIHandler()
        {
            _synchronizeInvoke = new SingleThreadedSynchronizeInvoker();
        }

        public ISynchronizeInvoke SynchronizeInvoke => _synchronizeInvoke;
        public DateTime LastActivityTime => DateTime.Now;

        // User interaction methods - return sensible defaults for CLI
        public bool ConflictingSave() => true;
        public bool ConnectionLost() => false;
        public FileSelection ChooseFilesToUse() => FileSelection.OkKeepNewer;
        public bool RestoreLinkedFilesInProjectFolder() => true;
        public YesNoCancel CannotRestoreLinkedFilesToOriginalLocation() => YesNoCancel.OkNo;

        // These methods may exist in newer versions
        public bool Retry(string msg, string caption) => false;
        public bool OfferToRestore(string projectPath, string backupPath) => false;

        // Display/reporting methods - no-ops for CLI
        public void DisplayMessage(MessageType type, string message, string caption, string helpTopic) { }
        public void ReportException(Exception error, bool isLethal) { }
        public void ReportDuplicateGuids(string errorText) { }
        public void DisplayCircularRefBreakerReport(string msg, string caption) { }
    }

    /// <summary>
    /// Single-threaded synchronization for CLI operations.
    /// Implements System.ComponentModel.ISynchronizeInvoke.
    /// </summary>
    internal class SingleThreadedSynchronizeInvoker : ISynchronizeInvoke
    {
        public bool InvokeRequired => false;

        public IAsyncResult BeginInvoke(Delegate method, object[] args)
        {
            var result = method.DynamicInvoke(args);
            return new CompletedAsyncResult(result);
        }

        public object EndInvoke(IAsyncResult result)
        {
            return ((CompletedAsyncResult)result).Result;
        }

        public object Invoke(Delegate method, object[] args)
        {
            return method.DynamicInvoke(args);
        }

        /// <summary>
        /// Simple IAsyncResult implementation for synchronous execution.
        /// </summary>
        private class CompletedAsyncResult : IAsyncResult
        {
            public CompletedAsyncResult(object result)
            {
                Result = result;
            }

            public object Result { get; }
            public bool IsCompleted => true;
            public WaitHandle AsyncWaitHandle => null;
            public object AsyncState => null;
            public bool CompletedSynchronously => true;
        }
    }
}
