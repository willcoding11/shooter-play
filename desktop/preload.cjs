// Small bridge for the start screen, and a flag the game uses to know it runs inside the app.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shooterApp', {
  desktop: true,
  defaults: () => ipcRenderer.invoke('defaults'),
  go: (url) => ipcRenderer.send('go', url),
  relink: () => ipcRenderer.send('relink'),       // game: server unreachable, look for a newer link
  openPage: () => ipcRenderer.send('open-page'),  // the GitHub Pages site (downloads)
});
