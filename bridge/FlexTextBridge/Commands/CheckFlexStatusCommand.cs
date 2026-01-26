using System;
using System.IO;
using Newtonsoft.Json;
using FlexTextBridge.Models;
using FlexTextBridge.Services;

namespace FlexTextBridge.Commands
{
    /// <summary>
    /// Command to check if FLEx is running and if project sharing is enabled.
    /// </summary>
    public class CheckFlexStatusCommand
    {
        private readonly string _projectName;

        public CheckFlexStatusCommand(string projectName)
        {
            _projectName = projectName ?? throw new ArgumentNullException(nameof(projectName));
        }

        public int Execute()
        {
            FlexProjectService projectService = null;

            try
            {
                projectService = new FlexProjectService();
                var projectsDir = projectService.GetProjectsDirectory();
                var projectDir = Path.Combine(projectsDir, _projectName);

                if (!Directory.Exists(projectDir))
                {
                    return OutputError($"Project '{_projectName}' not found", ErrorCodes.ProjectNotFound);
                }

                var processService = new ProcessDetectionService();
                var status = processService.CheckFlexStatus(projectDir);

                var result = new FlexStatusResult
                {
                    Success = true,
                    IsRunning = status.isRunning,
                    SharingEnabled = status.sharingEnabled
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
            var result = new FlexStatusResult
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
