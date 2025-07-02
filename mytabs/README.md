# KepiTAB Manager

This is an open source Firefox add-on inspired by the features of **All Tabs Helper**.

## Features

- The popup shows tabs from the current window, while the Full View lists tabs from all windows with fuzzy filtering by title or URL.
- Shows a **Recent** panel listing all visited tabs.
- Highlights duplicate tabs and provides a dedicated **Duplicates** view.
- Visited tabs appear in **bold** while unvisited tabs are dimmed, making new pages easy to spot.
- Perform bulk operations (close, reload, unload, move) on selected tabs, and a
  command to unload all tabs at once. The keyboard shortcut for this command can
  be configured on the Options page.
- Each tab row includes a button to quickly close that tab.
- Smooth hover effects highlight each tab row for a polished interface.
- Animated view transitions make switching between the **All**, **Recent** and **Duplicates** panels seamless.
- Sticky menu gains a subtle shadow while scrolling for a professional look.
- Tab list edges fade in and out while scrolling to signal more content.
- Tabs can be reordered via drag and drop, including moving multiple selected tabs at once.
- Bulk assign selected tabs to any Firefox container or move them back to the default container.
- Pinned and active tabs retain their state and original order when moved between windows or containers.
- Optionally unloads inactive tabs automatically after a configurable delay.
- Container-related actions require Firefox's container feature and the `contextualIdentities` permission. If containers are disabled, the container filter and "Add to Container" buttons will not be shown.
- A **Full View** window shows tabs in a responsive grid that fills the entire window.
  - The number of columns adapts to the window size.
  - Custom context menu reveals extension version and links to the Options page.
  - The mouse wheel scrolls the tab list even when the pointer is over the menu or search field.
  - Typing with no input focused automatically fills the search box. Press **Escape** to clear it.
  - In Full View, overflowing columns can be scrolled horizontally with the mouse wheel.
    Trackpad gestures and horizontal wheels are supported.
  - Scroll speed can be adjusted from the Options page to make scrolling more aggressive.
  - Hold **Ctrl** and use the mouse wheel to change the interface scale. The selected scale is saved and reflected in the Options page.
  - Hovering a tab's icon in the popup or Full View shows a custom tooltip with the tab title and URL, truncated for brevity. If the tab belongs to a container, the tooltip also displays the container name.
  - The columns can extend wider than the window and a horizontal scrollbar appears when needed.
  - Tabs from each window are separated by labeled dividers with extra spacing for clarity.
  - A colored dot indicates the tab's container.
  - Options page lets you choose theme, tile width, tile scale, font scale, close button scale and the overall UI scale and toggle features such as
  the Recent and Duplicates panels, the Move command and automatic unloading of inactive tabs.
- The Close Button Scale adjusts the “×” size independent of the font scale.
- A dark theme can also be enabled from the options page.
- Animations can be disabled from the options page for a lightweight interface.
- Keyboard shortcuts open the popup, sidebar and full view and can be changed from the Options page.
  New shortcuts let you switch between the **All**, **Recent** and **Duplicates** views
  using **Shift+A**, **Shift+R** and **Shift+D** by default. These can be customized or disabled, and the inputs show the combination as you press the keys.
  in the Options page.
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
- **Alt** – deselect all tabs

To install for development, load the directory as a temporary add-on in Firefox.

This project is licensed under the GNU General Public License v3.0 or later. See LICENSE for details.
