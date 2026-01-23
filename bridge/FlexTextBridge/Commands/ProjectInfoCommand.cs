using System;
using System.IO;
using FlexTextBridge.Models;
using FlexTextBridge.Services;
using Newtonsoft.Json;
using SIL.LCModel;

namespace FlexTextBridge.Commands
{
    /// <summary>
    /// Command to get detailed information about a FLEx project.
    /// </summary>
    public class ProjectInfoCommand
    {
        private readonly string _projectName;

        public ProjectInfoCommand(string projectName)
        {
            _projectName = projectName ?? throw new ArgumentNullException(nameof(projectName));
        }

        /// <summary>
        /// Execute the project-info command.
        /// </summary>
        /// <returns>Exit code (0 = success)</returns>
        public int Execute()
        {
            FlexProjectService projectService = null;

            try
            {
                projectService = new FlexProjectService();

                Models.ProjectInfo projectInfo;
                try
                {
                    projectInfo = projectService.GetProjectInfo(_projectName);
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

                // Output success result
                var result = new ProjectInfoResult
                {
                    Success = true,
                    Project = projectInfo
                };

                Console.WriteLine(JsonConvert.SerializeObject(result, Formatting.Indented));
                return 0;
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
            var result = new ProjectInfoResult
            {
                Success = false,
                Error = message,
                ErrorCode = errorCode
            };

            Console.Error.WriteLine(JsonConvert.SerializeObject(result, Formatting.Indented));
            return 1;
        }
    }

    /// <summary>
    /// Result from the project-info command.
    /// </summary>
    public class ProjectInfoResult
    {
        [JsonProperty("success")]
        public bool Success { get; set; }

        [JsonProperty("project", NullValueHandling = NullValueHandling.Ignore)]
        public Models.ProjectInfo Project { get; set; }

        [JsonProperty("error", NullValueHandling = NullValueHandling.Ignore)]
        public string Error { get; set; }

        [JsonProperty("errorCode", NullValueHandling = NullValueHandling.Ignore)]
        public string ErrorCode { get; set; }
    }
}
