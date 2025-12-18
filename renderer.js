const { ipcRenderer } = require('electron');
const XLSX = require('xlsx');

// ============================
// ESTADO
// ============================
const appState = {
  contactos: [],
  config: {
    token: '',
    phoneId: '',
    diasAnticipacion: 30,
    horaEjecucion: '08:00',
    mensajeTemplate: `Hola {nombre} 👋

Han pasado 30 días desde tu última cita.

¿Deseas agendar una nueva?

¡Gracias! 🙏`
  },
  automaticoActivo: false
};

// ============================
// INICIO
// ============================
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadConfig();
  addLog('✅ Aplicación iniciada', 'success');
});

// ============================
// EVENTOS
// ============================
function setupEventListeners() {
  document.getElementById('btnSaveConfig')?.addEventListener('click', saveConfig);
  document.getElementById('btnCargar')?.addEventListener('click', cargarArchivo);
  document.getElementById('btnEnviar')?.addEventListener('click', enviarMensajes);
  document.getElementById('btnAutomatico')?.addEventListener('click', toggleAutomatico);

  ['token', 'phoneId', 'diasAnticipacion', 'horaEjecucion', 'mensajeTemplate']
    .forEach(id => {
      document.getElementById(id)?.addEventListener('input', e => {
        appState.config[id] =
          id === 'diasAnticipacion' ? Number(e.target.value) : e.target.value;
      });
    });
}

// ============================
// CONFIG
// ============================
async function loadConfig() {
  const res = await ipcRenderer.invoke('load-config');
  if (!res.success) return;

  appState.config = { ...appState.config, ...res.config };

  Object.keys(appState.config).forEach(k => {
    const el = document.getElementById(k);
    if (el) el.value = appState.config[k];
  });

  addLog('⚙️ Configuración cargada', 'info');
}

async function saveConfig() {
  await ipcRenderer.invoke('save-config', appState.config);
  addLog('💾 Configuración guardada', 'success');
}

// ============================
// CARGA EXCEL
// ============================
async function cargarArchivo() {
  const result = await ipcRenderer.invoke('select-file');
  if (!result.success) return;

  if (!result.name.match(/\.(xlsx|xls|xlsm)$/i)) {
    addLog('❌ Archivo no válido', 'error');
    return;
  }

  addLog(`📂 Archivo cargado: ${result.name}`, 'info');

  const workbook = XLSX.readFile(result.path, { raw: false });
  mostrarSelectorHoja(workbook);
}

// ============================
// SELECTOR HOJA / COLUMNAS
// ============================
function mostrarSelectorHoja(workbook) {
  const modal = document.createElement('div');
  modal.style.cssText =
    'position:fixed;inset:0;background:#0008;display:flex;align-items:center;justify-content:center;z-index:9999';

  modal.innerHTML = `
    <div style="background:#fff;padding:20px;width:420px;border-radius:8px">
      <h3>📊 Importar Excel</h3>

      <label>Hoja:</label>
      <select id="sheetSelect" style="width:100%">
        ${workbook.SheetNames.map(
          (n, i) => `<option value="${i}">${n}</option>`
        ).join('')}
      </select>

      <label>Fila de encabezados:</label>
      <input id="headerRow" type="number" min="1" value="1" style="width:100%">

      <label>CLIENTE:</label>
      <select id="colNombre" style="width:100%"></select>

      <label>TELEFONO:</label>
      <select id="colTelefono" style="width:100%"></select>

      <label>DIAS CORRIDOS:</label>
      <select id="colDias" style="width:100%"></select>

      <br><br>
      <button id="btnCancelar">Cancelar</button>
      <button id="btnAceptar">Importar</button>
    </div>
  `;

  document.body.appendChild(modal);

  const sheetSelect = modal.querySelector('#sheetSelect');
  const headerRowInput = modal.querySelector('#headerRow');
  const colNombre = modal.querySelector('#colNombre');
  const colTelefono = modal.querySelector('#colTelefono');
  const colDias = modal.querySelector('#colDias');

  const actualizarColumnas = () => {
    const sheetIndex = Number(sheetSelect.value);
    const headerRow = Number(headerRowInput.value) - 1;
    const sheet = workbook.Sheets[workbook.SheetNames[sheetIndex]];

    const data = XLSX.utils.sheet_to_json(sheet, {
      range: headerRow,
      defval: ''
    });

    if (!data.length) return;

    const cols = Object.keys(data[0]);

    [colNombre, colTelefono, colDias].forEach(sel => {
      sel.innerHTML =
        '<option value="">-- seleccionar --</option>' +
        cols.map(c => `<option value="${c}">${c}</option>`).join('');
    });

    if (cols.includes('CLIENTE')) colNombre.value = 'CLIENTE';
    if (cols.includes('TELEFONO')) colTelefono.value = 'TELEFONO';
    if (cols.includes('DIAS CORRIDOS')) colDias.value = 'DIAS CORRIDOS';

    addLog(`📌 Encabezados detectados: ${cols.join(', ')}`, 'info');
  };

  sheetSelect.onchange = actualizarColumnas;
  headerRowInput.oninput = actualizarColumnas;
  actualizarColumnas();

  modal.querySelector('#btnCancelar').onclick = () => modal.remove();

  modal.querySelector('#btnAceptar').onclick = () => {
    modal.remove();
    procesarExcel(
      workbook,
      Number(sheetSelect.value),
      colNombre.value,
      colTelefono.value,
      colDias.value,
      Number(headerRowInput.value) - 1
    );
  };
}

