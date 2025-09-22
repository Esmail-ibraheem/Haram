// background.js — Electron-safe

// 1) storage.sync → storage.local fallback (Electron has no sync)
try {
  if (!chrome?.storage?.sync && chrome?.storage?.local) {
    chrome.storage.sync = chrome.storage.local;
  }
} catch (_) {}


const defaultSettings = {
  status: true,
  blurryStartMode: false,
  blurAmount: 20,
  blurImages: true,
  blurVideos: true,
  blurMale: false,
  blurFemale: true,
  unblurImages: false,
  unblurVideos: false,
  gray: true,
  strictness: 0.5, // 0..1
  whitelist: [],
};

// 2) Ensure settings exist / merged on install or update
chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.sync.get(['hb-settings'], function (result = {}) {
    const cur = result['hb-settings'];
    if (cur == null) {
      chrome.storage.sync.set({ 'hb-settings': defaultSettings });
    } else {
      chrome.storage.sync.set({
        'hb-settings': { ...defaultSettings, ...cur },
      });
    }
  });
});

// 3) Offscreen document (guarded; Electron may not support offscreen)
const createOffscreenDoc = () => {
  try {
    if (chrome?.offscreen?.createDocument) {
      chrome.offscreen
        .createDocument({
          url: chrome.runtime.getURL('src/offscreen.html'),
          reasons: ['DOM_PARSER'],
          justification: 'Process Images',
        })
        .then(() => console.log('[HB] offscreen document created'))
        .catch((e) => console.warn('[HB] offscreen create failed:', e));
    } else {
      console.warn('[HB] offscreen API not available (ok in Electron).');
    }
  } catch (e) {
    console.warn('[HB] offscreen setup error:', e);
  }
};

createOffscreenDoc();

// 4) Messages (with safe contextMenus updates)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getSettings') {
    chrome.storage.sync.get(['hb-settings'], function (result = {}) {
      const cfg = result['hb-settings'] || defaultSettings;
      sendResponse(cfg);

      // Try to reflect video state in a checkbox menu (if supported)
      try {
        const isVideoEnabled = !!(cfg.status && cfg.blurVideos);
        chrome?.contextMenus?.update?.('enable-detection', {
          enabled: isVideoEnabled,
          checked: isVideoEnabled,
          title: isVideoEnabled
            ? 'Enabled for this video'
            : 'Please enable video detection in settings',
        });
      } catch (_) {}
    });
    return true; // async reply
  }

  if (request.type === 'video-status') {
    try {
      chrome?.contextMenus?.update?.('enable-detection', {
        checked: !!request.status,
      });
    } catch (_) {}
    return true;
  }

  if (request.type === 'reloadExtension') {
    try { chrome?.offscreen?.closeDocument?.(); } catch (_) {}
    createOffscreenDoc();
  }
});

// 5) Context menu (fully guarded so Electron won’t crash)
try {
  if (chrome?.contextMenus?.create) {
    chrome.contextMenus.removeAll?.(() => {
      chrome.contextMenus.create({
        id: 'enable-detection',
        title: 'Enable for this video',
        contexts: ['all'],
        type: 'checkbox',
        enabled: true,
        checked: true,
      });

      chrome.contextMenus.onClicked?.addListener((info, tab) => {
        if (info.menuItemId === 'enable-detection') {
          const msg = info.checked ? 'enable-detection' : 'disable-detection';
          chrome?.tabs?.sendMessage?.(tab?.id, { type: msg });
        }
        return true;
      });
    });
  } else {
    console.warn('[HB] contextMenus API not available (Electron). Skipping menu.');
  }
} catch (e) {
  console.warn('[HB] contextMenus init failed:', e);
}

// 6) Onboarding page (guard tabs)
chrome.runtime.onInstalled.addListener(function (details) {
  if (details?.reason === 'install') {
    try { chrome?.tabs?.create?.({ url: 'https://onboard.haramblur.com/' }); } catch (_) {}
  }
});

// 7) Uninstall survey (safe)
try { chrome.runtime.setUninstallURL('https://forms.gle/RovVrtp29vK3Z7To7'); } catch (_) {}
