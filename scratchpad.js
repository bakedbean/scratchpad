const textarea = document.getElementById('scratchpad');
const statusDiv = document.getElementById('status');
const lastUpdateDiv = document.getElementById('lastUpdate');
const refreshBtn = document.getElementById('refreshBtn');

let saveTimeout;
const SAVE_DELAY = 500; // milliseconds to wait after typing stops before saving
const AUTO_SAVE_INTERVAL = 5000; // auto-save every 5 seconds
const SYNC_CHECK_INTERVAL = 10000; // check for sync updates every 10 seconds
let storageArea = null; // Will be set to either 'sync' or 'local'
let usingSyncStorage = false;
let lastSavedContent = ''; // Track last saved content
let contentChanged = false; // Track if content has changed since last save
let autoSaveInterval = null; // Interval for periodic auto-save
let syncCheckInterval = null; // Interval for checking sync updates

// Detect which storage to use
async function initStorage() {
  try {
    // Try to use sync storage first
    await browser.storage.sync.set({ scratchpadTest: 'test' });
    await browser.storage.sync.remove('scratchpadTest');
    storageArea = browser.storage.sync;
    usingSyncStorage = true;
    console.log('Using sync storage');
  } catch (error) {
    // Fall back to local storage if sync fails
    console.warn('Sync storage not available, falling back to local storage:', error);
    storageArea = browser.storage.local;
    usingSyncStorage = false;
    console.log('Using local storage');
  }
}

// Update last update timestamp
function updateLastUpdateTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  lastUpdateDiv.textContent = `Updated: ${timeStr}`;
}

// Load saved content when page opens
async function loadContent() {
  try {
    if (!storageArea) {
      await initStorage();
    }

    const result = await storageArea.get('scratchpadContent');
    if (result.scratchpadContent) {
      textarea.value = result.scratchpadContent;
      lastSavedContent = result.scratchpadContent;
      console.log(`Loaded ${result.scratchpadContent.length} characters from storage`);
    }
    contentChanged = false;
    updateStatus('loaded');
    updateLastUpdateTime();
  } catch (error) {
    console.error('Error loading content:', error);
    updateStatus('error', error.message);
  }
}

// Save content to storage
async function saveContent() {
  // Only save if content has actually changed
  if (textarea.value === lastSavedContent) {
    console.log('Content unchanged, skipping save');
    return;
  }

  updateStatus('saving');
  try {
    if (!storageArea) {
      await initStorage();
    }

    await storageArea.set({
      scratchpadContent: textarea.value
    });
    lastSavedContent = textarea.value;
    contentChanged = false;
    updateStatus('saved');
    updateLastUpdateTime();
    console.log(`Saved ${textarea.value.length} characters to ${usingSyncStorage ? 'sync' : 'local'} storage`);
  } catch (error) {
    console.error('Error saving content:', error);
    updateStatus('error', error.message);
  }
}

// Update status indicator
function updateStatus(status, message = '') {
  statusDiv.className = 'status';

  switch (status) {
    case 'saving':
      statusDiv.textContent = 'Saving...';
      statusDiv.classList.add('saving');
      break;
    case 'saved':
      const storageType = usingSyncStorage ? 'Synced' : 'Saved';
      statusDiv.textContent = storageType;
      statusDiv.classList.add('saved');
      // Reset to neutral status after 2 seconds
      setTimeout(() => {
        if (statusDiv.textContent === storageType) {
          updateStatus('ready');
        }
      }, 2000);
      break;
    case 'loaded':
      const readyText = usingSyncStorage ? 'Ready (Synced)' : 'Ready (Local)';
      statusDiv.textContent = readyText;
      break;
    case 'ready':
      statusDiv.textContent = usingSyncStorage ? 'Ready (Synced)' : 'Ready (Local)';
      break;
    case 'error':
      statusDiv.textContent = message ? `Error: ${message}` : 'Error';
      statusDiv.style.backgroundColor = '#f8d7da';
      statusDiv.style.color = '#721c24';
      break;
  }
}

