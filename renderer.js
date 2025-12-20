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
    codigoPais: '57',
    diasEnvio: '',
    horaEjecucion: '08:00',
    mensajeTemplate: `Hola {nombre} 👋

Han pasado 30 días desde tu última cita.

¿Deseas agendar una nueva?

¡Gracias! 🙏`
  },
  automaticoActivo: false,
  filtrarDias: ''
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
  document.getElementById('btnConfig')?.addEventListener('click', toggleConfigPanel);
  document.getElementById('btnSaveConfig')?.addEventListener('click', saveConfig);
  document.getElementById('btnCargar')?.addEventListener('click', cargarArchivo);
  document.getElementById('btnEnviar')?.addEventListener('click', enviarMensajes);
  document.getElementById('btnAutomatico')?.addEventListener('click', toggleAutomatico);

  ['token', 'phoneId', 'codigoPais', 'diasEnvio', 'horaEjecucion', 'mensajeTemplate']
    .forEach(id => {
      document.getElementById(id)?.addEventListener('input', e => {
        appState.config[id] = e.target.value;
      });
    });

  // Filtro de días
  document.getElementById('filtrarDias')?.addEventListener('change', e => {
    const diasCustomInput = document.getElementById('diasCustom');
    if (e.target.value === 'custom') {
      diasCustomInput.style.display = 'block';
      appState.filtrarDias = '';
    } else {
      diasCustomInput.style.display = 'none';
      appState.filtrarDias = e.target.value;
      renderContactos();
      updateSendButton();
    }
  });

  document.getElementById('diasCustom')?.addEventListener('input', e => {
    appState.filtrarDias = e.target.value;
    renderContactos();
    updateSendButton();
  });
}

// ============================
// TOGGLE PANEL CONFIGURACIÓN
// ============================
function toggleConfigPanel() {
  const panel = document.getElementById('configPanel');
  if (panel) {
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    addLog(isVisible ? '⚙️ Panel de configuración cerrado' : '⚙️ Panel de configuración abierto', 'info');
  }
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

  addLog(`📂 Cargando archivo: ${result.name}...`, 'info');

  // ⚡ Mostrar indicador de carga
  const btnCargar = document.getElementById('btnCargar');
  const textoOriginal = btnCargar.innerHTML;
  btnCargar.disabled = true;
  btnCargar.innerHTML = '<span style="display:flex;align-items:center;gap:8px">⏳ Cargando...</span>';

  try {
    // Leer archivo con timeout para no bloquear UI
    await new Promise(resolve => setTimeout(resolve, 10));
    const workbook = XLSX.readFile(result.path, { raw: false });

    addLog(`✅ Archivo cargado: ${result.name}`, 'success');
    mostrarSelectorHoja(workbook);
  } catch (error) {
    addLog(`❌ Error al cargar archivo: ${error.message}`, 'error');
  } finally {
    btnCargar.disabled = false;
    btnCargar.innerHTML = textoOriginal;
  }
}

