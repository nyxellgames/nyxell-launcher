document.addEventListener('DOMContentLoaded', () => {
    initSplashScreen();
    initNavigation();
    initSettingsSubtabs();
    setRealDefaultPaths();
    loadMinecraftVersions();
    loadSavedSettings();
    setupLocalStorageListeners();
    initConsoleButton();
    initAvatarLoader();
    initUtilityButtons();
    initAutoUpdaterListener();
    initElectronLauncher();
});

function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash && splash.style.display !== 'none') {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
        }, 400);
    }
}

function initSplashScreen() {
    const progressBar = document.getElementById('splash-progress');
    const statusText = document.getElementById('splash-status');

    if (typeof require !== 'undefined') {
        const { ipcRenderer } = require('electron');

        ipcRenderer.on('updater-splash-status', (event, { status, percent }) => {
            if (statusText) statusText.textContent = status;
            if (progressBar && percent !== null && percent !== undefined) {
                progressBar.style.width = `${percent}%`;
            }

            if (percent >= 100) {
                setTimeout(() => {
                    hideSplashScreen();
                }, 800);
            }
        });

        if (statusText) statusText.textContent = "Buscando actualizaciones...";
        if (progressBar) progressBar.style.width = "10%";
        ipcRenderer.send('check-for-updates');

        setTimeout(() => {
            hideSplashScreen();
        }, 8000);

    } else {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 25;
            if (progressBar) progressBar.style.width = `${progress}%`;

            if (progress === 50 && statusText) statusText.textContent = "Obteniendo lista de versiones...";
            if (progress === 75 && statusText) statusText.textContent = "Cargando configuraciones de Nyxell...";

            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(() => hideSplashScreen(), 200);
            }
        }, 150);
    }
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');

            navItems.forEach(i => i.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            item.classList.add('active');
            const targetElement = document.getElementById(targetTab);
            if (targetElement) targetElement.classList.add('active');
        });
    });
}

function initSettingsSubtabs() {
    const subtabBtns = document.querySelectorAll('.subtab-btn');
    const subtabContents = document.querySelectorAll('.subtab-content');

    subtabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-subtab');
            subtabBtns.forEach(b => b.classList.remove('active'));
            subtabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetContent = document.getElementById(target);
            if (targetContent) targetContent.classList.add('active');
        });
    });
}

function setRealDefaultPaths() {
    const gamePathInput = document.getElementById('game-path');
    if (gamePathInput && !localStorage.getItem('nyxell_game_path')) {
        let appData = 'C:\\Users\\Usuario\\AppData\\Roaming';
        if (typeof process !== 'undefined' && process.env && process.env.APPDATA) {
            appData = process.env.APPDATA;
        }
        gamePathInput.value = `${appData}\\.nyxell_mc`;
    }
}

async function loadMinecraftVersions() {
    const versionSelect = document.getElementById('version-select');
    if (!versionSelect) return;

    try {
        const response = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
        const data = await response.json();
        
        const fragment = document.createDocumentFragment();
        const releases = data.versions.filter(v => v.type === 'release');

        releases.forEach(v => {
            const option = document.createElement('option');
            option.value = v.id;
            option.textContent = `Minecraft ${v.id}`;
            fragment.appendChild(option);
        });

        versionSelect.innerHTML = '';
        versionSelect.appendChild(fragment);

        const savedVersion = localStorage.getItem('nyxell_selected_version');
        if (savedVersion && versionSelect.querySelector(`option[value="${savedVersion}"]`)) {
            versionSelect.value = savedVersion;
        }

    } catch (e) {
        console.error("Error cargando versiones:", e);
        if (versionSelect.children.length <= 1) {
            versionSelect.innerHTML = '<option value="1.20.4">Minecraft 1.20.4</option>';
        }
    }
}

async function loadSavedSettings() {
    const username = localStorage.getItem('nyxell_username');
    const skinUrl = localStorage.getItem('nyxell_skin_url');
    const gamePath = localStorage.getItem('nyxell_game_path');
    const ram = localStorage.getItem('nyxell_ram');
    const resolution = localStorage.getItem('nyxell_resolution');
    const jvmArgs = localStorage.getItem('nyxell_jvm_args');
    const closeOnLaunch = localStorage.getItem('nyxell_close_on_launch');
    const hackMode = localStorage.getItem('nyxell_hack_mode');
    const hackTheme = localStorage.getItem('nyxell_hack_theme');

    if (username && document.getElementById('username')) document.getElementById('username').value = username;
    if (skinUrl && document.getElementById('skin-url')) document.getElementById('skin-url').value = skinUrl;
    if (gamePath && document.getElementById('game-path')) document.getElementById('game-path').value = gamePath;
    if (resolution && document.getElementById('resolution-select')) document.getElementById('resolution-select').value = resolution;
    if (jvmArgs && document.getElementById('jvm-args')) document.getElementById('jvm-args').value = jvmArgs;
    if (closeOnLaunch !== null && document.getElementById('close-on-launch')) document.getElementById('close-on-launch').checked = (closeOnLaunch === 'true');
    if (hackMode !== null && document.getElementById('hack-mode')) document.getElementById('hack-mode').checked = (hackMode === 'true');
    if (hackTheme && document.getElementById('hack-theme-select')) document.getElementById('hack-theme-select').value = hackTheme;

    const ramSelect = document.getElementById('ram-allocation');
    if (ramSelect && typeof require !== 'undefined') {
        try {
            const { ipcRenderer } = require('electron');
            const { totalRamGB } = await ipcRenderer.invoke('get-system-info');
            ramSelect.innerHTML = '';
            
            for (let i = 2; i <= totalRamGB; i += 2) {
                const option = document.createElement('option');
                option.value = `${i}G`;
                option.textContent = `${i} GB ${i === 4 ? '(Recomendado)' : ''}`;
                ramSelect.appendChild(option);
            }

            if (ram && ramSelect.querySelector(`option[value="${ram}"]`)) {
                ramSelect.value = ram;
            } else if (ramSelect.querySelector('option[value="4G"]')) {
                ramSelect.value = "4G";
            }
        } catch (e) {
            if (ram && ramSelect) ramSelect.value = ram;
        }
    } else if (ram && ramSelect) {
        ramSelect.value = ram;
    }
}

