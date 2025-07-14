# AI Agent Instructions

This document provides instructions for AI agents working on this project.

## Project Overview

This project is a Chrome and Firefox extension. The codebase includes manifest files, localized messages, icons, and scripts for the extension's popup and options pages.

## Development Setup

1.  **Project Structure**:
    *   `manifest.json`: Extension manifest file.
    *   `popup/`: Contains the UI and logic for the extension's popup.
    *   `options/`: Contains the UI and logic for the options page.
    *   `_locales/`: Contains localization files for different languages.
    *   `icons/`: Contains the extension's icons.
    *   `tests/`: Containt the jest tests

2.  **Development Workflow**:
    *   To test the extension, load it as a temporary add-on in Firefox via `about:debugging`.
    *   Select the `manifest.json` file to load the extension.
    *   After making changes to the code, reload the extension in `about:debugging` to see the updates.

## Contribution Guidelines

### Git Commit Messages

This project follows the [Conventional Commit](https://www.conventionalcommits.org/) format for commit messages. Please adhere to this format when committing changes.

**Commit Message Structure**:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

*   **type**: The type of change (e.g., `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`).
*   **scope** (optional): The part of the codebase affected by the change.
*   **description**: A short, imperative summary of the change.

**Example**:

```
feat: add user login functionality
```

### Code Style and Quality

*   Keep your code clean, readable, and well-documented.
*   Update documentation and translations as needed to reflect your changes.
*   Cover new features with jest tests

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

To package the extension for distribution, create a zip archive of the project files, excluding any development-specific files (e.g., `.git`, local configurations). Submit the zip file to the [Firefox Add-ons](https://addons.mozilla.org/) platform.

## License

For information about the project's license, please see the `LICENSE` file.
