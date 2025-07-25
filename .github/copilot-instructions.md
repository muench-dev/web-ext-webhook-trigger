# Firefox Extension Project Instructions

## Overview
This project is a Chrome and Firefox extension. The codebase includes manifest files, localized messages, icons, and scripts for the extension's popup and options pages.

## Getting Started
1. **Clone the repository:**
   ```sh
   git clone <repository-url>
   cd <project-directory>
   ```
2. **Review the project structure:**
   - `manifest.json`: Extension manifest file.
   - `popup/`: Popup UI and logic.
   - `options/`: Options page UI and logic.
   - `_locales/`: Localization files.
   - `icons/`: Extension icons.

## Development
1. **Edit code:**
   - Update HTML, CSS, or JS files in `popup/` or `options/` as needed.
   - Update `manifest.json` for permissions or features.
   - Add or update translations in `_locales/`.
   - Do not use Unsafe assignment to innerHTML.
2. **Test the extension:**
   - Open Firefox and go to `about:debugging#/runtime/this-firefox`.
   - Click "Load Temporary Add-on..." and select the `manifest.json` file.
   - Test your changes in the browser.
3. **Reload after changes:**
   - After editing files, reload the extension in `about:debugging` to see updates.

## Testing, Linting, and Building

- **Run tests:**
  ```sh
  npm test
  ```
- **Lint the code:**
  ```sh
  npm run lint
  ```
- **Build the extension:**
  ```sh
  npm run build
  ```

## Packaging
- To distribute, zip the extension files (excluding unnecessary files like `.git/` or local configs) and submit to [Firefox Add-ons](https://addons.mozilla.org/).

## Contributing
- Follow standard pull request and code review practices.
- Keep code readable and well-documented.
- Update documentation and translations as needed.

## License
See `LICENSE` for details.