// ============================
// PROCESAR EXCEL (SIN FILTRAR)
// ============================
function procesarExcel(workbook, sheetIndex, colNombre, colTelefono, colDias, headerRow) {
  const sheet = workbook.Sheets[workbook.SheetNames[sheetIndex]];
  const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRow, defval: '' });

  // ✅ CARGAR TODOS
  appState.contactos = rows
    .map(r => ({
      nombre: r[colNombre],
      telefono: String(r[colTelefono]).replace(/\D/g, ''),
      dias: Number(r[colDias])
    }))
    .filter(c => c.nombre && c.telefono.length >= 10);

  renderContactos();

  const con30 = appState.contactos.filter(c => c.dias === 30).length;

  addLog(`👥 ${appState.contactos.length} contactos cargados`, 'success');
  addLog(`📤 ${con30} contactos con 30 días`, 'info');

  document.getElementById('btnEnviar').disabled = con30 === 0;
}

// ============================
// MENSAJES (FILTRA AQUÍ)
// ============================
function generarMensaje(c) {
  return appState.config.mensajeTemplate.replace('{nombre}', c.nombre);
}

async function enviarMensajes() {
  const aEnviar = appState.contactos.filter(c => c.dias === 30);

  if (!aEnviar.length) {
    addLog('⚠️ No hay contactos con 30 días', 'info');
    return;
  }

  addLog(`📤 Enviando ${aEnviar.length} mensajes`, 'info');

  for (const c of aEnviar) {
    await ipcRenderer.invoke('send-whatsapp', {
      token: appState.config.token,
      phoneId: appState.config.phoneId,
      numero: c.telefono,
      mensaje: generarMensaje(c)
    });
  }

  addLog('✅ Mensajes enviados correctamente', 'success');
}

// ============================
// AUTOMÁTICO
// ============================
async function toggleAutomatico() {
  appState.automaticoActivo = !appState.automaticoActivo;

  await ipcRenderer.invoke(
    appState.automaticoActivo ? 'start-cron' : 'stop-cron',
    appState.config.horaEjecucion
  );

  addLog(
    appState.automaticoActivo
      ? '▶️ Envío automático activado'
      : '⏸ Envío automático detenido',
    'info'
  );
}

// ============================
// UI
// ============================
function renderContactos() {
  const cont = document.getElementById('contactsList');
  const count = document.getElementById('contactCount');
  cont.innerHTML = '';
  count.textContent = appState.contactos.length;

  if (!appState.contactos.length) {
    cont.innerHTML = '<p class="empty-state">No hay contactos</p>';
    return;
  }

  appState.contactos.forEach(c => {
    cont.innerHTML += `
      <div class="contact-item">
        <strong>${c.nombre}</strong><br>
        📱 ${c.telefono} — ⏱ ${c.dias} días
      </div>
    `;
  });
}

function addLog(msg, type = 'info') {
  const list = document.getElementById('logsList');
  if (!list) return;

  const div = document.createElement('div');
  div.className = `log-item log-${type}`;
  div.innerHTML = `<strong>${new Date().toLocaleTimeString()}</strong> — ${msg}`;
  list.prepend(div);
}