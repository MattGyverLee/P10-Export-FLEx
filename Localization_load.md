# Localization Loading Optimization

## Problem

When the WebView opened, users experienced a brief but noticeable flash where localization placeholder keys (like `%flexExport_title%`) appeared before being replaced with actual translated text. This was especially noticeable with 53 localization keys being loaded asynchronously.

The delay occurred because:
1. WebView component renders immediately
2. `useLocalizedStrings` hook subscribes to the localization data provider (async)
3. During the subscription round-trip, placeholder keys (`%flexExport_*%`) are displayed
4. Once localization loads, the UI re-renders with actual translations

This created a poor user experience, particularly for non-English users who saw English placeholders flash before seeing their language.

## Solution

We implemented a three-tier fallback system that eliminates the flash of placeholder keys:

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WebView Opens                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: English Fallbacks (Hardcoded - Instant)            │
│  - Defined in welcome.web-view.tsx                           │
│  - Available synchronously at first render                   │
│  - Ensures no % placeholders ever show                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Tier 2: Preloaded Strings (Server-side - <500ms)           │
│  - Fetched in main.ts before WebView opens                   │
│  - Uses user's configured UI language (French, Spanish, etc) │
│  - Passed via WebView state                                  │
│  - 500ms timeout to prevent blocking                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Tier 3: Async Hydration (Client-side subscription)         │
│  - useLocalizedStrings hook subscription                     │
│  - Redundant with Tier 2 but ensures reactivity             │
│  - No visible change (same values as Tier 2)                │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Details

#### 1. English Fallbacks (Tier 1)

**File:** `extension/src/web-views/welcome.web-view.tsx`

```typescript
const ENGLISH_FALLBACKS: Record<string, string> = {
  "%flexExport_title%": "Export to FLEx",
  "%flexExport_project%": "Project",
  // ... all 53 strings
};
```

These are hardcoded in the WebView component and provide instant rendering without any placeholder keys.

#### 2. Server-Side Preload (Tier 2)

**File:** `extension/src/main.ts`

In the `getWebView()` function, we fetch localized strings before the WebView opens:

```typescript
// Pre-load localized strings to avoid flash of % placeholders
let preloadedStrings: Record<string, string> | undefined;
try {
  const localizationPromise = (async () => {
    const localizationService = await papi.localization;
    return await localizationService.getLocalizedStrings({
      localizeKeys: LOCALIZATION_KEYS,
    });
  })();

  // Timeout after 500ms to avoid blocking
  const timeoutPromise = new Promise<undefined>((resolve) =>
    setTimeout(() => resolve(undefined), 500)
  );

  preloadedStrings = await Promise.race([localizationPromise, timeoutPromise]);
} catch (error) {
  logger.warn("Failed to preload localized strings:", error);
}
```

**Key features:**
- Fetches user's configured UI language automatically (no hardcoding)
- 500ms timeout prevents blocking WebView from opening
- Passes strings via `state.preloadedStrings`

#### 3. Merge Strategy (WebView Component)

**File:** `extension/src/web-views/welcome.web-view.tsx`

```typescript
// Get preloaded strings from state (if available)
const preloadedStrings = (state?.preloadedStrings as Record<string, string> | undefined) || {};

// Localized strings from async subscription
const [rawLocalizedStrings] = useLocalizedStrings(useMemo(() => LOCALIZED_STRING_KEYS, []));

// Merge fallbacks: English → Preloaded → Async loaded
const localizedStrings = useMemo(() => {
  return { ...ENGLISH_FALLBACKS, ...preloadedStrings, ...rawLocalizedStrings };
}, [preloadedStrings, rawLocalizedStrings]);
```

**Merge priority:** Later values override earlier ones
1. Start with English (always available)
2. Override with preloaded strings (user's language, if loaded in time)
3. Override with async strings (same as preloaded, ensures reactivity)

## Benefits

### User Experience
- **No placeholder flash**: Users never see `%flexExport_*%` keys
- **Instant rendering**: WebView appears immediately with readable text
- **Language-aware**: Non-English users see their language from first render (if preload succeeds)
- **Graceful degradation**: Falls back to English if preload times out

### Technical Benefits
- **Non-blocking**: 500ms timeout prevents slow localization from hanging WebView
- **Language-agnostic**: Works for any UI language configured by user
- **No hardcoding**: Automatically uses `platform.interfaceLanguage` setting
- **Maintains reactivity**: Still uses `useLocalizedStrings` hook for future-proofing

### Performance
- **Best case**: <500ms preload → Instant user language
- **Timeout case**: >500ms preload → Instant English, then brief flash to user language
- **Failure case**: Error in preload → Instant English, hydrates to user language via async

## Trade-offs

### Increased Bundle Size
English fallbacks add ~2KB to the WebView bundle (53 strings). This is acceptable given the UX improvement.

### Code Duplication
Localization keys are defined in two places:
- `main.ts`: Server-side key list for preloading
- `welcome.web-view.tsx`: Derived from `ENGLISH_FALLBACKS` keys

**Mitigation**: Keys are derived from the same object (`Object.keys(ENGLISH_FALLBACKS)`), ensuring they stay in sync.

### Reduced Reactivity
Since UI language changes require Paratext restart, we trade full reactivity for instant loading. This is the correct trade-off for this use case.

## Maintenance Notes

### Adding New Localization Keys

When adding a new localized string:

1. **Add to localization files** (as normal):
   - `extension/contributions/localizedStrings.json`
   - All other language files (`localizedStrings-fr.json`, etc.)

2. **Add English fallback** to `welcome.web-view.tsx`:
   ```typescript
   const ENGLISH_FALLBACKS: Record<string, string> = {
     // ... existing keys
     "%flexExport_newKey%": "New English Text",
   };
   ```

3. **Keys auto-sync**: The `LOCALIZED_STRING_KEYS` in both files are derived from `ENGLISH_FALLBACKS`, so they stay in sync automatically.

### Testing Different Languages

To test with different UI languages:
1. Change Paratext's UI language in settings
2. Restart Paratext 10
3. Open the FLEx Export extension
4. Verify no placeholder flash occurs

## Alternative Approaches Considered

### 1. Loading Screen
Show a loading spinner until localization loads.
- **Rejected**: Adds perceived delay, worse UX than instant English fallback

### 2. Reduce Localization Keys
Use hardcoded English for some strings, only localize critical ones.
- **Rejected**: Compromises internationalization, bad for non-English users

### 3. No Preloading (Original Implementation)
Just use async `useLocalizedStrings` with English fallbacks.
- **Rejected**: Still causes brief flash of English for non-English users

### 4. Remove Async Subscription Entirely
Only use preloaded strings, no `useLocalizedStrings` hook.
- **Rejected**: Breaks reactivity if localization changes (future-proofing concern)

## Conclusion

The three-tier fallback system provides optimal UX:
- **English users**: Instant English (Tier 1), no flash
- **French/Spanish/Other users**: Instant their language (Tier 2, if <500ms) or brief English flash (Tier 1 → Tier 2)
- **Slow localization**: WebView never hangs, always renders something useful
- **Failures**: Gracefully falls back through tiers

This approach prioritizes user experience while maintaining code quality and internationalization support.
