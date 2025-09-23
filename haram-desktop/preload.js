// preload.js — safe bridge
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hb', {
  get: () => ipcRenderer.invoke('hb:get'),
  set: (on) => ipcRenderer.invoke('hb:set', on),
  openSettings: () => ipcRenderer.invoke('hb:openSettings'),
  pickMedia: () => ipcRenderer.invoke('hb:pickMedia') ,
    onOpenMedia: (cb) => ipcRenderer.on('hb:openMedia', (_e, url) => cb?.(url)), // NEW

  
});
