// main.js — HaramBlur Desktop with file-association open support

const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('node:url');

const HB_PARTITION = 'persist:haramblur';
const isDev = !app.isPackaged;
const EXT_PATH = isDev
  ? path.resolve(__dirname, '..', 'HaramBlur')
  : path.join(process.resourcesPath, 'HaramBlur');

let hbSession = null;
let extId = null;
let mainWin = null;

// Which extensions we will accept when launched by double-click
const IMAGE_EXTS = ['.jpg','.jpeg','.png','.webp','.gif','.bmp'];
const VIDEO_EXTS = ['.mp4','.webm','.ogg','.mov','.m4v'];
const ALL_EXTS = new Set([...IMAGE_EXTS, ...VIDEO_EXTS]);

function toFileUrl(p) {
  try { return pathToFileURL(p).toString(); } catch { return null; }
}

function sendOpenUrlToRenderer(fileUrl) {
  if (!fileUrl) return;
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('hb:openMedia', fileUrl);
    mainWin.show(); mainWin.focus();
  } else {
    // If window not created yet, defer until it is
    pendingUrls.push(fileUrl);
  }
}

function handleArgv(argv) {
  // Extract valid file paths from argv and send the first one
  const candidates = argv
    .filter(a => typeof a === 'string')
    .map(a => a.replace(/^"|"$/g, '')) // strip quotes
    .filter(a => fs.existsSync(a) && ALL_EXTS.has(path.extname(a).toLowerCase()));

  if (candidates.length) {
    const url = toFileUrl(candidates[0]);
    sendOpenUrlToRenderer(url);
  }
}

let pendingUrls = [];

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'HaramBlur Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
      devTools: true,
    },
  });

  mainWin.loadFile(path.join(__dirname, 'index.html'));

  // Flush any pending file URLs (e.g., app started by double-click)
  mainWin.webContents.on('did-finish-load', () => {
    for (const u of pendingUrls.splice(0)) {
      mainWin.webContents.send('hb:openMedia', u);
    }
  });

  mainWin.on('closed', () => (mainWin = null));
}

async function loadHB() {
  if (!hbSession) throw new Error('hbSession not ready');
  try {
    console.log('EXT_PATH:', EXT_PATH);
    console.log('manifest exists?', fs.existsSync(path.join(EXT_PATH, 'manifest.json')));
    const ext = await hbSession.loadExtension(EXT_PATH, { allowFileAccess: true });
    console.log('Loaded extension in persist:haramblur :', ext.name, ext.version, ext.id);
    extId = ext.id;
    return true;
  } catch (err) {
    console.error('Failed to load HaramBlur extension:', err);
    dialog.showErrorBox('HaramBlur load error', String(err));
    return false;
  }
}

async function unloadHB() {
  if (hbSession && extId) {
    await hbSession.removeExtension(extId);
    extId = null;
  }
  return false;
}

// Ensure single instance so new files route to the existing window
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', (_event, argv) => {
  // Another instance tried to run (e.g., user double-clicked a file)
  if (process.platform === 'win32') handleArgv(argv);
  if (mainWin) { mainWin.show(); mainWin.focus(); }
});

// macOS: opened by Finder
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  const url = toFileUrl(filePath);
  sendOpenUrlToRenderer(url);
});

app.whenReady().then(async () => {
  hbSession = session.fromPartition('persist:haramblur');
  await loadHB();
  createWindow();

  // If first launch included a file argument (Windows/Linux)
  if (process.platform !== 'darwin') handleArgv(process.argv);
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// IPC for UI toggle
ipcMain.handle('hb:get', () => ({ on: !!extId, path: EXT_PATH }));
ipcMain.handle('hb:set', async (_e, on) => {
  if (on && !extId) await loadHB();
  if (!on && extId) await unloadHB();
  return { on: !!extId };
});

// IPC: file picker (for the Open… button)
ipcMain.handle('hb:pickMedia', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Open image or video',
    properties: ['openFile'],
    filters: [
      { name: 'Media', extensions: [...IMAGE_EXTS.map(e=>e.slice(1)), ...VIDEO_EXTS.map(e=>e.slice(1))] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (res.canceled || !res.filePaths?.[0]) return null;
  return toFileUrl(res.filePaths[0]);
});

// IPC: open extension Settings popup
ipcMain.handle('hb:openSettings', async () => {
  if (!extId) return false;
  const parent = BrowserWindow.getFocusedWindow();
  const win = new BrowserWindow({
    width: 420, height: 560, title: 'HaramBlur — Settings',
    resizable: false, minimizable: false, maximizable: false, parent, modal: false,
    webPreferences: { partition: 'persist:haramblur', contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.removeMenu?.();
  await win.loadURL(`chrome-extension://${extId}/src/popup.html`);
  return true;
});
