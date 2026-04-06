# E2E Test Report -- 2026-04-06

## Screenshots taken

| File | Description |
|------|-------------|
| `screenshots/01-initial-load.png` | Full-page capture after navigating to the app and waiting 3 seconds. Shows only the dark gradient background -- the React root is empty because the renderer components crash on mount. |
| `screenshots/02-three-pane-layout.png` | Intended to capture the three-pane layout (`pane-left`, `pane-center`, `pane-right`). Falls back to full-page screenshot because none of the panes are present in the DOM. |
| `screenshots/03-probe-controls.png` | Intended to capture the probe control dock (`probe-control-dock`). Falls back to full-page screenshot because the React tree is unmounted. |
| `screenshots/04-after-slider-move.png` | Intended to capture state after moving the `slider-s` range input. Since no sliders exist in the DOM, the script sends 10 ArrowUp keystrokes as a fallback. Full-page screenshot is identical to the others. |
| `screenshots/05-early-render.png` | Captured at 200 ms after navigation. Still shows empty dark background -- the crash occurs before any visible content renders. |
| `screenshots/06-after-500ms.png` | Captured at 500 ms. Same empty state. |
| `screenshots/07-after-2500ms.png` | Captured at 2500 ms. Same empty state. |

All screenshots show only the CSS gradient background (`#07111f` to `#091728`) because the entire React component tree unmounts due to unhandled errors in the VTK.js renderer components.

## E2E test infrastructure status

- **Playwright version**: 1.59.1
- **Browser**: Chromium (installed and working)
- **Config**: `playwright.config.ts` is well-structured with Chromium-only project, auto-starts Vite dev server, and has appropriate timeouts (60 s per test, 30 s navigation, 15 s actions).
- **Test files**: 5 spec files with 25 total tests, all wrapped in `test.skip()`.
- **Page object model**: `e2e/fixtures/teesim-page.ts` provides a `TeeSimPage` class with locators for all key elements (panes, sliders, presets, view match indicator, canvases).
- **Infrastructure verdict**: Working correctly. Running `npx playwright test --reporter=list` completes successfully, reporting all 25 tests as skipped. The `webServer` config correctly starts/reuses the Vite dev server.

## App-loads test results

When the `test.skip()` in `e2e/app-loads.spec.ts` is removed, all 3 tests fail:

### Test 1: "page loads without console errors" -- FAILED

**Reason**: 4 console errors (`"No input!"`) are emitted by VTK.js `AppendPolyData` filter during probe glyph construction in `Scene3DPane`. The test expects zero console errors.

```
Expected: []
Received: ["No input!", "No input!", "No input!", "No input!"]
```

### Test 2: "3-pane layout is visible (left, center, right)" -- FAILED

**Reason**: `getByTestId('pane-left')` never appears in the DOM. The `TeeSimPage.goto()` helper times out waiting for `pane-center` to become visible (30 s timeout). The test then fails asserting `toBeVisible()` on `pane-left` (5 s timeout).

**Root cause**: The React tree crashes before rendering any visible content. The `<div id="root">` element has zero children.

### Test 3: "probe control dock is visible at bottom" -- FAILED

**Reason**: Same root cause -- `getByTestId('probe-control-dock')` does not exist because the React tree is unmounted.

## Console errors observed

### Page errors (uncaught exceptions)

1. **`renderWindow.getInteractor(...).onEndInteractionEvent is not a function`** (x2)
   - **Source**: `src/renderer/Scene3DPane.tsx:218` -- the `useEffect` mount hook calls `renderWindow.getInteractor().onEndInteractionEvent(...)`.
   - **Root cause**: VTK.js v35.5.2 declares `onEndInteractionEvent` in its TypeScript type definitions (`RenderWindowInteractor.d.ts:792`) but the method **does not exist** in the compiled JavaScript bundle. This is an API mismatch in the VTK.js package -- the type stubs are ahead of (or behind) the actual runtime code.

2. **`Cannot read properties of null (reading 'releaseGraphicsResources')`** (x4)
   - **Source**: The cleanup functions in Scene3DPane, PseudoTeePane, and ObliqueSlicePane call `disposePipeline(renderWindow)` which calls `renderWindow.delete()`. After the initial crash, some internal VTK objects are already null.

### Console errors

- **`No input!`** (x4) -- Emitted by `@kitware/vtk.js/Filters/General/AppendPolyData.js` when constructing the probe glyph in `createProbeGlyph()` (vtk-helpers.ts). The `append.setInputConnection()` and `append.addInputConnection()` calls may not be wiring inputs correctly, or the filter runs before the sources produce output.

### Console warnings

- React error boundary warnings for `<Scene3DPane>`, `<PseudoTeePane>`, and `<ObliqueSlicePane>` -- React recommends adding error boundaries.
- WebGL GPU stall warnings (`GL_CLOSE_PATH_NV: GPU stall due to ReadPixels`) -- Performance warnings from the GPU driver, non-fatal.
- **`WebGL: CONTEXT_LOST_WEBGL: loseContext`** (x6) -- WebGL contexts are lost as the crashed components' cleanup runs and destroys the GL contexts.

## Visual issues observed

1. **App renders as a completely blank dark page.** No text, no UI controls, no layout structure is visible. The CSS gradient background from `app.css` renders, but no React content mounts successfully.

2. **No Vite error overlay** -- Vite's error overlay does not appear because the errors are runtime JavaScript errors (not compilation/HMR errors). The app silently fails.

3. **The `#root` div is empty** -- Confirmed via DOM inspection: `rootChildCount: 0`, `rootInnerHTMLLength: 0`, zero `data-testid` elements in the document.

## Recommendations for fixes

### Critical (blocks all E2E tests)

1. **Fix the `onEndInteractionEvent` API call** in `src/renderer/Scene3DPane.tsx:216-221`.
   - The method does not exist at runtime in `@kitware/vtk.js` v35.5.2. Options:
     - Check if the method was renamed (e.g., `onInteractionEvent`, `onEndAnimation`, or check the interactor style instead of the interactor).
     - Wrap the call in a guard: `if (typeof interactor.onEndInteractionEvent === 'function')`.
     - Downgrade or upgrade `@kitware/vtk.js` to a version where this method exists.
   - This is the primary crash that takes down the entire React tree.

2. **Add a React error boundary** around each renderer pane (Scene3DPane, PseudoTeePane, ObliqueSlicePane). This would prevent a crash in one pane from taking down the entire application. The header, probe controls, and layout should remain visible even if the 3D renderers fail.

### High priority

3. **Fix the `AppendPolyData` "No input!" errors** in `createProbeGlyph()` (`src/renderer/vtk-helpers.ts:84-90`). The `setInputConnection` / `addInputConnection` calls may need an explicit `.update()` call on the sources, or the wiring may need to use `setInputData` with the source output instead.

4. **Fix the `releaseGraphicsResources` null errors** in the cleanup/dispose logic. Add null checks in `disposePipeline()` before calling `.delete()`, and guard against double-dispose in the component unmount handlers.

### Medium priority

5. **Improve the "page loads without console errors" test** to filter out known non-critical warnings (e.g., React DevTools suggestion, WebGL driver performance hints) so it focuses on genuine application errors.

6. **Add a visible error state** to the app -- when the React root has no content, the user sees only a dark gradient with no indication of what went wrong. Consider a top-level error boundary that displays a diagnostic message.

7. **The screenshot script** (`tools/screenshot-app.ts`) is ready but produces identical dark screenshots for all 4 states since the app does not render. Once the VTK.js crash is fixed, the script should capture meaningful differentiated views.
