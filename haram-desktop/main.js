// main.js — load HaramBlur into the same session as the <webview>
const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const EXT_PATH = path.resolve(__dirname, '..', 'HaramBlur');   // -> F:\Haram\HaramBlur
const HB_PARTITION = 'persist:haramblur';
let hbSession = null;
let extId = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'HaramBlur Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
      devTools: true
    }
  });

  // auto-open devtools for the webview so you can inspect content scripts
//   win.webContents.on('did-attach-webview', (_e, wc) => wc.openDevTools());

  win.loadFile(path.join(__dirname, 'index.html'));
}

async function loadHB() {
  if (!hbSession) throw new Error('hbSession not ready');
  try {
    console.log('Loading extension from:', EXT_PATH);
    const ext = await hbSession.loadExtension(EXT_PATH, { allowFileAccess: true });
    console.log('Loaded extension in', HB_PARTITION, ':', ext.name, ext.version, ext.id);
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

app.whenReady().then(async () => {
  hbSession = session.fromPartition(HB_PARTITION);

  // sanity logs
  console.log('EXT_PATH:', EXT_PATH);
  console.log('manifest exists?', fs.existsSync(path.join(EXT_PATH, 'manifest.json')));

  try {
    const ext = await hbSession.loadExtension(EXT_PATH, { allowFileAccess: true });
    console.log('Loaded extension in', HB_PARTITION, ':', ext.name, ext.version, ext.id);
    extId = ext.id;
  } catch (e) {
    console.error('Failed to load HaramBlur extension:', e);
    dialog.showErrorBox('HaramBlur load error', String(e));
  }

  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// simple IPC so the UI toggle can reload/unload the extension
ipcMain.handle('hb:get', () => ({ on: !!extId, path: EXT_PATH }));
ipcMain.handle('hb:set', async (_e, on) => {
  if (on && !extId) await loadHB();
  if (!on && extId) await unloadHB();   
  return { on: !!extId };
});

// open the extension popup (settings)
ipcMain.handle('hb:openSettings', async () => {
  if (!extId) return false; // extension must be loaded

  const parent = BrowserWindow.getFocusedWindow();
  const win = new BrowserWindow({
    width: 420,
    height: 560,
    title: 'HaramBlur — Settings',
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent,
    modal: false,
    webPreferences: {
      // IMPORTANT: same session/partition as the extension
      partition: HB_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.removeMenu?.();

  const url = `chrome-extension://${extId}/src/popup.html`;
  await win.loadURL(url);
  return true;
});

