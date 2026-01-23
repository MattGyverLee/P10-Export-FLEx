using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Threading;
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
        /// Discover all FLEx projects on the system.
        /// </summary>
        public List<Models.ProjectInfo> DiscoverProjects()
        {
            Initialize();

            var projects = new List<Models.ProjectInfo>();
            var projectsDir = GetProjectsDirectory();

            if (!Directory.Exists(projectsDir))
            {
                return projects;
            }

            foreach (var dir in Directory.GetDirectories(projectsDir))
            {
                var projectName = Path.GetFileName(dir);
                var fwdataFile = Path.Combine(dir, projectName + ".fwdata");

                if (!File.Exists(fwdataFile))
                    continue;

                var projectInfo = new Models.ProjectInfo
                {
                    Name = projectName,
                    Path = dir
                };

                // Try to get writing system info from project files
                try
                {
                    var wsInfo = GetWritingSystemInfo(fwdataFile);
                    projectInfo.VernacularWs = wsInfo.vernacular;
                    projectInfo.AnalysisWs = wsInfo.analysis;
                }
                catch
                {
                    // If we can't read WS info, still include the project
                    projectInfo.VernacularWs = "unknown";
                    projectInfo.AnalysisWs = "unknown";
                }

                projects.Add(projectInfo);
            }

            return projects.OrderBy(p => p.Name).ToList();
        }

        /// <summary>
        /// Get writing system codes by reading project files directly (without opening LCM).
        /// </summary>
        private (string vernacular, string analysis) GetWritingSystemInfo(string fwdataPath)
        {
            var projectDir = Path.GetDirectoryName(fwdataPath);
            var wsDir = Path.Combine(projectDir, "WritingSystemStore");

            string vernacular = "unknown";
            string analysis = "unknown";

            try
            {
                // Try to read from WritingSystemStore directory
                if (Directory.Exists(wsDir))
                {
                    var wsFiles = Directory.GetFiles(wsDir, "*.ldml")
                        .Select(f => Path.GetFileNameWithoutExtension(f))
                        .OrderBy(f => f)
                        .ToList();

                    // Common pattern: analysis is English, vernacular is non-English
                    var englishWs = wsFiles.FirstOrDefault(w => w.StartsWith("en"));
                    var nonEnglishWs = wsFiles.FirstOrDefault(w => !w.StartsWith("en"));

                    if (englishWs != null)
                        analysis = englishWs;
                    if (nonEnglishWs != null)
                        vernacular = nonEnglishWs;
                    else if (wsFiles.Count > 0)
                        vernacular = wsFiles[0];
                }
            }
            catch
            {
                // Ignore errors reading WS info
            }

            return (vernacular, analysis);
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
        /// Get detailed project information including all writing systems.
        /// Opens the project temporarily to read the writing system info.
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

            var projectInfo = new Models.ProjectInfo
            {
                Name = projectName,
                Path = projectDir,
                VernacularWritingSystems = new List<Models.WritingSystemInfo>(),
                AnalysisWritingSystems = new List<Models.WritingSystemInfo>()
            };

            // Open the project to get writing system info
            var cache = OpenProject(projectName);
            try
            {
                // Get default writing systems
                var defaultVernWs = cache.DefaultVernWs;
                var defaultAnalWs = cache.DefaultAnalWs;

                // Get all vernacular writing systems
                foreach (var ws in cache.ServiceLocator.WritingSystems.CurrentVernacularWritingSystems)
                {
                    var wsHandle = cache.ServiceLocator.WritingSystemManager.Get(ws.Id);
                    var isDefault = wsHandle?.Handle == defaultVernWs;

                    projectInfo.VernacularWritingSystems.Add(new Models.WritingSystemInfo
                    {
                        Code = ws.Id,
                        Name = ws.DisplayLabel ?? ws.Id,
                        IsDefault = isDefault
                    });

                    // Set the default vernacular WS code
                    if (isDefault)
                    {
                        projectInfo.VernacularWs = ws.Id;
                    }
                }

                // Get all analysis writing systems
                foreach (var ws in cache.ServiceLocator.WritingSystems.CurrentAnalysisWritingSystems)
                {
                    var wsHandle = cache.ServiceLocator.WritingSystemManager.Get(ws.Id);
                    var isDefault = wsHandle?.Handle == defaultAnalWs;

                    projectInfo.AnalysisWritingSystems.Add(new Models.WritingSystemInfo
                    {
                        Code = ws.Id,
                        Name = ws.DisplayLabel ?? ws.Id,
                        IsDefault = isDefault
                    });

                    // Set the default analysis WS code
                    if (isDefault)
                    {
                        projectInfo.AnalysisWs = ws.Id;
                    }
                }

                // Fallback if no default was found
                if (string.IsNullOrEmpty(projectInfo.VernacularWs) && projectInfo.VernacularWritingSystems.Count > 0)
                {
                    projectInfo.VernacularWs = projectInfo.VernacularWritingSystems[0].Code;
                    projectInfo.VernacularWritingSystems[0].IsDefault = true;
                }
                if (string.IsNullOrEmpty(projectInfo.AnalysisWs) && projectInfo.AnalysisWritingSystems.Count > 0)
                {
                    projectInfo.AnalysisWs = projectInfo.AnalysisWritingSystems[0].Code;
                    projectInfo.AnalysisWritingSystems[0].IsDefault = true;
                }
            }
            finally
            {
                // Close the project (don't dispose - caller may want to use it)
                _cache?.Dispose();
                _cache = null;
            }

            return projectInfo;
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
