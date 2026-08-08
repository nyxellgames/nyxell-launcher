const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const { exec } = require('child_process');
const { Client, Authenticator } = require('minecraft-launcher-core');
const { autoUpdater } = require('electron-updater');

const launcher = new Client();
const BRAND_NAME = "Nyxell Games";
let mainWindow = null;
let consoleWindow = null;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

const HACK_VERSIONS = {
    "1.14.4":        { fabricVersion: "0.15.7", jarFile: "NyxellClient-1.14.4.jar" },
    "1.15.2":        { fabricVersion: "0.15.7", jarFile: "NyxellClient-1.15.2.jar" },
    "1.16.5":        { fabricVersion: "0.15.7", jarFile: "NyxellClient-1.16.5.jar" },
    "1.17.1":        { fabricVersion: "0.15.7", jarFile: "NyxellClient-1.17.1.jar" },
    "1.18.1":        { fabricVersion: "0.15.7", jarFile: "NyxellClient-1.18.1.jar" },
    "1.18.2":        { fabricVersion: "0.15.7", jarFile: "NyxellClient-1.18.2.jar" },
    "1.19":          { fabricVersion: "0.15.7", jarFile: "NyxellClient-1.19.jar" },
    "1.19.2":        { fabricVersion: "0.15.7", jarFile: "NyxellClient-1.19.2.jar" },
    "1.19.3":        { fabricVersion: "0.15.7", jarFile: "NyxellClient-1.19.3.jar" },
    "1.19.4":        { fabricVersion: "0.15.7", jarFile: "NyxellClient-1.19.4.jar" },
    "1.20.1":        { fabricVersion: "0.15.7", jarFile: "NyxellClient-1.20.1.jar" },
    "1.20.2":        { fabricVersion: "0.15.7", jarFile: "NyxellClient-1.20.2.jar" },
    "1.20.4":        { fabricVersion: "0.15.7", jarFile: "NyxellClient-1.20.4.jar" },
    "1.20.6":        { fabricVersion: "0.15.7", jarFile: "NyxellClient-1.20.6.jar" },
    "1.21.2":        { fabricVersion: "0.16.0", jarFile: "NyxellClient-1.21.2.jar" },
    "1.21.2_1.21.3": { fabricVersion: "0.16.0", jarFile: "NyxellClient-1.21.2_1.21.3.jar" }
};

function sendLog(type, text) {
    const data = { type, text, timestamp: new Date().toLocaleTimeString() };
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app-log', data);
    }
    if (consoleWindow && !consoleWindow.isDestroyed()) {
        consoleWindow.webContents.send('app-log', data);
    }
}

function sendStatus(message, progress = null) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('status-update', { message, progress });
    }
}

function sendSplashUpdate(status, percent, isError = false) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater-splash-status', { status, percent, isError });
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 700,
        minWidth: 940,
        minHeight: 620,
        frame: true,
        autoHideMenuBar: true,
        title: "Nyxell Launcher",
        icon: path.join(__dirname, '../frontend/assets/nyxell.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Carga de ruta adaptada para empaquetado asar y entorno de desarrollo
    const indexPath = path.join(__dirname, '../frontend/index.html');
    mainWindow.loadFile(indexPath);
}

function createConsoleWindow() {
    if (consoleWindow && !consoleWindow.isDestroyed()) {
        consoleWindow.focus();
        return;
    }

    consoleWindow = new BrowserWindow({
        width: 750,
        height: 480,
        minWidth: 500,
        minHeight: 300,
        title: "Logs Nyxell Launcher",
        autoHideMenuBar: true,
        icon: path.join(__dirname, '../frontend/assets/nyxell.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    consoleWindow.loadFile(path.join(__dirname, '../frontend/console.html'));
    
    consoleWindow.on('closed', () => {
        consoleWindow = null;
    });
}

ipcMain.on('open-console-window', () => {
    createConsoleWindow();
});

ipcMain.on('open-folder', (event, type) => {
    const defaultAppData = process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming');
    let targetPath = path.join(defaultAppData, '.nyxell_mc');

    if (type === 'mods') {
        targetPath = path.join(defaultAppData, '.nyxell_hacks', 'mods');
    }

    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }

    shell.openPath(targetPath);
    sendLog('INFO', `Abriendo carpeta en explorador: ${targetPath}`);
});

ipcMain.on('clean-cache', (event) => {
    const defaultAppData = process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming');
    const foldersToClean = [
        path.join(defaultAppData, '.nyxell_mc', 'cache'),
        path.join(defaultAppData, '.nyxell_mc', 'assets', 'log_configs'),
        path.join(defaultAppData, '.nyxell_hacks', 'cache')
    ];

    let cleanedCount = 0;
    foldersToClean.forEach(folder => {
        if (fs.existsSync(folder)) {
            try {
                fs.rmSync(folder, { recursive: true, force: true });
                cleanedCount++;
            } catch (err) {
                sendLog('ERROR', `Error limpiando carpeta ${folder}: ${err.message}`);
            }
        }
    });

    sendLog('SUCCESS', `Limpieza de caché completada (${cleanedCount} directorios limpiados).`);
    event.sender.send('cache-cleaned-success');
});

// EVENTOS DE AUTO-UPDATER
ipcMain.on('restart-app-for-update', () => {
    autoUpdater.quitAndInstall();
});

ipcMain.on('check-for-updates', () => {
    sendSplashUpdate('Buscando actualizaciones...', 10);
    sendLog('INFO', 'Comprobando si existen actualizaciones de Nyxell Launcher...');
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        sendLog('WARN', `Error iniciando búsqueda de actualización: ${err.message}`);
        sendSplashUpdate('No se pudo verificar actualizaciones.', 100, true);
    });
});

