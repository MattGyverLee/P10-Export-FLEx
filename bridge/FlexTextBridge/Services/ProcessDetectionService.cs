using System.Diagnostics;
using SIL.LCModel;

namespace FlexTextBridge.Services
{
    /// <summary>
    /// Service for detecting FLEx process and project sharing state.
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
    }
}
