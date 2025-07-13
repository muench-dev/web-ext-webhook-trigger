# muench-dev Webhook Trigger Browser Extension

This browser extension allows you to manage and trigger webhooks directly from your browser. It works with both Firefox and Chrome. It is designed for users who want to quickly send HTTP requests (webhooks) to custom endpoints, such as automation services, APIs, or personal scripts.

## Features

- **Manage Webhooks**: Add, edit, and remove webhook URLs from the extension options page.
- **Reorder Webhooks**: Arrange your hooks via drag-and-drop on the options page.
- **Trigger Webhooks**: Quickly trigger any configured webhook from the popup menu.
- **Customizable**: Supports multiple webhooks with custom names and endpoints.
- **Persistent Storage**: All webhooks are stored locally in your browser and persist across sessions.
- **Localization**: Available in multiple languages (see `_locales/`).

## Getting Started

1. **Install the Extension**
   - **Firefox**: The extension is currently under review by the Firefox team and will be available on [addons.mozilla.org](https://addons.mozilla.org) soon. In the meantime, you can load the extension in Firefox via `about:debugging`.
   - **Chrome**: The extension is available on the [Chrome Web Store](https://chromewebstore.google.com/detail/webhook-trigger/finanbjnojdckpeklepocgcngcikdlfe). You can also load the extension in Chrome via `chrome://extensions` in developer mode by clicking "Load unpacked" and selecting the extension directory.

2. **Open the Options Page**
   - Right-click the extension icon and select "Options", or open it from the extension's popup menu.

## Managing Webhooks

![Options Page Screenshot](./docs/images/options.png)

### Add a Webhook
1. Go to the options page (`Options` in the extension menu).
2. Enter a name and the webhook URL in the provided fields.
3. Click the "Add" button to save the webhook.

### Edit a Webhook
1. On the options page, find the webhook you want to edit.
2. Click the "Edit" button next to the webhook.
3. Update the name or URL as needed.
4. Click "Save" to apply changes.

### Delete a Webhook
1. On the options page, find the webhook you want to remove.
2. Click the "Delete" button next to the webhook.

## Triggering Webhooks

![Popup Page Screenshot](./docs/images/popup.png)

1. Click the extension icon in your browser's toolbar to open the popup.
2. Select the webhook you want to trigger from the list.
3. Click the "Send" or equivalent button to trigger the webhook.

## Localization

- The extension supports multiple languages. To contribute translations, edit the files in the `_locales/` directory.

## Development

- All source code is located in the respective folders:
  - `options/` for the options page
  - `popup/` for the popup UI
  - `_locales/` for translations
- The manifest file is `manifest.json`.

## License

This project is licensed under the MIT License.