autoUpdater.on('checking-for-update', () => {
    sendSplashUpdate('Buscando actualizaciones...', 30);
});

autoUpdater.on('update-available', (info) => {
    sendLog('SUCCESS', `¡Nueva versión v${info.version} detectada! Descargando...`);
    sendSplashUpdate(`Nueva versión v${info.version} encontrada. Descargando...`, 0);
});

autoUpdater.on('update-not-available', () => {
    sendLog('INFO', 'El launcher está actualizado a la versión más reciente.');
    sendSplashUpdate('¡Launcher actualizado a la última versión!', 100);
});

autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent) || 0;
    sendSplashUpdate(`Actualizando launcher: ${percent}%`, percent);
    sendStatus(`Actualizando launcher: ${percent}%`, percent);
});

autoUpdater.on('update-downloaded', () => {
    sendLog('SUCCESS', 'Actualización descargada y lista para instalar.');
    sendSplashUpdate('Actualización lista. Reiniciando...', 100);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-downloaded');
    }
});

autoUpdater.on('error', (err) => {
    sendLog('WARN', `Verificación de actualizaciones omitida: ${err.message}`);
    sendSplashUpdate('Omitiendo búsqueda de actualizaciones...', 100, true);
});

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-system-info', () => {
    const totalMemBytes = os.totalmem();
    const totalMemGB = Math.floor(totalMemBytes / (1024 * 1024 * 1024));
    return { totalRamGB: totalMemGB };
});

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': '*/*'
            }
        };

        https.get(url, options, (response) => {
            if ([301, 302, 307, 308].includes(response.statusCode)) {
                if (!response.headers.location) {
                    return reject(new Error('Redirección sin ubicación definida'));
                }
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                return reject(new Error(`Respuesta HTTP fallida con código ${response.statusCode}`));
            }

            const file = fs.createWriteStream(dest);
            response.pipe(file);

            file.on('finish', () => {
                file.close(resolve);
            });

            file.on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

function checkSystemJava() {
    return new Promise((resolve) => {
        exec('java -version', (error) => {
            if (!error) resolve(true);
            else resolve(false);
        });
    });
}

async function getOrInstallJava(baseFolder) {
    sendLog('INFO', 'Verificando entorno de Java runtime...');
    
    const hasSystemJava = await checkSystemJava();
    if (hasSystemJava) {
        sendLog('INFO', 'Java del sistema detectado correctamente.');
        return 'java';
    }

    const javaDir = path.join(baseFolder, 'java');
    const javaExecutable = process.platform === 'win32' 
        ? path.join(javaDir, 'bin', 'java.exe') 
        : path.join(javaDir, 'bin', 'java');

    if (fs.existsSync(javaExecutable)) {
        sendLog('INFO', 'Entorno OpenJDK portable interno detectado.');
        return javaExecutable;
    }

    sendStatus('Descargando Java Runtime (OpenJDK 17)...', 0);
    sendLog('INFO', 'No se encontró Java en el sistema. Iniciando descarga de OpenJDK 17 Portable...');
    
    if (!fs.existsSync(javaDir)) {
        fs.mkdirSync(javaDir, { recursive: true });
    }

    const zipPath = path.join(baseFolder, 'java_runtime.zip');
    const javaDownloadUrl = "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10%2B7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.10_7.zip";

    try {
        await downloadFile(javaDownloadUrl, zipPath);
        sendLog('INFO', 'Descarga de Java finalizada. Extrayendo archivos...');
        sendStatus('Instalando Java Runtime...', 50);

        await new Promise((resolve, reject) => {
            const unzipCmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${javaDir}_temp' -Force"`;
            exec(unzipCmd, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const extractedFolders = fs.readdirSync(path.join(`${javaDir}_temp`));
        const rootExtracted = path.join(`${javaDir}_temp`, extractedFolders[0]);
        
        fs.cpSync(rootExtracted, javaDir, { recursive: true });
        fs.rmSync(`${javaDir}_temp`, { recursive: true, force: true });
        fs.unlinkSync(zipPath);

        sendLog('SUCCESS', 'OpenJDK 17 Portable instalado con éxito.');
        return javaExecutable;
    } catch (err) {
        sendLog('ERROR', `Error instalando Java automático: ${err.message}`);
        return 'java';
    }
}

async function setupFabric(mcVersion, loaderVersion, gamePath) {
    const customVersionId = `fabric-loader-${loaderVersion}-${mcVersion}`;
    const versionDir = path.join(gamePath, 'versions', customVersionId);
    const jsonPath = path.join(versionDir, `${customVersionId}.json`);

    if (!fs.existsSync(versionDir)) {
        fs.mkdirSync(versionDir, { recursive: true });
    }

    if (!fs.existsSync(jsonPath)) {
        sendLog('INFO', `Obteniendo perfil de Fabric Meta para v${mcVersion}...`);
        const fabricMetaUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`;
        await downloadFile(fabricMetaUrl, jsonPath);
    }

    return customVersionId;
}

ipcMain.on('launch-game', async (event, data) => {
    const { username, version, isHack, ram, customPath, closeOnLaunch } = data;

    const selectedVersion = version || "1.20.4";
    const defaultAppData = process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming');
    const baseFolder = customPath || path.join(defaultAppData, '.nyxell_mc');
    const gamePath = isHack ? path.join(defaultAppData, '.nyxell_hacks') : baseFolder;

    sendStatus("Comprobando entorno de Java...", 5);
    const javaPath = await getOrInstallJava(baseFolder);

    const hackConfig = HACK_VERSIONS[selectedVersion] || {
        fabricVersion: "0.15.7",
        jarFile: `NyxellClient-${selectedVersion}.jar`
    };

    if (isHack) {
        sendStatus("Preparando módulos de Nyxell Hacks...", 10);
        const targetModsDir = path.join(gamePath, 'mods');
        if (!fs.existsSync(targetModsDir)) {
            fs.mkdirSync(targetModsDir, { recursive: true });
        }

        const localJarPath = path.join(__dirname, 'mods', hackConfig.jarFile);
        const destinationJarPath = path.join(targetModsDir, hackConfig.jarFile);

        if (fs.existsSync(localJarPath)) {
            sendLog('INFO', `Copiando mod local ${hackConfig.jarFile}...`);
            try {
                fs.copyFileSync(localJarPath, destinationJarPath);
                sendLog('SUCCESS', `Mod cargado para v${selectedVersion}.`);
            } catch (copyErr) {
                sendLog('ERROR', `Error copiando mod local: ${copyErr.message}`);
            }
        } else {
            sendLog('WARN', `Archivo local no encontrado: ${localJarPath}`);
        }
    }

    const auth = Authenticator.getAuth(username || "Player");

    let versionConfig;
    if (isHack) {
        sendStatus("Configurando Fabric Loader...", 15);
        try {
            const customVersionId = await setupFabric(selectedVersion, hackConfig.fabricVersion, gamePath);
            versionConfig = {
                number: selectedVersion,
                type: "release",
                custom: customVersionId
            };
        } catch (err) {
            sendLog('ERROR', `Error configurando Fabric Loader: ${err.message}`);
            versionConfig = {
                number: selectedVersion,
                type: "release"
            };
        }
    } else {
        versionConfig = {
            number: selectedVersion,
            type: "release"
        };
    }

    const opts = {
        authorization: auth,
        root: gamePath,
        version: versionConfig,
        javaPath: javaPath !== 'java' ? javaPath : undefined,
        memory: {
            max: ram || "4G",
            min: "2G"
        },
        customArgs: [
            `-Dminecraft.launcher.brand=${BRAND_NAME}`
        ]
    };

    sendLog('INFO', `Iniciando cliente | Versión: ${selectedVersion} | Hacks: ${isHack} | RAM: ${ram || "4G"}`);

    launcher.removeAllListeners();
    let hasGameStarted = false;

    launcher.on('debug', (e) => sendLog('DEBUG', e));

    launcher.on('data', (e) => {
        sendLog('GAME', e);
        if (!hasGameStarted) {
            hasGameStarted = true;
            sendStatus("¡Juego iniciado con éxito!", 100);
            sendLog('SUCCESS', 'El cliente de Minecraft está ejecutándose.');

            if (closeOnLaunch) {
                sendLog('INFO', 'Cerrando launcher automáticamente...');
                setTimeout(() => app.quit(), 1500);
            }
        }
    });

    launcher.on('progress', (e) => {
        const percentage = Math.round((e.task / e.total) * 100) || 0;
        const msg = `Descargando ${e.type}: ${e.task} de ${e.total} (${percentage}%)`;
        sendStatus(msg, percentage);
    });

    launcher.on('close', (code) => {
        sendLog('INFO', `El juego finalizó con el código de salida: ${code}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            event.sender.send('game-closed', code);
        }
    });

    try {
        await launcher.launch(opts);
    } catch (error) {
        sendLog('ERROR', `Error al iniciar Minecraft: ${error.message || error}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            event.sender.send('game-closed', 1);
        }
    }
});
