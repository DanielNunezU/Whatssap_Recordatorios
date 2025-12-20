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

  // Mostrar ayuda inicial si no hay credenciales configuradas
  if (!appState.config.token || !appState.config.phoneId) {
    setTimeout(() => {
      addLog('⚠️ No se han configurado las credenciales de WhatsApp Business', 'info');
      addLog('📝 Haz clic en "Configuración" y luego en "🔌 Probar Conexión" para obtener ayuda', 'info');
    }, 1000);
  }
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
  document.getElementById('btnTestConnection')?.addEventListener('click', testWhatsAppConnection);

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
      renderContactos();
      updateSendButton();
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

  // Cargar valores en los campos EXCEPTO diasEnvio (siempre inicia vacío)
  Object.keys(appState.config).forEach(k => {
    if (k === 'diasEnvio') return; // NO cargar diasEnvio
    const el = document.getElementById(k);
    if (el) el.value = appState.config[k];
  });

  // Resetear diasEnvio a vacío al iniciar
  appState.config.diasEnvio = '';
  const diasEnvioEl = document.getElementById('diasEnvio');
  if (diasEnvioEl) diasEnvioEl.value = '';

  addLog('⚙️ Configuración cargada', 'info');
}

async function saveConfig() {
  // Guardar config SIN diasEnvio (solo temporal para la sesión)
  const configToSave = { ...appState.config };
  delete configToSave.diasEnvio; // No guardar diasEnvio

  await ipcRenderer.invoke('save-config', configToSave);
  addLog('💾 Configuración guardada', 'success');
}

// ============================
// PRUEBA DE CONEXIÓN
// ============================
async function testWhatsAppConnection() {
  const btnTest = document.getElementById('btnTestConnection');

  // Validar que los campos estén llenos
  if (!appState.config.token || !appState.config.phoneId) {
    addLog('❌ Por favor ingresa el Token y Phone Number ID primero', 'error');
    mostrarModalAyuda();
    return;
  }

  addLog('🔄 Probando conexión con WhatsApp Business...', 'info');
  btnTest.disabled = true;
  btnTest.textContent = '⏳ Probando...';

  try {
    // Intentar obtener información del número de teléfono
    const result = await ipcRenderer.invoke('test-whatsapp-connection', {
      token: appState.config.token,
      phoneId: appState.config.phoneId
    });

    if (result.success) {
      addLog('✅ ¡Conexión exitosa con WhatsApp Business!', 'success');
      addLog(`📱 Número verificado: ${result.phoneNumber || 'N/A'}`, 'success');
      addLog(`📊 Estado: ${result.status || 'Activo'}`, 'success');
    } else {
      addLog('❌ Error de conexión: ' + result.error, 'error');

      // Mensajes de ayuda específicos según el error
      if (result.error.includes('Invalid OAuth') || result.error.includes('access token')) {
        addLog('💡 El Token de Acceso parece inválido o ha expirado', 'info');
        addLog('📝 Genera un nuevo token en Meta Business Suite', 'info');
      } else if (result.error.includes('phone number') || result.error.includes('Phone number')) {
        addLog('💡 El Phone Number ID parece incorrecto', 'info');
        addLog('📝 Verifica el ID en WhatsApp Manager', 'info');
      }

      mostrarModalAyuda();
    }
  } catch (error) {
    addLog('❌ Error al probar conexión: ' + error.message, 'error');
    mostrarModalAyuda();
  } finally {
    btnTest.disabled = false;
    btnTest.textContent = '🔌 Probar Conexión';
  }
}

