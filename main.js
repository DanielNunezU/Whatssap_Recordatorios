const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

// Deshabilitar aceleración de hardware para evitar errores de GPU
app.disableHardwareAcceleration();

let mainWindow;
let cronJob = null;

// ================================
// CREAR VENTANA PRINCIPAL
// ================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#f0f9ff',
    show: false
  });

  // Cargar HTML principal
  mainWindow.loadFile('index.html');

  // 🔍 ABRIR DEVTOOLS PARA VER ERRORES DEL RENDERER
  mainWindow.webContents.openDevTools();

  // Mostrar ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Al cerrar ventana
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (cronJob) {
      cronJob.stop();
      cronJob = null;
    }
  });
}

// ================================
// INICIO DE LA APLICACIÓN
// ================================
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Cerrar app en Windows / Linux
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ================================
// IPC - SELECCIONAR ARCHIVO
// ================================
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Archivos de datos', extensions: ['csv', 'xlsx', 'xls', 'txt', 'xlsm'] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);

    // Leer contenido solo CSV o TXT
    if (fileName.match(/\.(csv|txt)$/i)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        success: true,
        path: filePath,
        content,
        name: fileName
      };
    }

    // Excel: solo enviar ruta
    return {
      success: true,
      path: filePath,
      name: fileName
    };
  }

  return { success: false };
});

// ================================
// IPC - GUARDAR CONFIG
// ================================
ipcMain.handle('save-config', async (event, config) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ================================
// IPC - CARGAR CONFIG
// ================================
ipcMain.handle('load-config', async () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { success: true, config };
    }
    return { success: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ================================
// IPC - GUARDAR CONTACTOS
// ================================
ipcMain.handle('save-contacts', async (event, contacts) => {
  try {
    const contactsPath = path.join(app.getPath('userData'), 'contacts.json');
    fs.writeFileSync(contactsPath, JSON.stringify(contacts, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ================================
// IPC - CARGAR CONTACTOS
// ================================
ipcMain.handle('load-contacts', async () => {
  try {
    const contactsPath = path.join(app.getPath('userData'), 'contacts.json');
    if (fs.existsSync(contactsPath)) {
      const contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf-8'));
      return { success: true, contacts };
    }
    return { success: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ================================
// IPC - INICIAR CRON
// ================================
ipcMain.handle('start-cron', async (event, horaEjecucion) => {
  try {
    if (cronJob) cronJob.stop();

    const [hora, minuto] = horaEjecucion.split(':');

    cronJob = cron.schedule(`${minuto} ${hora} * * *`, () => {
      if (mainWindow) {
        mainWindow.webContents.send('ejecutar-envio-automatico');
      }
    });

    return { success: true, message: `Cron programado para las ${horaEjecucion}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ================================
// IPC - DETENER CRON
// ================================
ipcMain.handle('stop-cron', async () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    return { success: true };
  }
  return { success: false };
});

// ================================
// IPC - ENVIAR WHATSAPP
// ================================
ipcMain.handle('send-whatsapp', async (event, { token, phoneId, numero, mensaje }) => {
  try {
    const fetch = require('electron').net.fetch || require('node-fetch');

    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numero,
        type: 'text',
        text: { body: mensaje }
      })
    });

    const data = await response.json();

    if (response.status === 200) {
      return { success: true, data };
    }

    return {
      success: false,
      error: data?.error?.message || 'Error desconocido'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});