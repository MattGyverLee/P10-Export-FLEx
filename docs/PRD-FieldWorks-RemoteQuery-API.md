# PRD: FieldWorks Remote Query API

**Status:** Proposal
**Target Repository:** [FieldWorks](https://github.com/sillsdev/FieldWorks)
**Author:** Matt Lee
**Date:** 2026-01-29

---

## 1. Problem Statement

External tools that interact with running FieldWorks instances (e.g., Paratext extensions, Phonology Assistant) have no way to query the current UI state of FLEx. The existing `.NET Remoting` channel (`RemoteRequest`) supports commands (open project, follow link, close windows) but no queries about what the user is currently viewing.

**Concrete use case:** The [P10-Export-FLEx](https://github.com/nicholasgasior/P10-Export-FLEx) Paratext extension exports Scripture texts to FLEx projects. When overwriting a text that FLEx currently has open in the Interlinear editor, the write can fail with stale-object errors. The extension sends a deep link (`silfw://`) to navigate FLEx away from the text before writing, but deep links are fire-and-forget -- there is no way to confirm FLEx has actually navigated away.

**Current workarounds:**
- Hardcoded delays (fragile, machine-dependent)
- Navigate FLEx early and hope it finishes in time (current approach -- works but unverifiable)

**What's needed:** A way for external tools to query which area/tool FLEx is currently displaying, so they can confirm navigation completed before performing destructive operations.

---

## 2. Existing Infrastructure

FieldWorks already has a mature .NET Remoting infrastructure and a precedent for query-style remote methods.

### 2.1 Remoting Channel Setup

Each `FieldWorks.exe` process registers a TCP remoting listener on startup:

- **Port range:** 9628-9728 (tries consecutive ports until one is available)
- **Service name:** `FW_RemoteRequest` (singleton)
- **Setup location:** `FieldWorks.cs:CreateRemoteRequestListener()` (line ~3354)
- **Client scan:** `FieldWorks.cs:RunOnRemoteClients()` (line ~3405) scans ports to find all running instances

### 2.2 Current RemoteRequest Methods

**File:** `Src/Common/FieldWorks/RemoteRequest.cs`

| Method | Purpose | Returns |
|--------|---------|---------|
| `HandleOpenProjectRequest()` | Check project match, activate window | `ProjectMatch` enum |
| `HandleRestoreProjectRequest()` | Restore project from backup | `bool` |
| `HandleLinkRequest()` | Navigate via deep link | `bool` |
| `BringMainFormToFront()` | Activate FLEx window | `void` |
| `CloseAllMainWindows()` | Close all windows | `bool` |
| `IsAlive()` | Health check (1000ms timeout) | `bool` |
| `InSingleProcessMode()` | Check process mode | `bool` |
| `ProjectName` (property) | Get project name | `string` |

### 2.3 Precedent: PaRemoteRequest

**File:** `Src/Common/FieldWorks/PaObjects/PaRemoteRequest.cs`

Phonology Assistant already extends `RemoteRequest` with **query methods**:

```csharp
public class PaRemoteRequest : RemoteRequest
{
    public bool ShouldWait(string name, string server)
    public bool IsMyProject(string name, string server)
    public string GetWritingSystems()   // Returns XML of all writing systems
    public string GetLexEntries()       // Returns XML of all lex entries
    public void ExitProcess()
}
```

This is registered as a second well-known service (`PA_RemoteRequest`) on the **same TCP channel**. The proposed feature follows this exact pattern.

### 2.4 UI State Access Path

The in-memory UI state is accessible through:

```
FieldWorks.s_activeMainWnd          (static IFwMainWnd, line 114)
    -> .PropTable                   (PropertyTable via IPropertyTableProvider)
        -> .GetValue<string>(key)   (concurrent dictionary lookup)
```

Key properties set during navigation (all with `doPersist=true`):

| Property Key | Example Value | Set By |
|-------------|---------------|--------|
| `currentContentControl` | `"interlinearEdit"`, `"lexiconEdit"` | `AreaListener.cs` |
| `areaChoice` | `"textsWords"`, `"lexicon"`, `"notebook"` | `AreaListener.cs` |
| `ToolForAreaNamed_textsWords` | `"interlinearEdit"` | `AreaListener.cs` |
| `ToolForAreaNamed_lexicon` | `"lexiconEdit"` | `AreaListener.cs` |
| `InitialArea` | `"textsWords"` | Startup only |

**Note:** These values are updated in memory immediately during navigation. They are only flushed to disk (`Settings.xml`) on window close. Since we're querying the live process via Remoting, we read the **in-memory** values -- no disk I/O involved.

---

## 3. Proposed Changes

### 3.1 New Methods on RemoteRequest

Add three query methods to `RemoteRequest.cs`. No new class, no new service registration -- just new public methods on the existing singleton.

#### Method 1: `GetCurrentArea()`

Returns the name of the area FLEx is currently displaying.

```csharp
/// <summary>
/// Returns the current area name (e.g., "textsWords", "lexicon", "notebook", "lists").
/// Returns empty string if no window is active or property is not set.
/// </summary>
public string GetCurrentArea()
{
    try
    {
        var mainWnd = FieldWorks.ActiveMainWindow;
        if (mainWnd is IFwMainWnd fwWnd)
            return fwWnd.PropTable.GetValue("areaChoice", string.Empty);
    }
    catch
    {
        // Swallow -- caller gets empty string on any failure
    }
    return string.Empty;
}
```

#### Method 2: `GetCurrentTool()`

Returns the name of the tool/view currently active.

```csharp
/// <summary>
/// Returns the current tool name (e.g., "interlinearEdit", "lexiconEdit",
/// "concordance", "corpusStatistics").
/// Returns empty string if no window is active or property is not set.
/// </summary>
public string GetCurrentTool()
{
    try
    {
        var mainWnd = FieldWorks.ActiveMainWindow;
        if (mainWnd is IFwMainWnd fwWnd)
            return fwWnd.PropTable.GetValue("currentContentControl", string.Empty);
    }
    catch
    {
        // Swallow -- caller gets empty string on any failure
    }
    return string.Empty;
}
```

#### Method 3: `GetProjectStatus()`

Returns a combined status string for efficient single-call queries.

```csharp
/// <summary>
/// Returns a pipe-delimited status string with project and UI state:
///   ProjectName|ProjectPath|CurrentArea|CurrentTool|IsShared
/// Returns empty string if no project is loaded.
/// Example: "MyProject|C:\ProgramData\SIL\FieldWorks\Projects\MyProject|lexicon|lexiconEdit|true"
/// </summary>
public string GetProjectStatus()
{
    try
    {
        var cache = FieldWorks.Cache;
        if (cache?.ProjectId == null)
            return string.Empty;

        string projectName = cache.ProjectId.UiName ?? string.Empty;
        string projectPath = cache.ProjectId.ProjectFolder ?? string.Empty;
        string currentArea = string.Empty;
        string currentTool = string.Empty;

        var mainWnd = FieldWorks.ActiveMainWindow;
        if (mainWnd is IFwMainWnd fwWnd)
        {
            currentArea = fwWnd.PropTable.GetValue("areaChoice", string.Empty);
            currentTool = fwWnd.PropTable.GetValue("currentContentControl", string.Empty);
        }

        bool isShared = false;
        try
        {
            isShared = LcmSettings.IsProjectSharingEnabled(projectPath);
        }
        catch
        {
            // Sharing status unknown
        }

        return $"{projectName}|{projectPath}|{currentArea}|{currentTool}|{isShared}";
    }
    catch
    {
        return string.Empty;
    }
    return string.Empty;
}
```

### 3.2 Expose ActiveMainWindow

The `FieldWorks` class already tracks `s_activeMainWnd` (line 114) but has no public accessor. Add one:

**File:** `Src/Common/FieldWorks/FieldWorks.cs`

```csharp
/// <summary>
/// Gets the currently active main window, if any.
/// Used by RemoteRequest to query UI state.
/// </summary>
internal static Form ActiveMainWindow
{
    get { return s_activeMainWnd as Form ?? s_flexApp?.ActiveMainWindow; }
}
```

**Note:** `s_flexApp.ActiveMainWindow` already exists as a public property on `FwApp` (line ~940). The new static accessor on `FieldWorks` provides a consistent entry point that matches how `RemoteRequest` accesses other static members.

### 3.3 Files Changed

| File | Change | Lines Affected |
|------|--------|----------------|
| `Src/Common/FieldWorks/RemoteRequest.cs` | Add 3 new public methods | ~50 lines added |
| `Src/Common/FieldWorks/FieldWorks.cs` | Add `ActiveMainWindow` internal static property | ~10 lines added |

**No new files. No new assemblies. No new NuGet packages. No configuration changes.**

---

## 4. API Specification

### 4.1 Wire Protocol

Unchanged. All methods use the existing .NET Remoting TCP channel. Callers connect exactly as they do today:

```csharp
RemoteRequest requestor = (RemoteRequest)Activator.GetObject(
    typeof(RemoteRequest),
    $"tcp://localhost:{port}/FW_RemoteRequest");
```

### 4.2 Method Signatures

```csharp
// Query the current area (e.g., "lexicon", "textsWords")
public string GetCurrentArea()

// Query the current tool (e.g., "interlinearEdit", "lexiconEdit")
public string GetCurrentTool()

// Query combined project + UI status (pipe-delimited)
public string GetProjectStatus()
```

### 4.3 Return Values

**`GetCurrentArea()`**

| Value | Meaning |
|-------|---------|
| `"textsWords"` | Texts & Words area |
| `"lexicon"` | Lexicon area |
| `"notebook"` | Notebook area |
| `"lists"` | Lists area |
| `"grammar"` | Grammar area |
| `""` | No active window or property not set |

**`GetCurrentTool()`**

| Value | Meaning |
|-------|---------|
| `"interlinearEdit"` | Interlinear text editor |
| `"lexiconEdit"` | Lexicon editor |
| `"concordance"` | Concordance tool |
| `"corpusStatistics"` | Corpus statistics view |
| `"reversalToolEditComplete"` | Reversal index editor |
| `""` | No active window or property not set |

**`GetProjectStatus()`**

Pipe-delimited string: `ProjectName|ProjectPath|CurrentArea|CurrentTool|IsShared`

Example: `"Sena 3|C:\ProgramData\SIL\FieldWorks\Projects\Sena 3|lexicon|lexiconEdit|True"`

Returns `""` if no project is loaded.

### 4.4 Error Handling

All methods catch exceptions internally and return empty strings on failure. This matches the existing pattern in `RemoteRequest` where operations are best-effort. The caller should treat an empty return as "unknown state."

### 4.5 Thread Safety

- `PropertyTable` uses `ConcurrentDictionary` internally -- reads are thread-safe
- `s_activeMainWnd` is assigned on the UI thread but read on the remoting thread; store in a local variable before use (matching the existing pattern at `FieldWorks.cs:3895`)
- No locks needed beyond what `ConcurrentDictionary` provides

---

## 5. Client Usage Example

### 5.1 Querying a Single Instance

```csharp
// Connect to FLEx on a known port
var requestor = (RemoteRequest)Activator.GetObject(
    typeof(RemoteRequest),
    "tcp://localhost:9628/FW_RemoteRequest");

// Validate connection (1 second timeout)
if (!requestor.IsAlive())
    return;

// Query current state
string area = requestor.GetCurrentArea();    // "textsWords"
string tool = requestor.GetCurrentTool();    // "interlinearEdit"

// Or get everything in one call
string status = requestor.GetProjectStatus();
// "Sena 3|C:\...\Sena 3|textsWords|interlinearEdit|True"
```

### 5.2 Scanning All Running Instances

```csharp
// Discover all running FLEx projects and their current state
var results = new List<string>();

for (int port = 9628; port < 9728; port++)
{
    try
    {
        var requestor = (RemoteRequest)Activator.GetObject(
            typeof(RemoteRequest),
            $"tcp://localhost:{port}/FW_RemoteRequest");

        // Quick health check with timeout
        var invoker = new Func<bool>(requestor.IsAlive);
        var ar = invoker.BeginInvoke(null, null);
        if (!ar.AsyncWaitHandle.WaitOne(1000))
            continue;
        invoker.EndInvoke(ar);

        string status = requestor.GetProjectStatus();
        if (!string.IsNullOrEmpty(status))
            results.Add($"Port {port}: {status}");
    }
    catch
    {
        continue; // Port not in use or not a FLEx instance
    }
}
```

### 5.3 Confirming Navigation (the P10-Export-FLEx use case)

```csharp
// 1. Send navigation deep link
requestor.HandleLinkRequest(lexiconLink);

// 2. Poll until FLEx has moved away from textsWords
for (int i = 0; i < 10; i++)  // Max 5 seconds
{
    await Task.Delay(500);
    string area = requestor.GetCurrentArea();
    if (area != "textsWords")
    {
        Console.WriteLine($"FLEx navigated to: {area}");
        break;
    }
}

// 3. Now safe to overwrite the text
```

---

## 6. Testing Plan

### 6.1 Unit Tests

**File:** `Src/Common/FieldWorks/FieldWorksTests/RemoteRequestTests.cs` (new or existing)

| Test | Description |
|------|-------------|
| `GetCurrentArea_NoActiveWindow_ReturnsEmpty` | `s_activeMainWnd` is null -> returns `""` |
| `GetCurrentArea_WithActiveWindow_ReturnsAreaChoice` | Mock window with PropTable returning "lexicon" |
| `GetCurrentTool_NoActiveWindow_ReturnsEmpty` | Same null-safety test for tool |
| `GetCurrentTool_WithActiveWindow_ReturnsContentControl` | Mock window returning "interlinearEdit" |
| `GetProjectStatus_NoCache_ReturnsEmpty` | Cache is null -> returns `""` |
| `GetProjectStatus_WithCacheAndWindow_ReturnsPipeDelimited` | Full status string with all fields |
| `GetProjectStatus_WithCacheNoWindow_ReturnsPartialStatus` | Project info present, area/tool empty |

### 6.2 Integration Tests

| Test | Description |
|------|-------------|
| Navigate to Texts area, query `GetCurrentArea()` -> `"textsWords"` |
| Navigate to Lexicon via deep link, poll `GetCurrentArea()` until it changes |
| Open project, call `GetProjectStatus()`, verify all 5 fields populated |
| Close all windows, call `GetCurrentArea()` -> `""` |

### 6.3 Manual Verification

1. Start FLEx with a project, navigate to Interlinear view
2. From a test console app, connect via Remoting and call `GetCurrentTool()`
3. Verify it returns `"interlinearEdit"`
4. Send a deep link to navigate to Lexicon
5. Poll `GetCurrentTool()` until it returns `"lexiconEdit"`
6. Verify the transition happens within ~1 second

---

## 7. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Thread race between UI navigation and remoting query | Low | `ConcurrentDictionary` handles concurrent reads. PropertyTable updates are atomic. Worst case: caller sees the pre-navigation value and retries. |
| Performance impact of remoting queries | Negligible | `ConcurrentDictionary.TryGetValue()` is O(1). No disk I/O. No database queries. Comparable to existing `IsAlive()`. |
| Breaking existing callers | None | New methods only. No changes to existing method signatures, return types, or behavior. |
| Security: exposing UI state to other processes | Low | Remoting is localhost-only. Same trust boundary as existing `GetLexEntries()` which returns full lexicon data. UI state is far less sensitive. |
| `ActiveMainWindow` null during transitions | Low | All methods return empty string on null. Caller retries. |

---

## 8. Scope and Non-Goals

### In Scope
- Three new query methods on `RemoteRequest`
- One new internal static property on `FieldWorks`
- Unit tests for new methods
- Documentation in code comments

### Not In Scope
- Modifying `PaRemoteRequest` (Phonology Assistant can use these methods through inheritance)
- Adding JSON or XML serialization (pipe-delimited string is sufficient and matches the simplicity of existing methods)
- Event/callback mechanism for state changes (polling is adequate for the use case)
- Exposing PropertyTable directly (too broad; specific methods are safer)
- Changes to the TCP port range or remoting configuration

---

## 9. Implementation Notes for the Developer

### Access Path Summary

```
RemoteRequest (singleton, MarshalByRefObject)
  -> FieldWorks.ActiveMainWindow (new internal static property)
     -> (IFwMainWnd).PropTable (PropertyTable from IPropertyTableProvider)
        -> .GetValue<string>("areaChoice")
        -> .GetValue<string>("currentContentControl")
  -> FieldWorks.Cache (existing internal static property)
     -> .ProjectId.UiName
     -> .ProjectId.ProjectFolder
```

### Pattern to Follow

The implementation follows the exact pattern of `RemoteRequest.ProjectName` (line 137-140):

```csharp
// Existing -- accesses static FieldWorks members directly
public string ProjectName
{
    get { return FieldWorks.Cache.ProjectId.UiName; }
}
```

And `PaRemoteRequest.GetWritingSystems()` (line 42-45):

```csharp
// Existing -- queries FLEx data via FieldWorks.Cache
public string GetWritingSystems()
{
    return PaWritingSystem.GetWritingSystemsAsXml(FieldWorks.Cache.ServiceLocator);
}
```

### Thread Safety Pattern

Follow the pattern at `FieldWorks.cs:3895` (store in temp variable before use):

```csharp
// From GetProjectMatchStatus -- stores in temp for thread safety
ProjectId thisProjectId = s_projectId;
if (thisProjectId == null)
    return ProjectMatch.DontKnowYet;
```

Apply same pattern:

```csharp
var mainWnd = FieldWorks.ActiveMainWindow;
if (mainWnd is IFwMainWnd fwWnd)
    return fwWnd.PropTable.GetValue("areaChoice", string.Empty);
```

---

## 10. Summary

**What:** Add 3 read-only query methods to `RemoteRequest` so external tools can ask FLEx "what are you currently showing?"

**Why:** External tools that send navigation deep links to FLEx have no way to confirm the navigation completed. This causes timing-dependent failures when writing to FLEx projects.

**How:** Read existing in-memory `PropertyTable` values through the existing `.NET Remoting` channel. Two files changed, ~60 lines of code, following the established `PaRemoteRequest` pattern.

**Risk:** Minimal. Read-only methods, no behavior changes, no new dependencies, localhost-only access.
