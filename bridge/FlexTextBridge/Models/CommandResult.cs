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

        [JsonProperty("textGuid", NullValueHandling = NullValueHandling.Ignore)]
        public string TextGuid { get; set; }

        [JsonProperty("paragraphCount", NullValueHandling = NullValueHandling.Ignore)]
        public int? ParagraphCount { get; set; }

        [JsonProperty("projectPath", NullValueHandling = NullValueHandling.Ignore)]
        public string ProjectPath { get; set; }

        [JsonProperty("vernacularWs", NullValueHandling = NullValueHandling.Ignore)]
        public string VernacularWs { get; set; }

        [JsonProperty("suggestedName", NullValueHandling = NullValueHandling.Ignore)]
        public string SuggestedName { get; set; }
    }

    /// <summary>
    /// Result for the check text name command.
    /// </summary>
    public class CheckTextResult : CommandResult
    {
        [JsonProperty("exists")]
        public bool Exists { get; set; }

        [JsonProperty("suggestedName", NullValueHandling = NullValueHandling.Ignore)]
        public string SuggestedName { get; set; }
    }

    /// <summary>
    /// Status of FLEx process and project sharing.
    /// </summary>
    public class FlexStatusResult : CommandResult
    {
        [JsonProperty("isRunning")]
        public bool IsRunning { get; set; }

        [JsonProperty("sharingEnabled")]
        public bool SharingEnabled { get; set; }
    }

    /// <summary>
    /// Navigation target for safe redirect.
    /// </summary>
    public class NavigationTargetResult : CommandResult
    {
        [JsonProperty("guid", NullValueHandling = NullValueHandling.Ignore)]
        public string Guid { get; set; }

        [JsonProperty("tool")]
        public string Tool { get; set; }
    }

    /// <summary>
    /// Result for the verify text command.
    /// </summary>
    public class VerifyTextResult : CommandResult
    {
        [JsonProperty("guid", NullValueHandling = NullValueHandling.Ignore)]
        public string Guid { get; set; }

        [JsonProperty("textName", NullValueHandling = NullValueHandling.Ignore)]
        public string TextName { get; set; }

        [JsonProperty("isAccessible")]
        public bool IsAccessible { get; set; }

        [JsonProperty("hasContent")]
        public bool HasContent { get; set; }

        [JsonProperty("paragraphCount")]
        public int ParagraphCount { get; set; }
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
        public const string TextNotFound = "TEXT_NOT_FOUND";
        public const string TextNotAccessible = "TEXT_NOT_ACCESSIBLE";
        public const string UnknownError = "UNKNOWN_ERROR";
    }
}
