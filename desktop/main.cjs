// Shooter desktop app: a plain window that shows the game, so Ctrl (sprint) + W can't close a browser tab.
// It finds the current game link by itself (link.json in the GitHub repo from config.json, published by the
// host's start.bat), follows the host to a new link when the old one stops working, and the game page
// reloads itself when the host updates the game. F11 fullscreen, F2 back to the link screen.
// Dev: npm run app   Build Shooter.exe: npm run app:build   All platforms: GitHub Actions (see site/README)
const { app, BrowserWindow, Menu, ipcMain, shell, net } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const CONFIG = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch { return {}; } })();
const REPO = CONFIG.repo || 'willcoding11/shooter-play';
const PAGE = `https://${REPO.split('/')[0]}.github.io/${REPO.split('/')[1]}/`;

const cfgFile = () => path.join(app.getPath('userData'), 'config.json');
const loadCfg = () => { try { return JSON.parse(fs.readFileSync(cfgFile(), 'utf8')); } catch { return {}; } };
const saveCfg = (c) => { try { fs.writeFileSync(cfgFile(), JSON.stringify(c)); } catch {} };

// a share-link.txt next to the app or in the project folder means this PC is the host
function hostLink() {
  const exeDir = path.dirname(process.execPath);
  for (const p of [path.join(exeDir, 'share-link.txt'), path.join(exeDir, '..', '..', 'share-link.txt'), path.join(__dirname, '..', 'share-link.txt')]) {
    try { const s = fs.readFileSync(p, 'utf8').trim(); if (/^https?:\/\//.test(s)) return s; } catch {}
  }
  return '';
}

async function getJson(url, headers = {}) {
  const r = await net.fetch(url, { headers: { 'User-Agent': 'shooter-app', ...headers }, cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
// the current game link published by the host (GitHub API is fresh; the Pages copy can lag a few minutes)
async function remoteLink() {
  try { return (await getJson(`https://api.github.com/repos/${REPO}/contents/link.json`, { Accept: 'application/vnd.github.raw+json' })).url || ''; } catch {}
  try { return (await getJson(PAGE + 'link.json?' + Date.now())).url || ''; } catch {}
  return '';
}
// newest app release, to tell the player when a new app download exists
async function latestVersion() {
  try { return String((await getJson(`https://api.github.com/repos/${REPO}/releases/latest`)).tag_name || '').replace(/^v/, ''); } catch { return ''; }
}
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

let win, current = '';
function showStart(query = {}) { current = ''; win.loadFile(path.join(__dirname, 'start.html'), { query }); }
function go(url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  current = url;
  saveCfg({ ...loadCfg(), last: url });
  win.loadURL(url).catch(() => showStart({ error: "Couldn't reach the game. Is the host running it?", failed: url }));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // no menu = no Ctrl+W / Ctrl+R / Ctrl+Q accelerators
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 500, backgroundColor: '#16161a', title: 'Shooter',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), backgroundThrottling: false },
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F2') { showStart({ manual: '1' }); e.preventDefault(); }
  });
  win.on('page-title-updated', (e) => e.preventDefault()); // keep the window called Shooter
  // a dead quick-tunnel link still "loads" (Cloudflare's 530 error page): treat 5xx as offline
  win.webContents.on('did-navigate', (_e, url, code) => {
    if (code >= 500 && current) showStart({ error: "The game isn't running at that link right now.", failed: current });
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  showStart();
});

ipcMain.handle('defaults', async () => {
  const host = hostLink(), [remote, latest] = await Promise.all([remoteLink(), latestVersion()]);
  return {
    last: loadCfg().last || '', host, remote, page: PAGE,
    version: app.getVersion(), update: latest && newer(latest, app.getVersion()) ? latest : '',
  };
});
ipcMain.on('go', (_e, url) => go(url));
ipcMain.on('open-page', () => shell.openExternal(PAGE));
// the game page couldn't reach its server for a while: the host may have restarted with a new link
ipcMain.on('relink', async () => {
  const url = hostLink() && current.startsWith('http://localhost') ? '' : await remoteLink();
  if (url && url !== current) go(url);
});

app.on('window-all-closed', () => app.quit());
