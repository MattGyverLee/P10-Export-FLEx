using System.Collections.Generic;
using Newtonsoft.Json;

namespace FlexTextBridge.Models
{
    /// <summary>
    /// Information about a FLEx project discovered on the system.
    /// </summary>
    public class ProjectInfo
    {
        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("path")]
        public string Path { get; set; }

        [JsonProperty("vernacularWs")]
        public string VernacularWs { get; set; }

        [JsonProperty("analysisWs")]
        public string AnalysisWs { get; set; }

        /// <summary>
        /// All vernacular writing systems in the project.
        /// Only populated when using --project-info command.
        /// </summary>
        [JsonProperty("vernacularWritingSystems", NullValueHandling = NullValueHandling.Ignore)]
        public List<WritingSystemInfo> VernacularWritingSystems { get; set; }

        /// <summary>
        /// All analysis writing systems in the project.
        /// Only populated when using --project-info command.
        /// </summary>
        [JsonProperty("analysisWritingSystems", NullValueHandling = NullValueHandling.Ignore)]
        public List<WritingSystemInfo> AnalysisWritingSystems { get; set; }
    }

    /// <summary>
    /// Information about a writing system.
    /// </summary>
    public class WritingSystemInfo
    {
        [JsonProperty("code")]
        public string Code { get; set; }

        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("isDefault")]
        public bool IsDefault { get; set; }
    }
}
