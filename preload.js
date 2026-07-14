const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcherAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  scanMasterFolder: (path) => ipcRenderer.invoke('scan-master-folder', path), // NEW
  getPatches: () => ipcRenderer.invoke('get-patches'), 
  executeLaunch: (payload) => ipcRenderer.send('execute-launch', payload),
  onStatusChange: (callback) => ipcRenderer.on('status-change', (event, msg) => callback(msg)),
  getRecentPath: () => ipcRenderer.invoke('get-recent-path'),
  saveRecentPath: (targetPath) => ipcRenderer.send('save-recent-path', targetPath),
  killGame: () => ipcRenderer.send('kill-game'),
  onGameKilled: (callback) => ipcRenderer.on('game-killed', () => callback())
});