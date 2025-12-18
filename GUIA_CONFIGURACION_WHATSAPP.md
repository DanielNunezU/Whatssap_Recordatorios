# Guía de Configuración - WhatsApp Business API

## 📋 Requisitos Previos

- Cuenta de Facebook
- Cuenta de Meta Business (antes Facebook Business)
- Número de teléfono que no esté registrado en WhatsApp
- Verificación de identidad de negocio (para token permanente)

---

## 🚀 Paso 1: Crear Aplicación en Meta for Developers

### 1.1 Acceder a Meta for Developers
1. Ve a https://developers.facebook.com/
2. Inicia sesión con tu cuenta de Facebook
3. Click en **"Mis Apps"** (esquina superior derecha)

### 1.2 Crear Nueva Aplicación
1. Click en **"Crear App"**
2. Selecciona **"Empresa"** como tipo de aplicación
3. Completa la información:
   - **Nombre de la app**: "Recordatorios WhatsApp" (o el que prefieras)
   - **Correo de contacto**: tu email
   - **Cuenta de empresa**: Selecciona o crea una
4. Click en **"Crear app"**

---

## 📱 Paso 2: Configurar WhatsApp Business

### 2.1 Agregar Producto WhatsApp
1. En el panel de tu aplicación, busca **"WhatsApp"** en la lista de productos
2. Click en **"Configurar"**
3. Selecciona tu **Meta Business Account** (o crea uno nuevo)

### 2.2 Configuración Inicial
1. En la sección **"Configuración de API"**, verás:
   - **Número de prueba de WhatsApp**: un número temporal para pruebas
   - **ID del número de teléfono**: copia este número (lo necesitarás)
   - **Token de acceso temporal**: válido por 24 horas

---

## 🔑 Paso 3: Obtener Token Permanente

### 3.1 Crear App de Sistema

1. Ve a **Meta Business Suite**: https://business.facebook.com/
2. Click en **Configuración del negocio** (icono de tuerca)
3. En el menú lateral, ve a **"Usuarios" → "Usuarios del sistema"**
4. Click en **"Agregar"** para crear un nuevo usuario del sistema
5. Nombre: "WhatsApp Recordatorios Bot"
6. Rol: **"Administrador"**
7. Click en **"Crear usuario del sistema"**

### 3.2 Generar Token Permanente

