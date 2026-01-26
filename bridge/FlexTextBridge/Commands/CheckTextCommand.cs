using System;
using System.IO;
using Newtonsoft.Json;
using FlexTextBridge.Models;
using FlexTextBridge.Services;
using SIL.LCModel;

namespace FlexTextBridge.Commands
{
    /// <summary>
    /// Command to check if a text name exists and get suggested alternative.
    /// </summary>
    public class CheckTextCommand
    {
        private readonly string _projectName;
        private readonly string _textTitle;

        public CheckTextCommand(string projectName, string textTitle)
        {
            _projectName = projectName ?? throw new ArgumentNullException(nameof(projectName));
            _textTitle = textTitle ?? throw new ArgumentNullException(nameof(textTitle));
        }

        public int Execute()
        {
            FlexProjectService projectService = null;

            try
            {
                projectService = new FlexProjectService();
                LcmCache cache = null;

                try
                {
                    // Open the project (read-only check)
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

                using (cache)
                {
                    var textService = new TextCreationService(cache);

                    // Check if text exists
                    bool exists = textService.TextExists(_textTitle);

                    string suggestedName = null;
                    if (exists)
                    {
                        suggestedName = textService.FindNextAvailableName(_textTitle);
                    }

                    // Success
                    var result = new CheckTextResult
                    {
                        Success = true,
                        Exists = exists,
                        SuggestedName = suggestedName
                    };

                    Console.WriteLine(JsonConvert.SerializeObject(result, Formatting.Indented));
                    return 0;
                }
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

        private int OutputError(string message, string errorCode)
        {
            var result = new CheckTextResult
            {
                Success = false,
                Error = message,
                ErrorCode = errorCode
            };

            Console.Error.WriteLine(JsonConvert.SerializeObject(result, Formatting.Indented));
            return 1;
        }
    }
}
