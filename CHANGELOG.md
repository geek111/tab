# Changelog

All notable changes to this project are documented here.

## 1.1.11 - 2025-11-09
- Fix: When using Firefox’s built-in “Unload Tab”, the add-on now immediately reflects the change by clearing the tab’s visited state and refreshing the UI. This ensures counters and highlighting stay accurate. (Handled via `tabs.onUpdated` and `changeInfo.discarded`.)
- Recent: In Full View, window groups are now ordered by the first occurrence of their tabs in the Recent list (i.e., the window you viewed a tab in most recently appears first).

## 1.1.10 - 2025-10-26
- Internal: UI/UX refinements in popup and full view.

## 1.1.9 - 2025-10-25
- Internal: Minor stability improvements and code cleanup.

## 1.1.8 - 2025-10-24
- Internal: Maintenance release.
