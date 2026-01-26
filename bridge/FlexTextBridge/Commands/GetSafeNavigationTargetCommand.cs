using System;
using System.IO;
using Newtonsoft.Json;
using FlexTextBridge.Models;
using FlexTextBridge.Services;
using SIL.LCModel;

namespace FlexTextBridge.Commands
{
    /// <summary>
    /// Command to find a safe navigation target for FLEx redirect workflow.
    /// </summary>
    public class GetSafeNavigationTargetCommand
    {
        private readonly string _projectName;
        private readonly string _targetTextTitle;

        public GetSafeNavigationTargetCommand(string projectName, string targetTextTitle)
        {
            _projectName = projectName ?? throw new ArgumentNullException(nameof(projectName));
            _targetTextTitle = targetTextTitle ?? throw new ArgumentNullException(nameof(targetTextTitle));
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
                    var processService = new ProcessDetectionService();
                    var target = processService.FindSafeNavigationTarget(cache, _targetTextTitle);

                    var result = new NavigationTargetResult
                    {
                        Success = true,
                        Guid = target.textGuid?.ToString(),
                        Tool = target.tool
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
            var result = new NavigationTargetResult
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
