using System;
using System.IO;
using System.Reflection;
using FlexTextBridge.Commands;
using Microsoft.Win32;

namespace FlexTextBridge
{
    /// <summary>
    /// FlexTextBridge CLI - Creates FLEx texts from USJ scripture data.
    /// </summary>
    class Program
    {
        private static string _fieldWorksDir;

        static Program()
        {
            // Set up assembly resolver to load from FLEx installation
            _fieldWorksDir = GetFieldWorksDirectory();
            if (!string.IsNullOrEmpty(_fieldWorksDir))
            {
                AppDomain.CurrentDomain.AssemblyResolve += ResolveAssembly;
            }
        }

        private static string GetFieldWorksDirectory()
        {
            string fwDir = null;

            // Try registry (HKLM\SOFTWARE\SIL\FieldWorks\9)
            try
            {
                using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\SIL\FieldWorks\9"))
                {
                    fwDir = key?.GetValue("RootCodeDir") as string;
                }
            }
            catch
            {
                // Ignore registry errors
            }

            // Fallback to common locations
            if (string.IsNullOrEmpty(fwDir) || !Directory.Exists(fwDir))
            {
                var commonPaths = new[]
                {
                    @"C:\Program Files\SIL\FieldWorks 9",
                    @"C:\Program Files (x86)\SIL\FieldWorks 9",
                };

                foreach (var path in commonPaths)
                {
                    if (Directory.Exists(path))
                    {
                        fwDir = path;
                        break;
                    }
                }
            }

            return fwDir;
        }

        private static Assembly ResolveAssembly(object sender, ResolveEventArgs args)
        {
            if (string.IsNullOrEmpty(_fieldWorksDir))
                return null;

            var assemblyName = new AssemblyName(args.Name).Name;
            var assemblyPath = Path.Combine(_fieldWorksDir, assemblyName + ".dll");

            if (File.Exists(assemblyPath))
            {
                return Assembly.LoadFrom(assemblyPath);
            }

            return null;
        }

        static int Main(string[] args)
        {
            // Simple argument parsing (no external dependencies needed)
            if (args.Length == 0)
            {
                ShowHelp();
                return 1;
            }

            string project = null;
            string title = null;
            string textGuid = null;
            string vernacularWs = null;
            bool overwrite = false;
            bool listProjects = false;
            bool projectInfo = false;
            bool checkText = false;
            bool verifyText = false;
            bool checkFlexStatus = false;
            bool getSafeTarget = false;
            bool showVersion = false;
            bool showHelp = false;

            for (int i = 0; i < args.Length; i++)
            {
                switch (args[i].ToLowerInvariant())
                {
                    case "--list-projects":
                    case "-l":
                        listProjects = true;
                        break;

                    case "--project-info":
                    case "-i":
                        projectInfo = true;
                        break;

                    case "--check-text":
                    case "-c":
                        checkText = true;
                        break;

                    case "--verify-text":
                        verifyText = true;
                        break;

                    case "--guid":
                    case "-g":
                        if (i + 1 < args.Length)
                            textGuid = args[++i];
                        break;

                    case "--check-flex-status":
                        checkFlexStatus = true;
                        break;

                    case "--get-safe-target":
                        getSafeTarget = true;
                        break;

                    case "--project":
                    case "-p":
                        if (i + 1 < args.Length)
                            project = args[++i];
                        break;

                    case "--title":
                    case "-t":
                        if (i + 1 < args.Length)
                            title = args[++i];
                        break;

                    case "--vernacular-ws":
                    case "-w":
                        if (i + 1 < args.Length)
                            vernacularWs = args[++i];
                        break;

                    case "--overwrite":
                    case "-o":
                        overwrite = true;
                        break;

                    case "--version":
                    case "-v":
                        showVersion = true;
                        break;

                    case "--help":
                    case "-h":
                    case "-?":
                        showHelp = true;
                        break;
                }
            }

            if (showHelp)
            {
                ShowHelp();
                return 0;
            }

            if (showVersion)
            {
                Console.WriteLine("FlexTextBridge v1.0.0");
                Console.WriteLine("Creates FLEx texts from Paranext USJ scripture data");
                return 0;
            }

            if (listProjects)
            {
                var command = new ListProjectsCommand();
                return command.Execute();
            }

            if (checkText && !string.IsNullOrEmpty(project) && !string.IsNullOrEmpty(title))
            {
                var command = new CheckTextCommand(project, title);
                return command.Execute();
            }

            if (verifyText && !string.IsNullOrEmpty(project) && !string.IsNullOrEmpty(textGuid))
            {
                var command = new VerifyTextCommand(project, textGuid);
                return command.Execute();
            }

            if (checkFlexStatus && !string.IsNullOrEmpty(project))
            {
                var command = new CheckFlexStatusCommand(project);
                return command.Execute();
            }

            if (getSafeTarget && !string.IsNullOrEmpty(project) && !string.IsNullOrEmpty(title))
            {
                var command = new GetSafeNavigationTargetCommand(project, title);
                return command.Execute();
            }

            if (projectInfo && !string.IsNullOrEmpty(project))
            {
                var command = new ProjectInfoCommand(project);
                return command.Execute();
            }

            if (!string.IsNullOrEmpty(project) && !string.IsNullOrEmpty(title))
            {
                var command = new CreateTextCommand(project, title, overwrite, vernacularWs);
                return command.Execute();
            }

            // No valid command
            ShowHelp();
            return 1;
        }