1. En la lista de usuarios del sistema, click en el que acabas de crear
2. Click en **"Generar nuevo token"**
3. Selecciona tu aplicación de WhatsApp
4. En **Permisos**, selecciona:
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_management`
   - ✅ `business_management`
5. **Duración del token**: Selecciona **"60 días"** o **"Nunca caduca"**
6. Click en **"Generar token"**
7. **¡IMPORTANTE!** Copia el token inmediatamente y guárdalo en un lugar seguro
   - El token empieza con `EAA...`
   - No podrás verlo de nuevo

---

## 📞 Paso 4: Registrar Número de Teléfono Propio

### 4.1 Agregar Número de Teléfono

1. En el panel de WhatsApp de tu app, ve a **"Primeros pasos"**
2. Busca la sección **"Configurar el número de teléfono"**
3. Click en **"Agregar número de teléfono"**
4. Selecciona:
   - **Nuevo número**: Si tienes un número que no está en WhatsApp
   - **Número existente**: Si quieres migrar un número de WhatsApp Business
5. Completa el proceso de verificación (recibirás un código SMS o llamada)

### 4.2 Obtener Phone Number ID

1. Una vez registrado el número, ve a **"Configuración de API"**
2. En **"Números de teléfono"**, verás tu número registrado
3. Copia el **"Phone Number ID"** (número largo de ~15 dígitos)
4. **Este es el ID que usarás en la aplicación**

---

## ⚙️ Paso 5: Configurar la Aplicación

### 5.1 Abrir Aplicación de Recordatorios

1. Ejecuta `WhatsApp Recordatorios-1.0.0-Portable.exe`
2. Click en el botón **"⚙️ Configuración"**

### 5.2 Ingresar Credenciales

Completa los siguientes campos:

| Campo | Valor | Ejemplo |
|-------|-------|---------|
| **Token de Acceso** | Token permanente que generaste | `EAAxxxxxxxxxxxxxxxx...` |
| **Phone Number ID** | ID del número de teléfono | `123456789012345` |
| **Código de País** | Código de tu país sin + | `57` (Colombia) |
| **Hora de ejecución diaria** | Hora para envíos automáticos | `08:00` |
| **Plantilla de mensaje** | Personaliza tu mensaje | (usar variables {nombre}) |

### 5.3 Guardar Configuración

1. Click en **"💾 Guardar Configuración"**
2. Verás el mensaje: "✅ Configuración guardada"

---

## 🧪 Paso 6: Probar la Conexión

### 6.1 Preparar Archivo de Prueba

Crea un archivo Excel (`.xlsx`) con las siguientes columnas:

| CLIENTE | TELEFONO | DIAS CORRIDOS |
|---------|----------|---------------|
| Juan Pérez | 3001234567 | 30 |
| María López | 3009876543 | 60 |

### 6.2 Cargar y Enviar Prueba

1. En la aplicación, click en **"📂 Cargar Excel/CSV"**
2. Selecciona tu archivo
3. Mapea las columnas correctamente
4. Click en **"Importar"**
5. Click en **"📤 Enviar Ahora"** para una prueba
6. Revisa el **"Registro de Actividad"** para ver si se enviaron correctamente

---

## ⚠️ Verificación de Negocio (Necesario para Producción)

### Para enviar mensajes a usuarios que NO sean de prueba, necesitas:

1. **Verificar tu negocio** en Meta Business Manager
2. Proceso de verificación:
   - Ve a Meta Business Suite → Configuración del negocio
   - Sección **"Seguridad"** → **"Verificación de negocio"**
   - Sube documentos legales de tu empresa
   - Espera aprobación (puede tomar 1-3 días hábiles)

3. **Aprobar plantillas de mensaje**:
   - Los mensajes proactivos requieren plantillas aprobadas por Meta
   - Ve a WhatsApp Manager → Plantillas de mensaje
   - Crea y envía plantillas para aprobación

---

## 🔐 Seguridad del Token

### Mejores Prácticas:

1. ✅ **Nunca compartas tu token** en repositorios públicos
2. ✅ **Guarda el token en un lugar seguro** (gestor de contraseñas)
3. ✅ **Renueva el token periódicamente** si lo configuraste con expiración
4. ✅ **Limita los permisos** solo a lo necesario
5. ❌ **No lo envíes por email o chat** sin encriptar

### Si tu token se compromete:

1. Ve inmediatamente a Meta Business Suite
2. Usuarios del sistema → Selecciona tu bot
3. **"Revocar tokens"** → Selecciona el token comprometido
4. Genera un nuevo token
5. Actualiza la configuración en la aplicación

---

## 📊 Límites de WhatsApp Business API

### Límites de Mensajería (según nivel de calidad):

| Nivel | Mensajes por 24h |
|-------|------------------|
| **Nuevo** | 250 conversaciones |
| **Nivel 1** | 1,000 conversaciones |
| **Nivel 2** | 10,000 conversaciones |
| **Nivel 3** | 100,000 conversaciones |
| **Ilimitado** | Sin límite (previa aprobación) |

**Nota**: El nivel sube automáticamente si mantienes buena calidad de mensajes (bajo reporte de spam)

---

## 🆘 Solución de Problemas

### Error: "Invalid access token"
- ✅ Verifica que copiaste el token completo
- ✅ Asegúrate de que el token no haya expirado
- ✅ Genera un nuevo token si es necesario

### Error: "Phone number not registered"
- ✅ Verifica que el Phone Number ID sea correcto
- ✅ Asegúrate de que el número esté verificado en WhatsApp Manager

### Error: "Unable to send message"
- ✅ Verifica que el formato del teléfono sea correcto (solo dígitos)
- ✅ Asegúrate de incluir el código de país
- ✅ Verifica que no hayas alcanzado el límite de mensajes

### Los mensajes no llegan
- ✅ Verifica que el destinatario tenga WhatsApp activo
- ✅ El número del destinatario debe estar registrado en WhatsApp
- ✅ Para números no de prueba, necesitas verificación de negocio

---

## 📞 Soporte Adicional

- **Documentación oficial**: https://developers.facebook.com/docs/whatsapp
- **WhatsApp Business API**: https://business.whatsapp.com/
- **Meta Business Help**: https://www.facebook.com/business/help

---

## ✅ Checklist Final

Antes de usar en producción, asegúrate de:

- [ ] Token permanente generado y guardado
- [ ] Phone Number ID correcto
- [ ] Número de teléfono verificado
- [ ] Negocio verificado en Meta
- [ ] Plantillas de mensaje aprobadas (si aplica)
- [ ] Pruebas exitosas con números de prueba
- [ ] Configuración guardada en la aplicación

---

**¡Listo!** Tu aplicación está configurada y lista para enviar recordatorios automáticos por WhatsApp Business.
