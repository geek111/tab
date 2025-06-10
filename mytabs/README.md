# KepiTAB

This is an open source Firefox add-on inspired by the features of **All Tabs Helper**.

## Features

- The popup shows tabs from the current window, while the Full View lists tabs from all windows with fuzzy filtering by title or URL.
- Shows a **Recent** panel using an LRU buffer.
- Highlights duplicate tabs and provides a dedicated **Duplicates** view.
- Visited tabs appear in **bold** while unvisited tabs are dimmed, making new pages easy to spot.
- Double click a tab to search its page content and highlight results.
- Perform bulk operations (close, reload, unload, move) on selected tabs, and a
  command to unload all tabs at once. The keyboard shortcut for this command can
  be configured on the Options page.
- Each tab row includes a button to quickly close that tab.
- Tabs can be reordered via drag and drop, including moving multiple selected tabs at once.
- A **Full View** window shows tabs in multiple columns filled top-to-bottom.
  - Custom context menu reveals extension version and links to the Options page.
  - The mouse wheel scrolls the tab list even when the pointer is over the menu or search field.
  - Scroll speed can be adjusted from the Options page to make scrolling more aggressive.
  - Hovering a tab's icon in Full View shows a custom tooltip with the tab title and URL.
- Options page lets you choose theme, tile width, tile scale, font scale and close button scale and toggle features such as
  the Recent and Duplicates panels or the Move command.
- The Close Button Scale adjusts the “×” size independent of the font scale.
- A dark theme can also be enabled from the options page.
- Keyboard shortcuts open the popup, sidebar and full view and can be changed from the Options page.
- Default shortcuts:
  - **Alt+Shift+H** opens the popup.
  - **Alt+Shift+F** opens the Full View window.
  - **Alt+Shift+U** unloads all tabs.
- Middle-clicking the toolbar icon opens the Full View window.

## Keyboard Shortcuts

- **Ctrl+A** – select all visible tabs
- **C** – close selected tabs
- **R** – reload selected tabs
- **U** – unload selected tabs (Shift+U unloads all tabs)
- **M** – move selected tabs to another window

To install for development, load the directory as a temporary add-on in Firefox.

## License

This example is provided under the MIT license.
