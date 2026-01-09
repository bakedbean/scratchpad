# Scratchpad - Firefox Extension

A simple, synced scratchpad extension for Firefox that lets you quickly jot down notes that automatically sync across all your Firefox devices.

## Features

- **Clean Interface**: Full-screen textarea for distraction-free note-taking
- **Auto-Save**: Your notes are automatically saved as you type
- **Cross-Device Sync**: Notes sync across all your Firefox devices using Firefox Sync
- **Simple & Fast**: No login required, no configuration needed - just install and start typing

## Installation

### For Development/Personal Use

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`

2. Click "Load Temporary Add-on"

3. Navigate to the `scratchpad` folder and select the `manifest.json` file

4. The extension will be loaded and the Scratchpad icon will appear in your toolbar

### Making it Permanent

For development purposes, temporary add-ons are removed when Firefox restarts. To make it permanent:

**Option 1: Use Firefox Developer Edition or Nightly**
- Load the extension as a temporary add-on (it will persist across restarts in these versions)

**Option 2: Sign and install**
- Create an account at [addons.mozilla.org](https://addons.mozilla.org)
- Submit your extension for signing (you can mark it as "unlisted" for personal use)
- Once signed, install the .xpi file

## Usage

1. Click the Scratchpad icon in your Firefox toolbar
2. A new tab will open with a blank textarea
3. Start typing - your content will automatically save
4. Open Scratchpad on any other Firefox device signed into the same Firefox Account to see your synced notes

## How Sync Works

The extension uses Firefox's `storage.sync` API, which:
- Automatically syncs data across devices signed into the same Firefox Account
- Works just like bookmark sync - no additional setup required
- Updates in real-time when changes are detected from other devices

## Technical Details

- **Manifest Version**: 2 (Firefox standard)
- **Permissions**: `storage` (for sync functionality)
- **Storage API**: `browser.storage.sync`
- **Auto-save Delay**: 500ms after typing stops

## Files

- `manifest.json` - Extension configuration
- `background.js` - Handles opening scratchpad tabs
- `scratchpad.html` - Main scratchpad interface
- `scratchpad.css` - Styling
- `scratchpad.js` - Save/load functionality with sync
- `icons/` - Extension icons

## Privacy

- All data is stored locally and synced through your Firefox Account
- No external servers or third-party services are used
- No tracking or analytics

## License

Free to use and modify for personal use.
