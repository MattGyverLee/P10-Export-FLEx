using System.Collections.Generic;
using Newtonsoft.Json;

namespace FlexTextBridge.Models
{
    /// <summary>
    /// Base result class for all CLI commands.
    /// </summary>
    public class CommandResult
    {
        [JsonProperty("success")]
        public bool Success { get; set; }

        [JsonProperty("error", NullValueHandling = NullValueHandling.Ignore)]
        public string Error { get; set; }

        [JsonProperty("errorCode", NullValueHandling = NullValueHandling.Ignore)]
        public string ErrorCode { get; set; }

        public static CommandResult SuccessResult() => new CommandResult { Success = true };

        public static CommandResult ErrorResult(string error, string errorCode) =>
            new CommandResult { Success = false, Error = error, ErrorCode = errorCode };
    }

    /// <summary>
    /// Result for the --list-projects command.
    /// </summary>
    public class ListProjectsResult : CommandResult
    {
        [JsonProperty("projects", NullValueHandling = NullValueHandling.Ignore)]
        public List<ProjectInfo> Projects { get; set; }
    }

    /// <summary>
    /// Result for the create text command.
    /// </summary>
    public class CreateTextResult : CommandResult
    {
        [JsonProperty("textName", NullValueHandling = NullValueHandling.Ignore)]
        public string TextName { get; set; }

        [JsonProperty("paragraphCount", NullValueHandling = NullValueHandling.Ignore)]
        public int? ParagraphCount { get; set; }

        [JsonProperty("projectPath", NullValueHandling = NullValueHandling.Ignore)]
        public string ProjectPath { get; set; }

        [JsonProperty("vernacularWs", NullValueHandling = NullValueHandling.Ignore)]
        public string VernacularWs { get; set; }
    }

    /// <summary>
    /// Error codes for CLI operations.
    /// </summary>
    public static class ErrorCodes
    {
        public const string ProjectNotFound = "PROJECT_NOT_FOUND";
        public const string ProjectLocked = "PROJECT_LOCKED";
        public const string ProjectNeedsMigration = "PROJECT_NEEDS_MIGRATION";
        public const string InvalidUsj = "INVALID_USJ";
        public const string TextExists = "TEXT_EXISTS";
        public const string WriteFailed = "WRITE_FAILED";
        public const string InitializationFailed = "INITIALIZATION_FAILED";
        public const string UnknownError = "UNKNOWN_ERROR";
    }
}
