# Changelog

All notable changes to this project are documented here.

## 1.1.15 - 2025-12-04
- Recent: Improved interaction with bulk unloading so that tabs currently visible (active) in Firefox are no longer removed from the Recent list when using **Unload All Tabs**; only successfully discarded background tabs are removed.
- Unload: Single-tab and bulk unload actions now consistently clear discarded tabs from Recent/visited, keeping counters and highlighting in sync with the actual discarded state.
- UI: Pressing `Ctrl+0` now resets only the zoom/scale settings for the tab UI (tile scale, font scale and close button scale) back to their built‑in defaults, mirroring Firefox's zoom reset behavior without changing theme, tile width or other options.

  Files touched: `background.js`, `theme.js`.

## 1.1.14 - 2025-11-17
- Popup: Reworked tab reordering in popup mode to use a mouse-based drag-and-drop handler, so dragging no longer behaves like text selection and works consistently across platforms.
- Popup: Stabilized hover behavior by avoiding background-triggered list rebuilds while the cursor is over the tab list, reducing flicker when tabs update.
- Popup: Removed the excessive bottom padding reserved for bulk actions in `#tabs-wrapper`, eliminating the large empty gap at the bottom when scrolling to the end of the list.

  Files touched: `popup.js`, `style.css`.

## 1.1.13 - 2025-11-10
- Popup: Added full drag-resize support.
  - New resizer handles on right, bottom, top, left edges and bottom-right corner.
  - Width and height can be adjusted independently; size persists across sessions (`storage.local.popupSize`).
  - Popup layout adapts on-the-fly (menu wraps, list height recalculated via `--popup-max-height`).
  - Smoother resizing from left/top edges (uses screen coordinates to avoid jitter).
  - Reliable finish of resizing even if the mouse is released outside the popup (pointer capture + safety checks).
  - Removed hard width cap for popup; respects Firefox’s inherent popup limits.
  
  Files touched: `popup.html`, `popup.js`, `style.css`.

- Fix: Popup "All" view Active counter now matches "Recent" by counting visited tabs in the current scope; stays in sync on unload/restore events.
- Internal: Kept "Recent" semantics unchanged (Active reflects the number of items in Recent), ensuring consistent values across views.

<!-- merged into the 1.1.13 section above -->

## 1.1.11 - 2025-11-09
- Fix: When using Firefox’s built-in “Unload Tab”, the add-on now immediately reflects the change by clearing the tab’s visited state and refreshing the UI. This ensures counters and highlighting stay accurate. (Handled via `tabs.onUpdated` and `changeInfo.discarded`.)
- Recent: In Full View, window groups are now ordered by the first occurrence of their tabs in the Recent list (i.e., the window you viewed a tab in most recently appears first).
- Full View: Window headers now display a styled badge with the number of visible tabs in that window.
- Full View: The badge now shows "loaded/total" (e.g., 8/12), where "loaded" means not discarded.
- UI: Moved the window tab-count badge to the right edge of the header and reserved padding so the label stays centered without the badge overlapping the border.
- Full View: Per-window "loaded/total" badge updates live on tab open/close and discard/restore events — no need to reopen the window.
- Popup: The tab list and counters now update live on tab open/close and unload/restore, without reopening the popup.
- Recent: Prevents window headers showing "Window undefined" by falling back to a generic label when a window index isn't available.

## 1.1.10 - 2025-10-26
- Internal: UI/UX refinements in popup and full view.

## 1.1.9 - 2025-10-25
- Internal: Minor stability improvements and code cleanup.

## 1.1.8 - 2025-10-24
- Internal: Maintenance release.
