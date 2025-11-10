# Changelog

All notable changes to this project are documented here.

## 1.1.12 - 2025-11-10
- Fix: Popup "All" view Active counter now matches "Recent" by counting visited tabs in the current scope; stays in sync on unload/restore events.
- Internal: Kept "Recent" semantics unchanged (Active reflects the number of items in Recent), ensuring consistent values across views.

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
