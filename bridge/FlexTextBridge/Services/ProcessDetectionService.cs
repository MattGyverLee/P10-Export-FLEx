using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using SIL.LCModel;

namespace FlexTextBridge.Services
{
    /// <summary>
    /// Service for detecting FLEx process and finding safe navigation targets.
    /// </summary>
    public class ProcessDetectionService
    {
        /// <summary>
        /// Check if FieldWorks.exe is currently running on this machine.
        /// </summary>
        public bool IsFieldWorksRunning()
        {
            return Process.GetProcessesByName("FieldWorks").Length > 0;
        }

        /// <summary>
        /// Check if project sharing is enabled for a FLEx project.
        /// </summary>
        public bool IsProjectSharingEnabled(string projectFolder)
        {
            try
            {
                return LcmSettings.IsProjectSharingEnabled(projectFolder);
            }
            catch
            {
                // If we can't determine sharing status, assume it's not enabled
                return false;
            }
        }

        /// <summary>
        /// Get FLEx running status and project sharing status.
        /// </summary>
        public (bool isRunning, bool sharingEnabled) CheckFlexStatus(string projectFolder)
        {
            return (
                isRunning: IsFieldWorksRunning(),
                sharingEnabled: IsProjectSharingEnabled(projectFolder)
            );
        }

        /// <summary>
        /// Find a safe navigation target to redirect FLEx away from the text being overwritten.
        /// Always navigates to the corpus statistics tool, which is lightweight and moves FLEx away from the Texts area.
        /// </summary>
        public (Guid? textGuid, string tool) FindSafeNavigationTarget(LcmCache cache, string targetTextTitle)
        {
            // Navigate to corpus statistics tool - lightweight and reliably moves FLEx away from texts
            // We don't need a specific GUID, just the tool name
            return (null, "corpusStatistics");
        }
    }
}
