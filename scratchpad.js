const scratchpad = document.getElementById('scratchpad');
const statusDiv = document.getElementById('status');
const lastUpdateDiv = document.getElementById('lastUpdate');
const refreshBtn = document.getElementById('refreshBtn');
const linkBtn = document.getElementById('linkBtn');
const toolbarBtns = document.querySelectorAll('.toolbar-btn');

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

// Sanitize URL to prevent XSS attacks
function sanitizeURL(url) {
  if (!url) return '';

  // Remove whitespace
  url = url.trim();

  // Only allow http, https, mailto, and tel protocols
  const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];

  try {
    const parsed = new URL(url);
    if (allowedProtocols.includes(parsed.protocol)) {
      return url;
    }
  } catch (e) {
    // If URL parsing fails, assume it's a relative URL or domain without protocol
    // Add https:// if it looks like a domain
    if (url.match(/^[a-zA-Z0-9][a-zA-Z0-9-._]*\.[a-zA-Z]{2,}/)) {
      return 'https://' + url;
    }
  }

  // Block dangerous protocols like javascript:, data:, file:, etc.
  return '';
}

// Sanitize HTML to only allow safe formatting tags
function sanitizeHTML(html) {
  // Use DOMParser to safely parse HTML without innerHTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Allowed tags for formatting
  const allowedTags = ['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BR', 'DIV', 'P', 'SPAN', 'A'];

  // Recursively sanitize nodes
  function sanitizeNode(node) {
    // If it's a text node, keep it
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }

    // If it's an element node
    if (node.nodeType === Node.ELEMENT_NODE) {
      // Only allow specific tags
      if (!allowedTags.includes(node.tagName)) {
        // For disallowed tags, just return their text content
        return document.createTextNode(node.textContent);
      }

      // Create a clean version of the allowed element
      const cleanNode = document.createElement(node.tagName);

      // Special handling for <a> tags - allow href but sanitize it
      if (node.tagName === 'A') {
        const href = node.getAttribute('href');
        const sanitizedHref = sanitizeURL(href);

        if (sanitizedHref) {
          cleanNode.setAttribute('href', sanitizedHref);
          cleanNode.setAttribute('target', '_blank');
          cleanNode.setAttribute('rel', 'noopener noreferrer');
        } else {
          // If href is unsafe, convert to plain text
          return document.createTextNode(node.textContent);
        }
      }

      // Recursively sanitize children
      for (const child of node.childNodes) {
        const sanitizedChild = sanitizeNode(child);
        if (sanitizedChild) {
          cleanNode.appendChild(sanitizedChild);
        }
      }

      return cleanNode;
    }

    return null;
  }

  // Sanitize all children from the body
  const fragment = document.createDocumentFragment();
  for (const child of doc.body.childNodes) {
    const sanitizedChild = sanitizeNode(child);
    if (sanitizedChild) {
      fragment.appendChild(sanitizedChild);
    }
  }

  return fragment;
}

// Get content from editor as HTML string
function getContent() {
  // Serialize DOM to string without using innerHTML
  const serializer = new XMLSerializer();
  let html = '';
  for (const child of scratchpad.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      html += child.textContent;
    } else {
      html += serializer.serializeToString(child);
    }
  }
  return html;
}

// Set content in editor (with sanitization)
function setContent(html) {
  const sanitizedFragment = sanitizeHTML(html);
  // Use replaceChildren instead of innerHTML
  scratchpad.replaceChildren(sanitizedFragment);
}

