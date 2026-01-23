using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace FlexTextBridge.Models
{
    /// <summary>
    /// Represents a USJ (Unified Scripture JSON) document.
    /// Based on the USJ specification: https://docs.usfm.bible/usj/
    /// </summary>
    public class UsjDocument
    {
        [JsonProperty("type")]
        public string Type { get; set; } // Should be "USJ"

        [JsonProperty("version")]
        public string Version { get; set; }

        [JsonProperty("content")]
        public List<UsjNode> Content { get; set; }
    }

    /// <summary>
    /// Base class for USJ nodes. Uses a custom converter to handle polymorphic deserialization.
    /// </summary>
    [JsonConverter(typeof(UsjNodeConverter))]
    public class UsjNode
    {
        [JsonProperty("type")]
        public string Type { get; set; }

        [JsonProperty("marker")]
        public string Marker { get; set; }

        [JsonProperty("content")]
        public List<object> Content { get; set; } // Can contain strings or nested UsjNodes

        [JsonProperty("number")]
        public string Number { get; set; } // For chapter/verse markers

        [JsonProperty("sid")]
        public string Sid { get; set; } // Start ID for chapters/verses

        [JsonProperty("eid")]
        public string Eid { get; set; } // End ID for chapters/verses

        [JsonProperty("altnumber")]
        public string AltNumber { get; set; }

        [JsonProperty("pubnumber")]
        public string PubNumber { get; set; }

        [JsonProperty("caller")]
        public string Caller { get; set; } // For footnotes/cross-refs

        [JsonProperty("category")]
        public string Category { get; set; }

        [JsonProperty("code")]
        public string Code { get; set; } // For book identification

        // Figure-specific properties
        [JsonProperty("file")]
        public string File { get; set; }

        [JsonProperty("size")]
        public string Size { get; set; }

        [JsonProperty("loc")]
        public string Loc { get; set; }

        [JsonProperty("copy")]
        public string Copy { get; set; }

        [JsonProperty("ref")]
        public string Ref { get; set; }
    }

    /// <summary>
    /// Custom JSON converter to handle USJ's polymorphic content arrays
    /// which can contain both strings and nested objects.
    /// </summary>
    public class UsjNodeConverter : JsonConverter<UsjNode>
    {
        public override UsjNode ReadJson(JsonReader reader, System.Type objectType, UsjNode existingValue, bool hasExistingValue, JsonSerializer serializer)
        {
            if (reader.TokenType == JsonToken.Null)
                return null;

            var jObject = JObject.Load(reader);
            var node = new UsjNode();

            node.Type = jObject["type"]?.Value<string>();
            node.Marker = jObject["marker"]?.Value<string>();
            node.Number = jObject["number"]?.Value<string>();
            node.Sid = jObject["sid"]?.Value<string>();
            node.Eid = jObject["eid"]?.Value<string>();
            node.AltNumber = jObject["altnumber"]?.Value<string>();
            node.PubNumber = jObject["pubnumber"]?.Value<string>();
            node.Caller = jObject["caller"]?.Value<string>();
            node.Category = jObject["category"]?.Value<string>();
            node.Code = jObject["code"]?.Value<string>();
            node.File = jObject["file"]?.Value<string>();
            node.Size = jObject["size"]?.Value<string>();
            node.Loc = jObject["loc"]?.Value<string>();
            node.Copy = jObject["copy"]?.Value<string>();
            node.Ref = jObject["ref"]?.Value<string>();

            var contentToken = jObject["content"];
            if (contentToken != null && contentToken.Type == JTokenType.Array)
            {
                node.Content = new List<object>();
                foreach (var item in (JArray)contentToken)
                {
                    if (item.Type == JTokenType.String)
                    {
                        node.Content.Add(item.Value<string>());
                    }
                    else if (item.Type == JTokenType.Object)
                    {
                        // Recursively deserialize nested nodes
                        var nestedNode = item.ToObject<UsjNode>(serializer);
                        node.Content.Add(nestedNode);
                    }
                }
            }

            return node;
        }

        public override void WriteJson(JsonWriter writer, UsjNode value, JsonSerializer serializer)
        {
            // We don't need to write USJ back, but implement for completeness
            serializer.Serialize(writer, value);
        }
    }
}