// ============================
// SELECTOR HOJA / COLUMNAS
// ============================
function mostrarSelectorHoja(workbook) {
  const modal = document.createElement('div');
  modal.style.cssText =
    'position:fixed;inset:0;background:#0008;display:flex;align-items:center;justify-content:center;z-index:9999';

  modal.innerHTML = `
    <div style="background:#fff;padding:20px;width:500px;border-radius:8px;max-height:90vh;overflow-y:auto">
      <h3>📊 Importar Excel</h3>

      <label>Hoja:</label>
      <select id="sheetSelect" style="width:100%;padding:8px;margin-bottom:10px">
        ${workbook.SheetNames.map(
          (n, i) => `<option value="${i}">${n}</option>`
        ).join('')}
      </select>

      <label>Fila de encabezados:</label>
      <input id="headerRow" type="number" min="1" value="1" style="width:100%;padding:8px;margin-bottom:10px">

      <label>CLIENTE:</label>
      <select id="colNombre" style="width:100%;padding:8px;margin-bottom:10px"></select>

      <label>COLUMNAS DE TELÉFONO:</label>
      <div id="columnasContainer" style="margin-bottom:10px;padding:10px;background:#f0f9ff;border-radius:4px">
        <div id="telefonosList"></div>
        <button type="button" id="btnAgregarTelefono" style="margin-top:10px;padding:8px;background:#3b82f6;color:white;border:none;border-radius:4px;cursor:pointer">+ Agregar Teléfono</button>
      </div>

      <label>DIAS CORRIDOS:</label>
      <select id="colDias" style="width:100%;padding:8px;margin-bottom:20px"></select>

      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="btnCancelar" style="padding:8px 16px;background:#6b7280;color:white;border:none;border-radius:4px;cursor:pointer">Cancelar</button>
        <button id="btnAceptar" style="padding:8px 16px;background:#10b981;color:white;border:none;border-radius:4px;cursor:pointer">Importar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const sheetSelect = modal.querySelector('#sheetSelect');
  const headerRowInput = modal.querySelector('#headerRow');
  const colNombre = modal.querySelector('#colNombre');
  const colDias = modal.querySelector('#colDias');
  const telefonosList = modal.querySelector('#telefonosList');
  const btnAgregarTelefono = modal.querySelector('#btnAgregarTelefono');

  let columnasTelefono = [];
  let todasColumnas = [];

  const agregarColumnaTelefono = (valorInicial = '') => {
    const idx = columnasTelefono.length;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
    div.innerHTML = `
      <select class="colTelefono" style="flex:1;padding:8px">
        <option value="">-- seleccionar --</option>
        ${todasColumnas.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <button type="button" class="btnEliminar" style="padding:8px;background:#ef4444;color:white;border:none;border-radius:4px;cursor:pointer">✕</button>
    `;

    const select = div.querySelector('.colTelefono');
    if (valorInicial) select.value = valorInicial;

    div.querySelector('.btnEliminar').onclick = () => {
      div.remove();
      columnasTelefono = columnasTelefono.filter((_, i) => i !== idx);
    };

    telefonosList.appendChild(div);
    columnasTelefono.push(select);
  };

  const actualizarColumnas = () => {
    const sheetIndex = Number(sheetSelect.value);
    const headerRow = Number(headerRowInput.value) - 1;
    const sheet = workbook.Sheets[workbook.SheetNames[sheetIndex]];

    // ⚡ OPTIMIZACIÓN: Solo leer primeras 5 filas para detectar columnas
    const data = XLSX.utils.sheet_to_json(sheet, {
      range: headerRow,
      header: 1,
      defval: '',
      raw: false
    });

    if (!data.length || !data[0]) return;

    // Obtener nombres de columnas de la primera fila
    todasColumnas = data[0].filter(col => col && col.trim());

    // Actualizar columna nombre y días
    [colNombre, colDias].forEach(sel => {
      sel.innerHTML =
        '<option value="">-- seleccionar --</option>' +
        todasColumnas.map(c => `<option value="${c}">${c}</option>`).join('');
    });

    if (todasColumnas.includes('CLIENTE')) colNombre.value = 'CLIENTE';
    if (todasColumnas.includes('DIAS CORRIDOS')) colDias.value = 'DIAS CORRIDOS';

    // Detectar columnas de teléfono automáticamente
    const colsTelefono = todasColumnas.filter(c =>
      c.toUpperCase().includes('TELEFONO') ||
      c.toUpperCase().includes('TELÉFONO') ||
      c.toUpperCase().includes('TEL')
    );

    // Limpiar lista y agregar columnas detectadas
    telefonosList.innerHTML = '';
    columnasTelefono = [];

    if (colsTelefono.length > 0) {
      colsTelefono.forEach(col => agregarColumnaTelefono(col));
    } else {
      agregarColumnaTelefono(); // Agregar al menos una vacía
    }

    addLog(`📌 Encabezados detectados: ${todasColumnas.join(', ')}`, 'info');
    if (colsTelefono.length > 0) {
      addLog(`📱 Columnas de teléfono detectadas: ${colsTelefono.join(', ')}`, 'success');
    }
  };

  btnAgregarTelefono.onclick = () => agregarColumnaTelefono();

  sheetSelect.onchange = actualizarColumnas;
  headerRowInput.oninput = actualizarColumnas;
  actualizarColumnas();

  modal.querySelector('#btnCancelar').onclick = () => modal.remove();

  modal.querySelector('#btnAceptar').onclick = () => {
    const columnasSeleccionadas = columnasTelefono
      .map(sel => sel.value)
      .filter(val => val !== '');

    if (columnasSeleccionadas.length === 0) {
      addLog('❌ Debe seleccionar al menos una columna de teléfono', 'error');
      return;
    }

    modal.remove();
    procesarExcel(
      workbook,
      Number(sheetSelect.value),
      colNombre.value,
      columnasSeleccionadas,
      colDias.value,
      Number(headerRowInput.value) - 1
    );
  };
}

// ============================
// EXTRAER NÚMEROS DE 10 DÍGITOS
// ============================
function extraerNumerosDe10Digitos(texto) {
  // Convertir a string y eliminar espacios
  const textoLimpio = String(texto || '').replace(/\s/g, '');

  // Extraer todos los dígitos
  const soloDigitos = textoLimpio.replace(/\D/g, '');

  const numeros = [];

  // Si toda la cadena de dígitos es de 10, retornarla
  if (soloDigitos.length === 10) {
    numeros.push(soloDigitos);
    return numeros;
  }

  // Buscar todos los grupos de exactamente 10 dígitos consecutivos
  const regex = /\d{10}/g;
  const matches = textoLimpio.match(regex);

  if (matches) {
    // Agregar números únicos
    matches.forEach(num => {
      const numLimpio = num.replace(/\D/g, '');
      if (numLimpio.length === 10 && !numeros.includes(numLimpio)) {
        numeros.push(numLimpio);
      }
    });
  }

  // Si no encontramos números de 10 dígitos exactos,
  // intentar extraer del string completo de dígitos
  if (numeros.length === 0 && soloDigitos.length >= 10) {
    // Tomar los primeros 10 dígitos
    numeros.push(soloDigitos.substring(0, 10));

    // Si hay más de 10 dígitos, intentar extraer otro número
    if (soloDigitos.length >= 20) {
      numeros.push(soloDigitos.substring(10, 20));
    }
  }

  return numeros;
}

// ============================
// PROCESAR EXCEL (SIN FILTRAR)
// ============================
async function procesarExcel(workbook, sheetIndex, colNombre, columnasTelefono, colDias, headerRow) {
  addLog(`⚙️ Procesando datos...`, 'info');

  // Pequeño delay para que se muestre el mensaje
  await new Promise(resolve => setTimeout(resolve, 10));

  const sheet = workbook.Sheets[workbook.SheetNames[sheetIndex]];
  const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRow, defval: '' });

  addLog(`📊 Procesando ${rows.length} filas...`, 'info');

  // ✅ CARGAR TODOS - Crear entrada por cada teléfono
  appState.contactos = [];
  let totalTelefonosExtraidos = 0;

  // Procesar en lotes para no bloquear la UI
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    batch.forEach(r => {
      const nombre = r[colNombre];
      const dias = Number(r[colDias]);

      // Procesar cada columna de teléfono
      columnasTelefono.forEach(colTel => {
        const valorCelda = r[colTel];

        // Extraer todos los números de 10 dígitos de esta celda
        const telefonosEncontrados = extraerNumerosDe10Digitos(valorCelda);

        // Agregar cada teléfono encontrado como un contacto separado
        telefonosEncontrados.forEach(telefono => {
          if (nombre && telefono) {
            appState.contactos.push({
              nombre,
              telefono,
              dias
            });
            totalTelefonosExtraidos++;
          }
        });
      });
    });

    // Pequeño delay cada lote para mantener UI responsiva
    if (i + BATCH_SIZE < rows.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  renderContactos();

  addLog(`👥 ${appState.contactos.length} contactos cargados`, 'success');
  addLog(`📱 ${totalTelefonosExtraidos} números de teléfono extraídos de ${columnasTelefono.length} columna(s)`, 'info');

  // Mostrar estadísticas de días
  const diasUnicos = [...new Set(appState.contactos.map(c => c.dias))].sort((a, b) => a - b);
  addLog(`📊 Días encontrados: ${diasUnicos.join(', ')}`, 'info');

  updateSendButton();
}

// ============================
// MENSAJES (FILTRA AQUÍ)
// ============================
function generarMensaje(c) {
  return appState.config.mensajeTemplate.replace('{nombre}', c.nombre);
}

function getContactosFiltrados() {
  // Prioridad: 1) Días configurados en Config, 2) Filtro de UI, 3) Todos
  const diasConfig = appState.config.diasEnvio;
  const diasUI = appState.filtrarDias;

  if (diasConfig) {
    const diasFiltro = Number(diasConfig);
    return appState.contactos.filter(c => c.dias === diasFiltro);
  }

  if (diasUI) {
    const diasFiltro = Number(diasUI);
    return appState.contactos.filter(c => c.dias === diasFiltro);
  }

  return appState.contactos;
}

async function enviarMensajes() {
  const aEnviar = getContactosFiltrados();

  if (!aEnviar.length) {
    const diasConfig = appState.config.diasEnvio;
    const diasUI = appState.filtrarDias;
    const msgFiltro = diasConfig
      ? `con ${diasConfig} días (desde Configuración)`
      : diasUI
      ? `con ${diasUI} días`
      : 'para enviar';
    addLog(`⚠️ No hay contactos ${msgFiltro}`, 'info');
    return;
  }

  const diasConfig = appState.config.diasEnvio;
  const diasUI = appState.filtrarDias;
  const filtroActivo = diasConfig
    ? ` (filtro: ${diasConfig} días desde Config)`
    : diasUI
    ? ` (filtro: ${diasUI} días)`
    : '';

  addLog(`📤 Enviando ${aEnviar.length} mensajes${filtroActivo}`, 'info');

  for (const c of aEnviar) {
    // Formatear número con código de país
    const numeroFormateado = formatearNumeroWhatsApp(c.telefono);

    await ipcRenderer.invoke('send-whatsapp', {
      token: appState.config.token,
      phoneId: appState.config.phoneId,
      numero: numeroFormateado,
      mensaje: generarMensaje(c)
    });

    addLog(`📲 Enviado a ${c.nombre}: +${numeroFormateado}`, 'info');
  }

  addLog('✅ Mensajes enviados correctamente', 'success');
}

// ============================
// FORMATEAR NÚMERO PARA WHATSAPP
// ============================
function formatearNumeroWhatsApp(telefono) {
  // Eliminar todo lo que no sea dígito
  const soloDigitos = String(telefono).replace(/\D/g, '');

  // Si ya tiene el código de país, retornarlo
  if (soloDigitos.startsWith(appState.config.codigoPais)) {
    return soloDigitos;
  }

  // Agregar código de país
  return appState.config.codigoPais + soloDigitos;
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

  const contactosMostrar = getContactosFiltrados();
  count.textContent = appState.filtrarDias
    ? `${contactosMostrar.length} / ${appState.contactos.length}`
    : appState.contactos.length;

  if (!contactosMostrar.length) {
    const msg = appState.filtrarDias
      ? `No hay contactos con ${appState.filtrarDias} días`
      : 'No hay contactos cargados';
    cont.innerHTML = `<p class="empty-state">${msg}</p>`;
    return;
  }

  contactosMostrar.forEach(c => {
    const numeroFormateado = formatearNumeroWhatsApp(c.telefono);
    cont.innerHTML += `
      <div class="contact-item">
        <strong>${c.nombre}</strong><br>
        📱 +${numeroFormateado} — ⏱ ${c.dias} días
      </div>
    `;
  });
}

function updateSendButton() {
  const btnEnviar = document.getElementById('btnEnviar');
  const contactosFiltrados = getContactosFiltrados();
  btnEnviar.disabled = contactosFiltrados.length === 0;
}

function addLog(msg, type = 'info') {
  const list = document.getElementById('logsList');
  if (!list) return;

  const div = document.createElement('div');
  div.className = `log-item log-${type}`;
  div.innerHTML = `<strong>${new Date().toLocaleTimeString()}</strong> — ${msg}`;
  list.prepend(div);
}