// Load saved content when page opens
async function loadContent() {
  try {
    if (!storageArea) {
      await initStorage();
    }

    const result = await storageArea.get('scratchpadContent');
    if (result.scratchpadContent) {
      setContent(result.scratchpadContent);
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
  const currentContent = getContent();

  // Only save if content has actually changed
  if (currentContent === lastSavedContent) {
    console.log('Content unchanged, skipping save');
    return;
  }

  updateStatus('saving');
  try {
    if (!storageArea) {
      await initStorage();
    }

    await storageArea.set({
      scratchpadContent: currentContent
    });
    lastSavedContent = currentContent;
    contentChanged = false;
    updateStatus('saved');
    updateLastUpdateTime();
    console.log(`Saved ${currentContent.length} characters to ${usingSyncStorage ? 'sync' : 'local'} storage`);
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

// Execute formatting command
function executeCommand(command) {
  document.execCommand(command, false, null);
  scratchpad.focus();
  contentChanged = true;
}

// Create a hyperlink
function createLink() {
  // Get selected text
  const selection = window.getSelection();
  const selectedText = selection.toString();

  // Prompt for URL
  let url = prompt('Enter URL:', selectedText.match(/^https?:\/\//) ? selectedText : 'https://');

  if (url) {
    // Sanitize the URL
    url = sanitizeURL(url);

    if (url) {
      // Create the link
      document.execCommand('createLink', false, url);

      // Find the newly created link and add security attributes
      const links = scratchpad.querySelectorAll('a[href]:not([target])');
      links.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      });

      scratchpad.focus();
      contentChanged = true;
    } else {
      alert('Invalid URL. Please use http://, https://, mailto:, or tel: URLs.');
    }
  }
}

// Handle keyboard shortcuts
scratchpad.addEventListener('keydown', (e) => {
  // Ctrl+B for bold
  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault();
    executeCommand('bold');
  }
  // Ctrl+I for italic
  else if (e.ctrlKey && e.key === 'i') {
    e.preventDefault();
    executeCommand('italic');
  }
  // Ctrl+U for underline
  else if (e.ctrlKey && e.key === 'u') {
    e.preventDefault();
    executeCommand('underline');
  }
  // Ctrl+K for link
  else if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    createLink();
  }
});

// Listen for changes in the editor
scratchpad.addEventListener('input', debouncedSave);

// Handle clicks on links - open them in new tabs
scratchpad.addEventListener('click', (e) => {
  // Check if clicked element is a link or inside a link
  const link = e.target.closest('a[href]');

  if (link) {
    e.preventDefault();
    const href = link.getAttribute('href');

    // Sanitize the URL before opening
    const sanitizedHref = sanitizeURL(href);

    if (sanitizedHref) {
      window.open(sanitizedHref, '_blank', 'noopener,noreferrer');
    }
  }
});

// Handle toolbar button clicks
toolbarBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const command = btn.dataset.command;
    if (command) {
      executeCommand(command);
    }
  });
});

// Handle link button click
linkBtn.addEventListener('click', (e) => {
  e.preventDefault();
  createLink();
});

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

    // Only update if the content is different from what's currently in the editor
    if (newValue !== getContent()) {
      console.log('⚡ Real-time sync update detected');
      setContent(newValue);
      lastSavedContent = newValue;
      contentChanged = false;
      updateLastUpdateTime();
    }
  }
});

// Periodic auto-save - saves every 5 seconds if content has changed
function startAutoSave() {
  autoSaveInterval = setInterval(() => {
    if (contentChanged && getContent() !== lastSavedContent) {
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
    const currentContent = getContent();

    console.log(`Sync check: stored=${storedContent.length} chars, current=${currentContent.length} chars, lastSaved=${lastSavedContent.length} chars`);

    // Only update if stored content is different from current editor
    // and different from what we last saved (to avoid overwriting user's typing)
    if (storedContent !== currentContent && storedContent !== lastSavedContent) {
      // Check if user is currently typing (has made changes since last save)
      const userIsTyping = contentChanged;

      console.log(`Content differs! User typing: ${userIsTyping}`);

      if (!userIsTyping) {
        // Safe to update - user isn't actively typing
        setContent(storedContent);
        lastSavedContent = storedContent;
        contentChanged = false;
        updateLastUpdateTime();
        console.log(`✓ Pulled ${storedContent.length} characters from storage`);
      } else {
        console.log('⚠ Update available but user is typing - deferring update');
      }
    } else if (storedContent === currentContent) {
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
  if (contentChanged && getContent() !== lastSavedContent) {
    saveContent();
  }
});

// Load content when page opens
loadContent();

// Start the periodic auto-save
startAutoSave();

// Start periodic sync checking
startSyncCheck();