// Debounced save function - saves after user stops typing
function debouncedSave() {
  contentChanged = true;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveContent();
  }, SAVE_DELAY);
}

// Listen for changes in the textarea
textarea.addEventListener('input', debouncedSave);

// Handle refresh button click
refreshBtn.addEventListener('click', async () => {
  console.log('Manual refresh triggered');
  refreshBtn.disabled = true;
  refreshBtn.textContent = '⟳ Refreshing...';

  await checkForSyncUpdates();

  setTimeout(() => {
    refreshBtn.disabled = false;
    refreshBtn.textContent = '↻ Refresh';
  }, 500);
});

// Listen for storage changes from other tabs/devices
browser.storage.onChanged.addListener((changes, areaName) => {
  const relevantArea = usingSyncStorage ? 'sync' : 'local';
  console.log(`Storage change event: area=${areaName}, relevant=${relevantArea}`, changes);

  if (areaName === relevantArea && changes.scratchpadContent) {
    const newValue = changes.scratchpadContent.newValue || '';
    console.log(`Storage changed: ${newValue.length} chars`);

    // Only update if the content is different from what's currently in the textarea
    if (newValue !== textarea.value) {
      console.log('⚡ Real-time sync update detected');
      const cursorPosition = textarea.selectionStart;
      textarea.value = newValue;
      lastSavedContent = newValue;
      contentChanged = false;
      // Try to restore cursor position if possible
      textarea.setSelectionRange(cursorPosition, cursorPosition);
      updateLastUpdateTime();
    }
  }
});

// Periodic auto-save - saves every 5 seconds if content has changed
function startAutoSave() {
  autoSaveInterval = setInterval(() => {
    if (contentChanged && textarea.value !== lastSavedContent) {
      saveContent();
    }
  }, AUTO_SAVE_INTERVAL);
}

// Periodic sync check - checks for updates from other devices every 10 seconds
async function checkForSyncUpdates() {
  try {
    if (!storageArea) {
      console.log('Storage not initialized yet');
      return;
    }

    const result = await storageArea.get('scratchpadContent');
    const storedContent = result.scratchpadContent || '';

    console.log(`Sync check: stored=${storedContent.length} chars, current=${textarea.value.length} chars, lastSaved=${lastSavedContent.length} chars`);

    // Only update if stored content is different from current textarea
    // and different from what we last saved (to avoid overwriting user's typing)
    if (storedContent !== textarea.value && storedContent !== lastSavedContent) {
      // Check if user is currently typing (has made changes since last save)
      const userIsTyping = contentChanged;

      console.log(`Content differs! User typing: ${userIsTyping}`);

      if (!userIsTyping) {
        // Safe to update - user isn't actively typing
        const cursorPosition = textarea.selectionStart;
        textarea.value = storedContent;
        lastSavedContent = storedContent;
        contentChanged = false;
        // Try to restore cursor position
        textarea.setSelectionRange(cursorPosition, cursorPosition);
        updateLastUpdateTime();
        console.log(`✓ Pulled ${storedContent.length} characters from storage`);
      } else {
        console.log('⚠ Update available but user is typing - deferring update');
      }
    } else if (storedContent === textarea.value) {
      console.log('✓ Content in sync');
    } else {
      console.log('Content matches last saved version');
    }
  } catch (error) {
    console.error('Error checking for sync updates:', error);
  }
}

function startSyncCheck() {
  syncCheckInterval = setInterval(() => {
    checkForSyncUpdates();
  }, SYNC_CHECK_INTERVAL);
}

// Clean up intervals when page is closed
window.addEventListener('beforeunload', () => {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }
  if (syncCheckInterval) {
    clearInterval(syncCheckInterval);
  }
  // Do a final save if there are unsaved changes
  if (contentChanged && textarea.value !== lastSavedContent) {
    saveContent();
  }
});

// Load content when page opens
loadContent();

// Start the periodic auto-save
startAutoSave();

// Start periodic sync checking
startSyncCheck();