function setupLocalStorageListeners() {
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.addEventListener('input', (e) => {
            localStorage.setItem('nyxell_username', e.target.value);
        });
    }

    const versionSelect = document.getElementById('version-select');
    if (versionSelect) {
        versionSelect.addEventListener('change', (e) => {
            localStorage.setItem('nyxell_selected_version', e.target.value);
        });
    }

    const hackModeToggle = document.getElementById('hack-mode');
    if (hackModeToggle) {
        hackModeToggle.addEventListener('change', (e) => {
            localStorage.setItem('nyxell_hack_mode', e.target.checked);
        });
    }

    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            localStorage.setItem('nyxell_skin_url', document.getElementById('skin-url').value);
            localStorage.setItem('nyxell_ram', document.getElementById('ram-allocation').value);
            localStorage.setItem('nyxell_resolution', document.getElementById('resolution-select').value);
            localStorage.setItem('nyxell_game_path', document.getElementById('game-path').value);
            localStorage.setItem('nyxell_jvm_args', document.getElementById('jvm-args').value);
            localStorage.setItem('nyxell_close_on_launch', document.getElementById('close-on-launch').checked);
            localStorage.setItem('nyxell_hack_theme', document.getElementById('hack-theme-select').value);

            alert('¡Configuración guardada con éxito en Nyxell Launcher!');
        });
    }
}

function initConsoleButton() {
    const openConsoleBtn = document.getElementById('open-console-btn');
    if (openConsoleBtn && typeof require !== 'undefined') {
        const { ipcRenderer } = require('electron');
        openConsoleBtn.addEventListener('click', () => {
            ipcRenderer.send('open-console-window');
        });
    }
}

function initAvatarLoader() {
    const usernameInput = document.getElementById('username');
    const userAvatar = document.getElementById('user-avatar');
    let debounceTimer;

    if (!usernameInput || !userAvatar) return;

    const updateAvatar = (name) => {
        const cleanName = name.trim() || 'Player';
        userAvatar.src = `https://mc-heads.net/avatar/${cleanName}/32`;
    };

    updateAvatar(usernameInput.value);

    usernameInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            updateAvatar(e.target.value);
        }, 500);
    });
}

function initUtilityButtons() {
    if (typeof require === 'undefined') return;
    const { ipcRenderer } = require('electron');

    const openModsBtn = document.getElementById('open-mods-folder-btn');
    const openRootBtn = document.getElementById('open-root-folder-btn');
    const cleanCacheBtn = document.getElementById('clean-cache-btn');

    if (openModsBtn) {
        openModsBtn.addEventListener('click', () => {
            ipcRenderer.send('open-folder', 'mods');
        });
    }

    if (openRootBtn) {
        openRootBtn.addEventListener('click', () => {
            ipcRenderer.send('open-folder', 'root');
        });
    }

    if (cleanCacheBtn) {
        cleanCacheBtn.addEventListener('click', () => {
            if (confirm('¿Deseas borrar los archivos temporales y cachés para liberar espacio? (Tus mundos NO se borrarán).')) {
                ipcRenderer.send('clean-cache');
            }
        });
    }

    ipcRenderer.on('cache-cleaned-success', () => {
        alert('¡Caché y temporales limpiados con éxito!');
    });
}

function initAutoUpdaterListener() {
    if (typeof require === 'undefined') return;
    const { ipcRenderer } = require('electron');

    ipcRenderer.on('update-downloaded', () => {
        if (confirm('¡Nueva actualización de Nyxell Launcher descargada! ¿Deseas reiniciar ahora para aplicarla?')) {
            ipcRenderer.send('restart-app-for-update');
        }
    });
}

function initElectronLauncher() {
    if (typeof require !== 'undefined') {
        const { ipcRenderer } = require('electron');
        const playBtn = document.getElementById('play-btn');
        const statusText = document.getElementById('status-text');

        if (playBtn) {
            playBtn.addEventListener('click', () => {
                const username = document.getElementById('username').value;
                const version = document.getElementById('version-select').value;
                const isHack = document.getElementById('hack-mode').checked;
                const ram = document.getElementById('ram-allocation').value;
                const gamePath = document.getElementById('game-path').value;
                const closeOnLaunch = document.getElementById('close-on-launch').checked;

                playBtn.disabled = true;
                playBtn.innerHTML = "<span>INICIANDO...</span>";
                if (statusText) statusText.textContent = "Iniciando peticiones del sistema...";

                ipcRenderer.send('launch-game', {
                    username: username,
                    version: version,
                    isHack: isHack,
                    ram: ram,
                    customPath: gamePath,
                    closeOnLaunch: closeOnLaunch
                });
            });
        }

        ipcRenderer.on('status-update', (event, { message, progress }) => {
            if (statusText) statusText.textContent = message;
            if (playBtn && progress !== null && progress !== undefined) {
                playBtn.innerHTML = `<span>DESCARGANDO (${progress}%)</span>`;
            }
        });

        ipcRenderer.on('game-closed', () => {
            if (playBtn) {
                playBtn.disabled = false;
                playBtn.innerHTML = "<span>JUGAR</span>";
            }
            if (statusText) statusText.textContent = "";
        });
    }
}
