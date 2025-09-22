(() => {
  try {
    if (!chrome?.storage?.sync && chrome?.storage?.local) {
      chrome.storage.sync = chrome.storage.local;
      console.warn('[HB] storage.sync -> storage.local (polyfill)');
    }
  } catch (_) {}
})();
