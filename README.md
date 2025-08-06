# KepiTAB Manager

This project now supports Chromium-based browsers. Container-related actions still rely on Firefox's container feature and the `contextualIdentities` permission. If containers are unavailable, the container filter and "Add to Container" buttons are hidden. Pinned and active tabs keep their state and order when moved between windows or containers.

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
