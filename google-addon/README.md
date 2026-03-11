# Add-on de Reserva de Salas — Google Calendar

Widget para Google Calendar que permite reservar salas directamente desde el sidebar,
conectado al sistema de reservas de app-hr.

---

## Requisitos previos

1. Tu app-hr debe estar deployada y accesible (Vercel, etc.)
2. El `ADDON_SECRET` en `.env.local` debe estar seteado en Vercel también
3. Tener acceso a la cuenta de Google Workspace de tu organización

---

## Pasos para deployar el Add-on

### 1. Crear el proyecto en Google Apps Script

1. Ir a [script.google.com](https://script.google.com)
2. Click en **+ Nuevo proyecto**
3. Renombrarlo: `Reserva de Salas POW`

### 2. Pegar el código

En el editor de GAS, abrís el archivo `Code.gs` (ya existe por defecto) y:
- Reemplazás todo el contenido con el contenido de `google-addon/Code.gs`

### 3. Actualizar el manifest (appsscript.json)

En el editor de GAS:
1. Click en el ícono ⚙️ (Configuración del proyecto)
2. Activar **"Mostrar archivo de manifiesto appsscript.json en el editor"**
3. Ir al archivo `appsscript.json` en el editor
4. Reemplazar todo el contenido con el de `google-addon/appsscript.json`

### 4. Configurar las propiedades del script

En el editor de GAS:
1. Click en ⚙️ → **Propiedades del proyecto** → **Propiedades del script**
2. Agregar estas dos propiedades:

| Propiedad     | Valor                                      |
|---------------|--------------------------------------------|
| `APP_URL`     | `https://TU-APP.vercel.app` (sin slash al final) |
| `ADDON_SECRET`| El mismo valor que tenés en `.env.local`   |

> ⚠️ El `ADDON_SECRET` en tu Vercel también debe estar configurado como variable de entorno.

### 5. Deploy como Add-on de prueba

1. Click en **Implementar** → **Nueva implementación**
2. Tipo: **Add-on**
3. Click en **Implementar**
4. Copiar el **ID de implementación**

### 6. Instalar en Google Calendar (uso interno)

**Opción A — Solo para vos (testing):**
1. En el editor GAS: **Implementar** → **Probar implementaciones**
2. Seleccionar la implementación y click en el link de instalación
3. Otorgar los permisos solicitados
4. Abrir [calendar.google.com](https://calendar.google.com) → ver el ícono del add-on en la barra lateral derecha

**Opción B — Para todos en tu organización (Google Workspace admin):**
1. Ir a Google Admin Console → Apps → Google Workspace Marketplace
2. Instalar el add-on usando el ID de tu proyecto GAS
   (Requiere permisos de administrador de Workspace)

---

## Uso del Add-on

Una vez instalado, en Google Calendar verás un ícono de calendario en la barra lateral derecha.

**Flujo principal:**
1. Abrís el add-on (o creás un evento → se pre-carga el horario automáticamente)
2. Seleccionás fecha y hora de inicio/fin
3. Click en **"Ver salas disponibles"**
4. Elegís una sala libre (las ocupadas se muestran en gris)
5. Ingresás título y notas opcionales
6. Click en **"Confirmar reserva"**
7. Recibís un email de confirmación y la reserva aparece en app-hr

**Mis reservas:**
- Click en "Mis reservas" para ver tus próximas reservas
- Cada reserva tiene un botón "Cancelar"

---

## Troubleshooting

**"Employee not found"**: Tu email de Google no coincide con el `work_email` del empleado en Supabase.

**"Invalid addon key"**: El `ADDON_SECRET` en Script Properties no coincide con el de tu Vercel.

**El add-on no aparece**: Asegurate de haberlo instalado via "Probar implementaciones" y refresca Google Calendar.

**Error 401 en los logs**: Verificá que `ADDON_SECRET` está seteado en Vercel (Settings → Environment Variables).
