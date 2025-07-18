const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  readFilesAsBuffer: (paths) => ipcRenderer.invoke('read-files-as-buffer', paths)
});

window.addEventListener('DOMContentLoaded', () => {
    console.log("✅ Preload script loaded");
});
