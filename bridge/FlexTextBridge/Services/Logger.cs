using System;
using System.IO;
using System.Text;
using System.Threading;

namespace FlexTextBridge.Services
{
    /// <summary>
    /// File-based logger for bridge errors. Writes to a daily-rotated log file so failures
    /// that don't surface cleanly through stdout JSON (process crashes, malformed output,
    /// FLEx assembly load issues) are still recoverable.
    /// </summary>
    public static class Logger
    {
        private static readonly object _lock = new object();
        private static string _logFilePath;
        private static bool _initialized;

        /// <summary>
        /// Initialize the logger. Safe to call multiple times; only the first call takes effect.
        /// </summary>
        /// <param name="logDir">Directory to write logs to. If null/empty, falls back to %LOCALAPPDATA%\SIL\P10-Export-FLEx\logs.</param>
        public static void Initialize(string logDir)
        {
            if (_initialized) return;

            try
            {
                if (string.IsNullOrWhiteSpace(logDir))
                {
                    var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                    logDir = Path.Combine(localAppData, "SIL", "P10-Export-FLEx", "logs");
                }

                Directory.CreateDirectory(logDir);
                _logFilePath = Path.Combine(logDir, $"bridge-{DateTime.Now:yyyyMMdd}.log");
                _initialized = true;

                PruneOldLogs(logDir);
            }
            catch
            {
                // Logging must never break the command. Silently disable if init fails.
                _initialized = false;
                _logFilePath = null;
            }
        }

        /// <summary>
        /// Log an exception with full stack trace and optional context.
        /// </summary>
        public static void LogError(Exception ex, string context = null)
        {
            if (ex == null) return;
            var sb = new StringBuilder();
            if (!string.IsNullOrEmpty(context))
            {
                sb.AppendLine($"Context: {context}");
            }
            sb.AppendLine($"Exception: {ex.GetType().FullName}");
            sb.AppendLine($"Message: {ex.Message}");
            sb.AppendLine($"StackTrace:");
            sb.AppendLine(ex.StackTrace ?? "(no stack trace)");

            var inner = ex.InnerException;
            int depth = 0;
            while (inner != null && depth < 5)
            {
                sb.AppendLine($"--- Inner ({inner.GetType().FullName}) ---");
                sb.AppendLine(inner.Message);
                sb.AppendLine(inner.StackTrace ?? "(no stack trace)");
                inner = inner.InnerException;
                depth++;
            }

            Write("ERROR", sb.ToString());
        }

        /// <summary>
        /// Log an error message without an exception.
        /// </summary>
        public static void LogError(string message, string context = null)
        {
            var line = string.IsNullOrEmpty(context) ? message : $"[{context}] {message}";
            Write("ERROR", line);
        }

        /// <summary>
        /// Log an informational message. Used sparingly — only for command boundaries
        /// to give errors enough context to be debuggable.
        /// </summary>
        public static void LogInfo(string message)
        {
            Write("INFO", message);
        }

        private static void Write(string level, string message)
        {
            if (!_initialized || string.IsNullOrEmpty(_logFilePath)) return;

            try
            {
                var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] [{level}] [pid:{System.Diagnostics.Process.GetCurrentProcess().Id}] {message}{Environment.NewLine}";
                lock (_lock)
                {
                    File.AppendAllText(_logFilePath, line, Encoding.UTF8);
                }
            }
            catch
            {
                // Swallow — logging failures must never break the command.
            }
        }

        private static void PruneOldLogs(string logDir)
        {
            try
            {
                var cutoff = DateTime.Now.AddDays(-30);
                foreach (var file in Directory.GetFiles(logDir, "bridge-*.log"))
                {
                    if (File.GetLastWriteTime(file) < cutoff)
                    {
                        try { File.Delete(file); } catch { /* best-effort */ }
                    }
                }
            }
            catch
            {
                // Pruning is best-effort.
            }
        }
    }
}
