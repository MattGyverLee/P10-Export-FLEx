using System;
using System.IO;
using FlexTextBridge.Models;
using FlexTextBridge.Services;
using Newtonsoft.Json;
using SIL.LCModel;

namespace FlexTextBridge.Commands
{
    /// <summary>
    /// Command to create a FLEx text from USJ input.
    /// </summary>
    public class CreateTextCommand
    {
        private readonly string _projectName;
        private readonly string _textTitle;
        private readonly bool _overwrite;
        private readonly string _vernacularWs;

        public CreateTextCommand(string projectName, string textTitle, bool overwrite = false, string vernacularWs = null)
        {
            _projectName = projectName ?? throw new ArgumentNullException(nameof(projectName));
            _textTitle = textTitle ?? throw new ArgumentNullException(nameof(textTitle));
            _overwrite = overwrite;
            _vernacularWs = vernacularWs;
        }

        /// <summary>
        /// Execute the create-text command, reading USJ from stdin.
        /// </summary>
        /// <returns>Exit code (0 = success)</returns>
        public int Execute()
        {
            FlexProjectService projectService = null;

            try
            {
                // Read USJ from stdin
                string usjJson;
                using (var reader = new StreamReader(Console.OpenStandardInput()))
                {
                    usjJson = reader.ReadToEnd();
                }

                if (string.IsNullOrWhiteSpace(usjJson))
                {
                    return OutputError("No USJ input provided", ErrorCodes.InvalidUsj);
                }

                // Parse USJ
                var converter = new UsjToUsfmConverter();
                var usjDocs = converter.ParseUsjArray(usjJson);

                if (usjDocs == null || usjDocs.Count == 0)
                {
                    return OutputError("Failed to parse USJ input", ErrorCodes.InvalidUsj);
                }

                // Convert to tagged paragraphs
                var paragraphs = converter.ConvertToTaggedParagraphs(usjDocs);

                // Open FLEx project
                projectService = new FlexProjectService();

                LcmCache cache;
                try
                {
                    cache = projectService.OpenProject(_projectName);
                }
                catch (FileNotFoundException)
                {
                    return OutputError($"Project '{_projectName}' not found", ErrorCodes.ProjectNotFound);
                }
                catch (LcmFileLockedException)
                {
                    return OutputError($"Project '{_projectName}' is locked (in use by another application)", ErrorCodes.ProjectLocked);
                }
                catch (LcmDataMigrationForbiddenException)
                {
                    return OutputError($"Project '{_projectName}' needs migration - please open it in FLEx first", ErrorCodes.ProjectNeedsMigration);
                }

                // Create text service with optional custom vernacular WS
                var textService = new TextCreationService(cache, _vernacularWs);

                // Check if text exists
                if (textService.TextExists(_textTitle) && !_overwrite)
                {
                    // Find next available name
                    var suggestedName = textService.FindNextAvailableName(_textTitle);
                    return OutputError(
                        $"Text '{_textTitle}' already exists. Use --overwrite to replace.",
                        ErrorCodes.TextExists,
                        new { suggestedName });
                }

                int paragraphCount;
                Guid textGuid;
                string usedVernacularWs;
                try
                {
                    (paragraphCount, textGuid) = textService.CreateText(_textTitle, paragraphs, _overwrite, out usedVernacularWs);

                    // Save changes to disk - this is critical!
                    projectService.Save();
                }
                catch (Exception ex)
                {
                    return OutputError($"Failed to create text: {ex.Message}", ErrorCodes.WriteFailed);
                }

                // Success
                var result = new CreateTextResult
                {
                    Success = true,
                    TextName = _textTitle,
                    TextGuid = textGuid.ToString(),
                    ParagraphCount = paragraphCount,
                    ProjectPath = Path.Combine(projectService.GetProjectsDirectory(), _projectName),
                    VernacularWs = usedVernacularWs
                };

                Console.WriteLine(JsonConvert.SerializeObject(result, Formatting.Indented));
                return 0;
            }
            catch (JsonException ex)
            {
                return OutputError($"Invalid USJ JSON: {ex.Message}", ErrorCodes.InvalidUsj);
            }
            catch (Exception ex)
            {
                return OutputError($"Unexpected error: {ex.Message}", ErrorCodes.UnknownError);
            }
            finally
            {
                projectService?.Dispose();
            }
        }

        private int OutputError(string message, string errorCode, object additionalData = null)
        {
            var result = new CreateTextResult
            {
                Success = false,
                Error = message,
                ErrorCode = errorCode
            };

            // Add additional data if provided (e.g., suggestedName)
            if (additionalData != null)
            {
                var suggestedNameProp = additionalData.GetType().GetProperty("suggestedName");
                if (suggestedNameProp != null)
                {
                    result.SuggestedName = suggestedNameProp.GetValue(additionalData) as string;
                }
            }

            Console.Error.WriteLine(JsonConvert.SerializeObject(result, Formatting.Indented));
            return 1;
        }
    }
}
