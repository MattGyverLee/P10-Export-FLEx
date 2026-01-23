using System;
using System.Collections.Generic;
using System.Linq;
using SIL.LCModel;
using SIL.LCModel.Core.KernelInterfaces;
using SIL.LCModel.Core.Text;

namespace FlexTextBridge.Services
{
    /// <summary>
    /// Service for creating texts in FLEx projects using LibLCM.
    /// </summary>
    public class TextCreationService
    {
        private readonly LcmCache _cache;
        private readonly string _customVernacularWs;

        public TextCreationService(LcmCache cache, string customVernacularWs = null)
        {
            _cache = cache ?? throw new ArgumentNullException(nameof(cache));
            _customVernacularWs = customVernacularWs;
        }

        /// <summary>
        /// Get the vernacular writing system handle to use.
        /// Uses custom WS if specified, otherwise project default.
        /// </summary>
        private int GetVernacularWsHandle()
        {
            if (string.IsNullOrEmpty(_customVernacularWs))
            {
                return _cache.DefaultVernWs;
            }

            // Look up the custom writing system by code
            var ws = _cache.ServiceLocator.WritingSystemManager.Get(_customVernacularWs);
            if (ws != null)
            {
                return ws.Handle;
            }

            // Fall back to default if not found
            return _cache.DefaultVernWs;
        }

        /// <summary>
        /// Get the code of the vernacular writing system being used.
        /// </summary>
        public string GetVernacularWsCode()
        {
            if (!string.IsNullOrEmpty(_customVernacularWs))
            {
                var ws = _cache.ServiceLocator.WritingSystemManager.Get(_customVernacularWs);
                if (ws != null)
                {
                    return _customVernacularWs;
                }
            }

            // Get default vernacular WS code
            var defaultWs = _cache.ServiceLocator.WritingSystemManager.Get(_cache.DefaultVernWs);
            return defaultWs?.Id ?? "unknown";
        }

        /// <summary>
        /// Check if a text with the given name already exists.
        /// </summary>
        public bool TextExists(string textName)
        {
            var textRepo = _cache.ServiceLocator.GetInstance<ITextRepository>();
            return textRepo.AllInstances().Any(t =>
                t.Name.get_String(_cache.DefaultAnalWs)?.Text == textName);
        }

        /// <summary>
        /// Find a text by name.
        /// </summary>
        private IText FindText(string textName)
        {
            var textRepo = _cache.ServiceLocator.GetInstance<ITextRepository>();
            return textRepo.AllInstances().FirstOrDefault(t =>
                t.Name.get_String(_cache.DefaultAnalWs)?.Text == textName);
        }

        /// <summary>
        /// Create a new text in the FLEx project from tagged paragraphs.
        /// </summary>
        /// <param name="textName">Name/title for the text (in analysis WS)</param>
        /// <param name="paragraphs">List of paragraphs with tagged segments</param>
        /// <param name="overwrite">If true, delete existing text with same name</param>
        /// <param name="usedVernacularWs">Output: the vernacular WS code that was used</param>
        /// <returns>Number of paragraphs created</returns>
        public int CreateText(string textName, List<Paragraph> paragraphs, bool overwrite, out string usedVernacularWs)
        {
            if (string.IsNullOrEmpty(textName))
                throw new ArgumentException("Text name cannot be empty", nameof(textName));

            // Check for existing text
            if (TextExists(textName))
            {
                if (overwrite)
                {
                    DeleteText(textName);
                }
                else
                {
                    throw new InvalidOperationException($"Text '{textName}' already exists");
                }
            }

            // Get writing system handles
            int analWs = _cache.DefaultAnalWs;
            int vernWs = GetVernacularWsHandle();
            usedVernacularWs = GetVernacularWsCode();

            // Begin non-undoable task (required for modifications)
            using (var undoHelper = new UndoableUnitOfWorkHelper(_cache.ActionHandlerAccessor, "Create Text"))
            {
                // Get factories
                var textFactory = _cache.ServiceLocator.GetInstance<ITextFactory>();
                var stTextFactory = _cache.ServiceLocator.GetInstance<IStTextFactory>();
                var stTxtParaFactory = _cache.ServiceLocator.GetInstance<IStTxtParaFactory>();

                // Create the text object
                // In newer LibLCM versions, texts are automatically added to the project
                // when created via the factory (they're unowned now)
                var text = textFactory.Create();

                // Set text name (analysis WS)
                text.Name.set_String(analWs, TsStringUtils.MakeString(textName, analWs));

                // Create the StText container for content
                var stText = stTextFactory.Create();
                text.ContentsOA = stText;

                // Create paragraphs
                int paragraphCount = 0;
                foreach (var para in paragraphs)
                {
                    if (para.Segments.Count == 0) continue;

                    var stPara = stTxtParaFactory.Create();
                    stText.ParagraphsOS.Add(stPara);

                    // Build the paragraph content with mixed writing systems
                    var bldr = TsStringUtils.MakeStrBldr();

                    foreach (var segment in para.Segments)
                    {
                        if (string.IsNullOrEmpty(segment.Text)) continue;

                        int ws = segment.IsVernacular ? vernWs : analWs;
                        var segmentTss = TsStringUtils.MakeString(segment.Text, ws);

                        // Append to builder
                        bldr.ReplaceTsString(bldr.Length, bldr.Length, segmentTss);
                    }

                    stPara.Contents = bldr.GetString();
                    paragraphCount++;
                }

                // If no paragraphs, create at least one empty paragraph
                if (paragraphCount == 0)
                {
                    var emptyPara = stTxtParaFactory.Create();
                    stText.ParagraphsOS.Add(emptyPara);
                    emptyPara.Contents = TsStringUtils.EmptyString(vernWs);
                    paragraphCount = 1;
                }

                undoHelper.RollBack = false; // Commit the transaction
                return paragraphCount;
            }
        }

        /// <summary>
        /// Delete a text by name.
        /// </summary>
        public void DeleteText(string textName)
        {
            var text = FindText(textName);

            if (text != null)
            {
                using (var undoHelper = new UndoableUnitOfWorkHelper(_cache.ActionHandlerAccessor, "Delete Text"))
                {
                    // Delete the text - in newer LibLCM, just delete the object directly
                    text.Delete();
                    undoHelper.RollBack = false;
                }
            }
        }

        /// <summary>
        /// Get all text names in the project.
        /// </summary>
        public List<string> GetAllTextNames()
        {
            var textRepo = _cache.ServiceLocator.GetInstance<ITextRepository>();
            return textRepo.AllInstances()
                .Select(t => t.Name.get_String(_cache.DefaultAnalWs)?.Text ?? "(unnamed)")
                .OrderBy(n => n)
                .ToList();
        }
    }

    /// <summary>
    /// Helper class for managing undoable units of work in LCM.
    /// </summary>
    internal class UndoableUnitOfWorkHelper : IDisposable
    {
        private readonly IActionHandler _actionHandler;
        private bool _disposed;

        public bool RollBack { get; set; } = true;

        public UndoableUnitOfWorkHelper(IActionHandler actionHandler, string description)
        {
            _actionHandler = actionHandler;
            _actionHandler.BeginNonUndoableTask();
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;

            if (RollBack)
            {
                // Rollback not really possible for non-undoable tasks,
                // but we can at least end the task
            }

            _actionHandler.EndNonUndoableTask();
        }
    }
}
