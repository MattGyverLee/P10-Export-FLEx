using System;
using System.IO;
using Newtonsoft.Json;
using FlexTextBridge.Models;
using FlexTextBridge.Services;
using SIL.LCModel;

namespace FlexTextBridge.Commands
{
    /// <summary>
    /// Command to verify that a text exists and is accessible by its GUID.
    /// This is used to ensure a newly created/overwritten text is ready before navigation.
    /// </summary>
    public class VerifyTextCommand
    {
        private readonly string _projectName;
        private readonly string _textGuid;

        public VerifyTextCommand(string projectName, string textGuid)
        {
            _projectName = projectName ?? throw new ArgumentNullException(nameof(projectName));
            _textGuid = textGuid ?? throw new ArgumentNullException(nameof(textGuid));
        }

        public int Execute()
        {
            FlexProjectService projectService = null;

            try
            {
                // Parse the GUID
                if (!Guid.TryParse(_textGuid, out var guid))
                {
                    return OutputError($"Invalid GUID format: '{_textGuid}'", ErrorCodes.TextNotFound);
                }

                projectService = new FlexProjectService();
                LcmCache cache = null;

                try
                {
                    // Open the project (fresh cache to get latest state)
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

                    // Get verification info
                    var info = textService.GetTextVerificationInfo(guid);

                    if (info == null)
                    {
                        return OutputError($"Text with GUID '{_textGuid}' not found", ErrorCodes.TextNotFound);
                    }

                    if (!info.IsAccessible)
                    {
                        return OutputError($"Text exists but is not accessible: {info.Error}", ErrorCodes.TextNotAccessible);
                    }

                    // Success - text is verified and accessible
                    var result = new VerifyTextResult
                    {
                        Success = true,
                        Guid = _textGuid,
                        TextName = info.Name,
                        IsAccessible = true,
                        HasContent = info.HasContent,
                        ParagraphCount = info.ParagraphCount
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
            var result = new VerifyTextResult
            {
                Success = false,
                Error = message,
                ErrorCode = errorCode,
                Guid = _textGuid,
                IsAccessible = false
            };

            Console.Error.WriteLine(JsonConvert.SerializeObject(result, Formatting.Indented));
            return 1;
        }
    }
}
