using System;
using FlexTextBridge.Models;
using FlexTextBridge.Services;
using Newtonsoft.Json;

namespace FlexTextBridge.Commands
{
    /// <summary>
    /// Command to list all FLEx projects on the system.
    /// </summary>
    public class ListProjectsCommand
    {
        /// <summary>
        /// Execute the list-projects command.
        /// </summary>
        /// <returns>Exit code (0 = success)</returns>
        public int Execute()
        {
            try
            {
                using (var projectService = new FlexProjectService())
                {
                    var projects = projectService.DiscoverProjects();

                    var result = new ListProjectsResult
                    {
                        Success = true,
                        Projects = projects
                    };

                    Console.WriteLine(JsonConvert.SerializeObject(result, Formatting.Indented));
                    return 0;
                }
            }
            catch (Exception ex)
            {
                var result = new ListProjectsResult
                {
                    Success = false,
                    Error = ex.Message,
                    ErrorCode = ErrorCodes.UnknownError
                };

                Console.Error.WriteLine(JsonConvert.SerializeObject(result, Formatting.Indented));
                return 1;
            }
        }
    }
}
