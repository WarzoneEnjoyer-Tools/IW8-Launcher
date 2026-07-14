let masterPath = '';
let selectedBuildPath = '';
let selectedPatch = ''; 

const selectBtn = document.getElementById('select-btn');
const masterPathDisplay = document.getElementById('master-path-display');
const buildsGrid = document.getElementById('builds-grid');
const launchBtn = document.getElementById('launch-btn');
const lanLaunchBtn = document.getElementById('lan-launch-btn');
const closeBtn = document.getElementById('close-btn');
const statusDisplay = document.getElementById('status-display');
const optionsGroup = document.getElementById('options-group'); 

const fallbackIcon = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%237a8296"><path d="M21 16V6H3V16H21ZM21 4C22.1 4 23 4.9 23 6V16C23 17.1 22.1 18 21 18H14V20H10V18H3C1.9 18 1 17.1 1 16V6C1 4.9 1.9 4 3 4H21Z"/></svg>';

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const patches = await window.launcherAPI.getPatches();
        optionsGroup.innerHTML = ''; 
        if (patches.length === 0) {
            optionsGroup.innerHTML = '<span style="color: #ff4d4d; font-size: 12px;">No DLL patches found!</span>';
        } else {
            patches.forEach((patchName, index) => {
                const opt = document.createElement('div');
                opt.className = `patch-opt ${index === 0 ? 'active' : ''}`; 
                opt.textContent = patchName;
                if (index === 0) selectedPatch = patchName;
                opt.addEventListener('click', () => {
                    document.querySelectorAll('.patch-opt').forEach(item => item.classList.remove('active'));
                    opt.classList.add('active');
                    selectedPatch = patchName;
                });
                optionsGroup.appendChild(opt);
            });
        }
    } catch (error) {
        console.error(error);
    }

    const recent = await window.launcherAPI.getRecentPath();
    if (recent) {
        setMasterPath(recent);
    }
});

selectBtn.addEventListener('click', async () => {
  const dir = await window.launcherAPI.selectDirectory();
  if (dir) {
    setMasterPath(dir);
    window.launcherAPI.saveRecentPath(dir);
  }
});

async function setMasterPath(dir) {
    masterPath = dir;
    masterPathDisplay.textContent = dir;
    masterPathDisplay.title = dir;
    selectedBuildPath = ''; 
    
    buildsGrid.innerHTML = '<div style="color: #7a8296; grid-column: 1/-1; text-align: center;">Scanning folder...</div>';
    
    const builds = await window.launcherAPI.scanMasterFolder(dir);
    
    if (builds.length === 0) {
        buildsGrid.innerHTML = '<div style="color: #ff4d4d; grid-column: 1/-1; text-align: center;">No valid Modern Warfare builds found in this folder.</div>';
        return;
    }

    buildsGrid.innerHTML = '';
    builds.forEach((build, index) => {
        const card = document.createElement('div');
        card.className = `build-card ${index === 0 ? 'active' : ''}`;
        
        if (index === 0) selectedBuildPath = build.path;

        card.innerHTML = `
            <img src="${build.icon || fallbackIcon}" class="build-icon" alt="Game Icon">
            <div class="build-name" title="${build.name}">${build.name}</div>
            <div class="build-version">${build.version}</div>
        `;

        card.addEventListener('click', () => {
            document.querySelectorAll('.build-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            selectedBuildPath = build.path;
        });

        buildsGrid.appendChild(card);
    });
}

// STANDARD LAUNCH TRIGGER
launchBtn.addEventListener('click', () => {
  if (!selectedBuildPath) {
    statusDisplay.textContent = 'Alert: Please select a specific game build first!';
    statusDisplay.style.color = '#ff4d4d';
    return;
  }

  if (!selectedPatch) {
    statusDisplay.textContent = 'Alert: No DLL patch selected!';
    statusDisplay.style.color = '#ff4d4d';
    return;
  }
  
  statusDisplay.style.color = '#00ffcc';
  statusDisplay.textContent = 'Initializing engine lifecycle...';
  
  window.launcherAPI.executeLaunch({
    gamePath: selectedBuildPath,
    patchVersion: selectedPatch,
    isLanLaunch: false
  });
});

// FORCED OVERRIDE 1.20 LAN LAUNCH TRIGGER
lanLaunchBtn.addEventListener('click', () => {
  if (!selectedBuildPath) {
    statusDisplay.textContent = 'Alert: Please select a specific game build first!';
    statusDisplay.style.color = '#ff4d4d';
    return;
  }

  if (!selectedPatch) {
    statusDisplay.textContent = 'Alert: No DLL patch selected!';
    statusDisplay.style.color = '#ff4d4d';
    return;
  }
  
  statusDisplay.style.color = '#38bdf8';
  statusDisplay.textContent = 'Initializing Replay Executable Pipeline (1.20 LAN)...';
  
  window.launcherAPI.executeLaunch({
    gamePath: selectedBuildPath,
    patchVersion: selectedPatch,
    isLanLaunch: true
  });
});

// CLOSURE DISPATCH TRIGGER
closeBtn.addEventListener('click', () => {
  statusDisplay.style.color = '#ffcc00';
  statusDisplay.textContent = 'Running CloseMW.bat...';
  window.launcherAPI.killGame();
});

window.launcherAPI.onStatusChange((message) => {
  statusDisplay.textContent = message;
  if (message.includes('Error') || message.includes('Failed') || message.includes('missing')) {
    statusDisplay.style.color = '#ff4d4d';
  } else if (message.includes('successfully') || message.includes('executed')) {
    statusDisplay.style.color = '#4da6ff';
  } else {
    statusDisplay.style.color = '#00ffcc';
  }
});

window.launcherAPI.onGameKilled(() => {
  statusDisplay.textContent = 'Process destruction command complete.';
  statusDisplay.style.color = '#ffcc00';
});