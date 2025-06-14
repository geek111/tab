# KepiTAB

This repository contains the source code for **KepiTAB**, a simple Firefox extension for managing open tabs. The add-on provides quick filtering, duplicate detection, a full multi-column view and optional dark theme. The popup lists tabs from the current window while the full view shows tabs from every open Firefox window. Multiple selected tabs can be dragged together to any position. A keyboard shortcut can unload all open tabs to free memory. The options page allows toggling features like the Recent and Duplicates panels and lets you set the tile width plus independent tile, font and close button scaling used in the full view. You can also customize the shortcuts for opening the popup, opening the full view and unloading all tabs. The close button scale adjusts the × button size separately from the font scale. Visited tabs appear bold while unvisited tabs are dimmed. See the `mytabs` directory for the extension files.
Container-related actions require Firefox's container feature and the `contextualIdentities` permission. If containers are disabled, the container filter and "Add to Container" buttons will not be shown. Pinned and active tabs keep their state and order when moved between windows or containers.

## Development

Install dev dependencies and run the linter to check both the
stylesheet and JavaScript files. Stylelint configuration is stored in
`.stylelintrc.json` and uses the `stylelint-order` plugin. ESLint is
configured in `.eslintrc.json`. Run `npm install` before executing
`npm run lint`.

```bash
npm install
npm run lint
```