// ============================
// MODAL DE AYUDA
// ============================
function mostrarModalAyuda() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:#0008;display:flex;align-items:center;justify-content:center;z-index:9999';

  modal.innerHTML = `
    <div style="background:#fff;padding:30px;width:600px;border-radius:12px;max-height:90vh;overflow-y:auto">
      <h2 style="margin-top:0;color:#2563eb">🔧 ¿Cómo conectar con WhatsApp Business?</h2>

      <div style="background:#fef3c7;padding:15px;border-radius:8px;margin-bottom:20px">
        <strong>⚠️ Necesitas dos credenciales principales:</strong>
        <ol style="margin:10px 0 0 0">
          <li><strong>Token de Acceso</strong> (empieza con "EAA...")</li>
          <li><strong>Phone Number ID</strong> (número de ~15 dígitos)</li>
        </ol>
      </div>

      <h3 style="color:#2563eb">📋 Pasos rápidos:</h3>
      <ol style="line-height:1.8">
        <li><strong>Ir a Meta for Developers:</strong><br>
          <a href="https://developers.facebook.com/" target="_blank" style="color:#2563eb">https://developers.facebook.com/</a>
        </li>
        <li><strong>Crear o seleccionar tu App</strong></li>
        <li><strong>Agregar producto WhatsApp Business</strong></li>
        <li><strong>Obtener Phone Number ID:</strong><br>
          Ve a <em>WhatsApp → Primeros pasos → Configuración API</em>
        </li>
        <li><strong>Obtener Token Permanente:</strong><br>
          Ve a <em>Meta Business Suite → Usuarios del sistema → Generar token</em>
        </li>
      </ol>

      <div style="background:#dbeafe;padding:15px;border-radius:8px;margin:20px 0">
        <strong>📖 Guía completa disponible:</strong><br>
        Lee el archivo <code>GUIA_CONFIGURACION_WHATSAPP.md</code> para instrucciones detalladas paso a paso.
      </div>

      <h3 style="color:#dc2626">🔍 Problemas comunes:</h3>
      <ul style="line-height:1.8">
        <li><strong>Token inválido:</strong> Verifica que copiaste el token completo (muy largo, empieza con "EAA")</li>
        <li><strong>Token expirado:</strong> Genera un nuevo token permanente</li>
        <li><strong>Phone Number ID incorrecto:</strong> Debe ser el ID del número, no el número de teléfono</li>
        <li><strong>Número no verificado:</strong> Completa la verificación en WhatsApp Manager</li>
      </ul>

      <div style="margin-top:20px;text-align:center">
        <button onclick="this.parentElement.parentElement.parentElement.remove()"
                style="padding:12px 24px;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px">
          Entendido
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
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
  if (!texto) return [];

  // Convertir a string y extraer solo dígitos
  const soloDigitos = String(texto).replace(/\D/g, '');

  const numeros = [];

  // Si tiene exactamente 10 dígitos, retornar
  if (soloDigitos.length === 10) {
    return [soloDigitos];
  }

  // Buscar grupos de 10 dígitos consecutivos
  for (let i = 0; i <= soloDigitos.length - 10; i++) {
    const grupo = soloDigitos.substr(i, 10);
    if (!numeros.includes(grupo)) {
      numeros.push(grupo);
      i += 9; // Saltar para evitar solapamientos
    }
  }

  return numeros;
}

// ============================
// PROCESAR EXCEL (SIN FILTRAR)
// ============================
async function procesarExcel(workbook, sheetIndex, colNombre, columnasTelefono, colDias, headerRow) {
  const startTime = Date.now();
  addLog(`⚙️ Procesando datos...`, 'info');

  // Pequeño delay para que se muestre el mensaje
  await new Promise(resolve => setTimeout(resolve, 10));

  const sheet = workbook.Sheets[workbook.SheetNames[sheetIndex]];
  const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRow, defval: '' });

  addLog(`📊 Procesando ${rows.length} filas...`, 'info');

  // ✅ CARGAR TODOS - Crear entrada por cada teléfono
  appState.contactos = [];
  let totalTelefonosExtraidos = 0;

  // ⚡ Procesar en lotes más grandes para mejor rendimiento
  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const start = batchNum * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, rows.length);
    const batch = rows.slice(start, end);

    batch.forEach(r => {
      const nombre = r[colNombre];
      const dias = Number(r[colDias]);

      if (!nombre) return; // Skip si no hay nombre

      // Procesar cada columna de teléfono
      columnasTelefono.forEach(colTel => {
        const valorCelda = r[colTel];
        if (!valorCelda) return;

        // Extraer todos los números de 10 dígitos de esta celda
        const telefonosEncontrados = extraerNumerosDe10Digitos(valorCelda);

        // Agregar cada teléfono encontrado como un contacto separado
        telefonosEncontrados.forEach(telefono => {
          appState.contactos.push({
            nombre,
            telefono,
            dias
          });
          totalTelefonosExtraidos++;
        });
      });
    });

    // Mostrar progreso cada 25%
    const progreso = Math.round(((batchNum + 1) / totalBatches) * 100);
    if (progreso % 25 === 0 && batchNum < totalBatches - 1) {
      addLog(`⏳ Progreso: ${progreso}% (${end} de ${rows.length} filas)`, 'info');
    }

    // Pequeño delay cada lote para mantener UI responsiva
    if (batchNum < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  renderContactos();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  addLog(`👥 ${appState.contactos.length} contactos cargados en ${duration}s`, 'success');
  addLog(`📱 ${totalTelefonosExtraidos} números extraídos de ${columnasTelefono.length} columna(s)`, 'info');

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

// Filtro para VISUALIZACIÓN (solo usa filtro de UI)
function getContactosParaMostrar() {
  if (!appState.filtrarDias) {
    return appState.contactos;
  }
  const diasFiltro = Number(appState.filtrarDias);
  return appState.contactos.filter(c => c.dias === diasFiltro);
}

// Filtro para ENVÍO (usa diasEnvio de Config si está configurado, sino filtro UI)
function getContactosParaEnviar() {
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
  // Validar credenciales
  if (!appState.config.token || !appState.config.phoneId) {
    addLog('❌ Error: No has configurado las credenciales de WhatsApp Business', 'error');
    addLog('💡 Por favor, ve a Configuración y completa el Token y Phone Number ID', 'info');
    mostrarModalAyuda();
    return;
  }

  const aEnviar = getContactosParaEnviar();

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

  let exitosos = 0;
  let fallidos = 0;

  for (const c of aEnviar) {
    // Formatear número con código de país
    const numeroFormateado = formatearNumeroWhatsApp(c.telefono);

    const result = await ipcRenderer.invoke('send-whatsapp', {
      token: appState.config.token,
      phoneId: appState.config.phoneId,
      numero: numeroFormateado,
      mensaje: generarMensaje(c)
    });

    if (result.success) {
      addLog(`✅ Enviado a ${c.nombre}: +${numeroFormateado}`, 'success');
      exitosos++;
    } else {
      addLog(`❌ Error al enviar a ${c.nombre} (+${numeroFormateado}): ${result.error}`, 'error');
      fallidos++;

      // Detener envíos si hay error de autenticación
      if (result.error.includes('Invalid OAuth') || result.error.includes('access token')) {
        addLog('🛑 Deteniendo envíos: Token de acceso inválido o expirado', 'error');
        addLog('💡 Por favor, genera un nuevo token en Meta Business Suite', 'info');
        mostrarModalAyuda();
        break;
      }
    }

    // Pequeño delay entre mensajes para no saturar la API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Resumen final
  if (exitosos > 0) {
    addLog(`✅ Proceso completado: ${exitosos} enviados, ${fallidos} fallidos`, exitosos > fallidos ? 'success' : 'info');
  } else {
    addLog('❌ No se pudo enviar ningún mensaje', 'error');
  }
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

  const contactosMostrar = getContactosParaMostrar();
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

  // ⚡ Usar DocumentFragment para renderizado eficiente
  const fragment = document.createDocumentFragment();

  contactosMostrar.forEach(c => {
    const numeroFormateado = formatearNumeroWhatsApp(c.telefono);
    const div = document.createElement('div');
    div.className = 'contact-item';
    div.innerHTML = `
      <strong>${c.nombre}</strong><br>
      📱 +${numeroFormateado} — ⏱ ${c.dias} días
    `;
    fragment.appendChild(div);
  });

  cont.appendChild(fragment);
}

function updateSendButton() {
  const btnEnviar = document.getElementById('btnEnviar');
  const contactosParaEnviar = getContactosParaEnviar();
  btnEnviar.disabled = contactosParaEnviar.length === 0;
}

function addLog(msg, type = 'info') {
  const list = document.getElementById('logsList');
  if (!list) return;

  const div = document.createElement('div');
  div.className = `log-item log-${type}`;
  div.innerHTML = `<strong>${new Date().toLocaleTimeString()}</strong> — ${msg}`;
  list.prepend(div);
}