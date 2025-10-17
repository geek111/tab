# KepiTAB Manager

Container-related actions require Firefox's container feature and the `contextualIdentities` permission. Starting with version 0.3 the extension also needs the `cookies` permission so tabs can be opened in a different container. If containers are disabled, the container filter and "Add to Container" buttons will not be shown. Pinned and active tabs keep their state and order when moved between windows or containers. The Manifest V3 background service worker requires Firefox 140 or newer.

## Development

Install dev dependencies and run Stylelint to check the stylesheet.
Configuration is stored in `.stylelintrc.json` and uses the
`stylelint-order` plugin. Before running the linter, execute
`npm install` and then run `npm run lint`.

```bash
npm install
npm run lint
```

## License

This project is licensed under the GNU General Public License v3.0 or later.
