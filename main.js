const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

let mainWindow;

const getBaseDir = () => app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname;
const recentPathFile = path.join(getBaseDir(), 'recentpathopen.txt');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 750,
    height: 720,
    resizable: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'app.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-recent-path', () => {
  try {
    if (fs.existsSync(recentPathFile)) {
      return fs.readFileSync(recentPathFile, 'utf-8').trim();
    }
  } catch (error) {
    console.error("Could not read recent path file", error);
  }
  return null; 
});

ipcMain.on('save-recent-path', (event, targetPath) => {
  try {
    fs.writeFileSync(recentPathFile, targetPath, 'utf-8');
  } catch (error) {}
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Master Builds Directory'
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('scan-master-folder', async (event, masterPath) => {
  if (!fs.existsSync(masterPath)) return [];
  
  const builds = [];
  try {
    const subdirs = fs.readdirSync(masterPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const dir of subdirs) {
      const fullPath = path.join(masterPath, dir);
      const exePath = path.join(fullPath, 'ModernWarfare.exe');
      const replayExePath = path.join(fullPath, 'game_dx12_ship_replay.exe');
      
      const targetExeExists = fs.existsSync(exePath) || fs.existsSync(replayExePath);
      
      if (targetExeExists) {
        const activeExePath = fs.existsSync(exePath) ? exePath : replayExePath;
        let version = 'Unknown Version';
        const buildInfoPath = path.join(fullPath, '.build.info');
        
        if (fs.existsSync(buildInfoPath)) {
          try {
            const content = fs.readFileSync(buildInfoPath, 'utf8').trim().split('\n');
            if (content.length > 0) {
              const lastLine = content[content.length - 1];
              const parts = lastLine.split('|');
              if (parts.length > 0 && parts[parts.length - 1]) {
                version = parts[parts.length - 1];
              }
            }
          } catch(e) { console.error("Error parsing build.info:", e); }
        }

        let iconBase64 = null;
        try {
          const icon = await app.getFileIcon(activeExePath, { size: 'normal' });
          iconBase64 = icon.toDataURL();
        } catch(e) { console.error("Error grabbing icon:", e); }

        builds.push({
          name: dir,
          path: fullPath,
          version: version,
          icon: iconBase64
        });
      }
    }
  } catch (err) {
    console.error("Error scanning master folder:", err);
  }
  
  return builds;
});

ipcMain.handle('get-patches', () => {
  try {
    const baseDir = getBaseDir();
    const dllPath = path.join(baseDir, 'DLL');
    if (!fs.existsSync(dllPath)) {
      fs.mkdirSync(dllPath); 
      return [];
    }
    return fs.readdirSync(dllPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.on('kill-game', (event) => {
  const baseDir = getBaseDir();
  const closeBatPath = path.join(baseDir, 'CloseMW.bat');

  if (!fs.existsSync(closeBatPath)) {
    event.reply('status-change', 'Error: CloseMW.bat is missing from the launcher folder!');
    event.reply('game-killed');
    return;
  }

  exec(`"${closeBatPath}"`, { cwd: baseDir }, (err) => {
    event.reply('status-change', err ? 'Script failed or game already closed.' : 'Game instances wiped via CloseMW.bat.');
    event.reply('game-killed');
  });
});

// INTERCEPTS INTERACTION PAYLOAD DYNAMICALLY
ipcMain.on('execute-launch', async (event, { gamePath, patchVersion, isLanLaunch }) => {
  const sendStatus = (msg) => event.reply('status-change', msg);
  const baseDir = getBaseDir();

  try {
    if (!fs.existsSync(gamePath)) throw new Error('Target game folder does not exist.');

    sendStatus('Clearing old files (Powrprof.dll / Version.dll)...');
    const filesToRemove = ['Powrprof.dll', 'Version.dll', 'powrprof.dll', 'version.dll'];
    filesToRemove.forEach(file => {
      const fullPath = path.join(gamePath, file);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    });

    sendStatus(`Installing DLLs from ${patchVersion}...`);
    const sourcePatchDir = path.join(baseDir, 'DLL', patchVersion);
    
    if (fs.existsSync(sourcePatchDir)) {
        const files = fs.readdirSync(sourcePatchDir);
        files.forEach(file => {
            if (file.toLowerCase().endsWith('.dll')) {
                fs.copyFileSync(path.join(sourcePatchDir, file), path.join(gamePath, file));
            }
        });
    } else {
        throw new Error(`Folder "${patchVersion}" is missing from the DLL folder.`);
    }

    sendStatus('Preparing batch execution payload...');
    const sourceBat = path.join(baseDir, '_StartGame.bat');
    const destBat = path.join(gamePath, '_StartGame.bat');
    
    if (!fs.existsSync(sourceBat)) throw new Error('_StartGame.bat is missing!');
    
    let batContent = fs.readFileSync(sourceBat, 'utf8');
    
    // Explicit rewrite check handles both manual button trigger and directory string fallback patterns
    if (isLanLaunch === true || patchVersion === '1.20 Lan Launch' || path.basename(gamePath) === '1.20 Lan Launch') {
      sendStatus('Patching batch target directly to game_dx12_ship_replay.exe...');
      batContent = batContent.replace(/modernwarfare\.exe/gi, 'game_dx12_ship_replay.exe');
    }

    fs.writeFileSync(destBat, batContent, 'utf8');

    sendStatus('Launching game script...');
    exec(`"${destBat}"`, { cwd: gamePath }, (err) => {
      if (err) console.error("Batch execution trace:", err.message);
    });
    
    setTimeout(() => {
      sendStatus('Game launch script executed.');
    }, 2500);

  } catch (error) {
    sendStatus(`Error: ${error.message}`);
  }
});