        static void ShowHelp()
        {
            Console.Error.WriteLine("FlexTextBridge - Create FLEx texts from Paranext scripture data");
            Console.Error.WriteLine();
            Console.Error.WriteLine("Usage:");
            Console.Error.WriteLine("  FlexTextBridge --list-projects");
            Console.Error.WriteLine("  FlexTextBridge --project-info --project <name>");
            Console.Error.WriteLine("  FlexTextBridge --check-text --project <name> --title <title>");
            Console.Error.WriteLine("  FlexTextBridge --verify-text --project <name> --guid <guid>");
            Console.Error.WriteLine("  FlexTextBridge --check-flex-status --project <name>");
            Console.Error.WriteLine("  FlexTextBridge --get-safe-target --project <name> --title <title>");
            Console.Error.WriteLine("  FlexTextBridge --project <name> --title <title> [--vernacular-ws <code>] [--overwrite] < scripture.json");
            Console.Error.WriteLine();
            Console.Error.WriteLine("Options:");
            Console.Error.WriteLine("  -l, --list-projects          List all FLEx projects on the system");
            Console.Error.WriteLine("  -i, --project-info           Get detailed info for a project (requires --project)");
            Console.Error.WriteLine("  -c, --check-text             Check if text name exists and get suggested alternative");
            Console.Error.WriteLine("      --verify-text            Verify text exists and is accessible by GUID");
            Console.Error.WriteLine("      --check-flex-status      Check if FLEx is running and if project sharing is enabled");
            Console.Error.WriteLine("      --get-safe-target        Find safe navigation target for overwrite workflow");
            Console.Error.WriteLine("  -p, --project <name>         Name of the FLEx project to use");
            Console.Error.WriteLine("  -t, --title <title>          Title for the new text (e.g., 'Mark 01-03')");
            Console.Error.WriteLine("  -g, --guid <guid>            Text GUID for verification");
            Console.Error.WriteLine("  -w, --vernacular-ws <ws>     Vernacular writing system code (defaults to project default)");
            Console.Error.WriteLine("  -o, --overwrite              Overwrite existing text with the same name");
            Console.Error.WriteLine("  -v, --version                Display version information");
            Console.Error.WriteLine("  -h, --help                   Show this help message");
            Console.Error.WriteLine();
            Console.Error.WriteLine("Examples:");
            Console.Error.WriteLine("  FlexTextBridge --list-projects");
            Console.Error.WriteLine("  FlexTextBridge --project-info --project MyProject");
            Console.Error.WriteLine("  FlexTextBridge --check-text --project MyProject --title \"Mark 01\"");
            Console.Error.WriteLine("  FlexTextBridge --verify-text --project MyProject --guid \"12345678-1234-1234-1234-123456789abc\"");
            Console.Error.WriteLine("  type scripture.json | FlexTextBridge --project MyProject --title \"Genesis 01\"");
            Console.Error.WriteLine("  type scripture.json | FlexTextBridge --project MyProject --title \"Genesis 01\" --vernacular-ws arz");
        }
    }
}
