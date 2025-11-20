# Configuración de Notificaciones por Email

Este documento explica cómo configurar y usar el sistema de notificaciones por email automático.

## 📋 Requisitos Previos

1. Cuenta en [Resend](https://resend.com)
2. Dominio verificado en Resend (o usar el dominio de prueba)
3. API Key de Resend

## 🚀 Configuración Inicial

### 1. Aplicar Migración de Base de Datos

Ejecuta el SQL en Supabase SQL Editor:

```bash
# Opción 1: Usar el script (mostrará el SQL a ejecutar)
node scripts/apply-email-templates-migration.mjs

# Opción 2: Manualmente
# Ve a: Supabase Dashboard > SQL Editor
# Copia y pega el contenido de: db/migration-email-templates.sql
```

Esta migración crea:
- Tabla `email_templates` - Plantillas editables de emails
- Tabla `email_logs` - Registro de todos los emails enviados
- 3 plantillas por defecto (ver más abajo)

### 2. Configurar Variables de Entorno

Agrega estas variables en tu `.env.local`:

```bash
# Resend (Email notifications)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@tudominio.com
```

**Obtener API Key de Resend:**
1. Ve a https://resend.com/api-keys
2. Crea una nueva API Key
3. Cópiala y pégala en `.env.local`

**Email remitente:**
- Para pruebas: `onboarding@resend.dev` (funciona sin verificación)
- Para producción: Usa un email de tu dominio verificado

### 3. Verificar Instalación

El sistema debería funcionar automáticamente una vez que:
- ✅ La migración esté aplicada
- ✅ Las variables de entorno estén configuradas
- ✅ La aplicación esté ejecutándose

## 📧 Plantillas de Email

El sistema incluye 3 plantillas configurables desde el admin:

### 1. **Email Candidato Descartado (General)**
- **Clave**: `candidate_rejected`
- **Trigger**: Cuando se cambia el estado de una aplicación a `DISCARDED_IN_STAGE`
- **Variables disponibles**: `{{candidateName}}`, `{{jobTitle}}`, `{{stage}}`

### 2. **Email Coordinación Entrevista**
- **Clave**: `interview_coordination`
- **Trigger**: Cuando la etapa `HR_REVIEW` se marca como `COMPLETED`
- **Variables disponibles**: `{{candidateName}}`, `{{jobTitle}}`

### 3. **Email Candidato Descartado (Provincia OTRA)**
- **Clave**: `candidate_rejected_location`
- **Trigger**: Cuando un candidato se postula con provincia = `OTRA`
- **Variables disponibles**: `{{candidateName}}`, `{{jobTitle}}`, `{{provincia}}`

## 🎨 Personalizar Plantillas

1. Ve al admin: `/admin/configuracion`
2. Selecciona la plantilla que deseas editar
3. Modifica el **Asunto** y el **Cuerpo**
4. Usa las variables mostradas (ej: `{{candidateName}}`)
5. Haz clic en **Guardar Cambios**

## 🔍 Verificar Envíos

### En la Base de Datos

Consulta los emails enviados:

```sql
SELECT 
  el.candidate_email,
  el.template_key,
  el.subject,
  el.sent_at,
  el.error,
  c.name as candidate_name,
  j.title as job_title
FROM email_logs el
JOIN applications a ON a.id = el.application_id
JOIN candidates c ON c.id = a.candidate_id
JOIN jobs j ON j.id = a.job_id
ORDER BY el.sent_at DESC
LIMIT 20;
```

### En el Historial del Candidato

Los emails enviados también aparecen automáticamente en el historial de la aplicación en el admin.

## ⚙️ Cómo Funcionan los Triggers

### Trigger 1: Descarte General

```typescript
// En: /api/admin/applications/[id]/stage
// Cuando: status = DISCARDED_IN_STAGE

if (parsed.status === StageStatus.DISCARDED_IN_STAGE) {
  await sendTemplatedEmail({
    templateKey: 'candidate_rejected',
    to: candidate.email,
    variables: { candidateName, jobTitle, stage },
    applicationId
  });
}
```

### Trigger 2: Coordinación de Entrevista

```typescript
// En: /api/admin/applications/[id]/stage
// Cuando: stage = HR_REVIEW && status = COMPLETED

if (stage === Stage.HR_REVIEW && status === StageStatus.COMPLETED) {
  await sendTemplatedEmail({
    templateKey: 'interview_coordination',
    to: candidate.email,
    variables: { candidateName, jobTitle },
    applicationId
  });
}
```

### Trigger 3: Descarte Automático por Provincia

```typescript
// En: /api/candidates
// Cuando: provincia = 'OTRA' al postularse

if (provincia === 'OTRA') {
  // Descarta automáticamente
  // Envía email de rechazo por ubicación
  await sendTemplatedEmail({
    templateKey: 'candidate_rejected_location',
    to: email,
    variables: { candidateName, jobTitle, provincia },
    applicationId
  });
}
```

## 🛡️ Características de Seguridad

### Prevención de Duplicados

El sistema **previene automáticamente** el envío de emails duplicados:
- Cada email se registra en `email_logs`
- Antes de enviar, verifica si ya existe un registro con el mismo `template_key` y `application_id`
- Si ya fue enviado, no se envía nuevamente

### Manejo de Errores

- Los errores de envío se registran en `email_logs.error`
- Los errores NO bloquean el flujo normal de la aplicación
- Se loguean en la consola para debugging

## 🧪 Probar el Sistema

### 1. Probar Descarte por Provincia

1. Ve a una oferta de trabajo
2. Completa el formulario con provincia = "Otra"
3. Verifica que:
   - El candidato aparece como "Descartado" en el admin
   - Se envió un email (revisar Resend dashboard o email_logs)

### 2. Probar Coordinación de Entrevista

1. En el admin, selecciona un candidato en etapa "Revisión HR"
2. Marca la etapa como "Completado"
3. Verifica que se envió un email

### 3. Probar Descarte Manual

1. En el admin, selecciona cualquier candidato
2. Cambia el estado a "Descartado en Etapa"
3. Verifica que se envió un email

## 🐛 Troubleshooting

### Los emails no se envían

1. **Verifica las variables de entorno**:
   ```bash
   echo $RESEND_API_KEY
   echo $RESEND_FROM_EMAIL
   ```

2. **Revisa los logs del servidor**:
   ```bash
   # En desarrollo
   npm run dev
   # Busca errores relacionados con "email" o "resend"
   ```

3. **Verifica email_logs**:
   ```sql
   SELECT * FROM email_logs WHERE error IS NOT NULL ORDER BY sent_at DESC;
   ```

### El email se envía pero no llega

1. Verifica que el email de destino sea válido
2. Revisa la bandeja de spam
3. Ve al dashboard de Resend para ver el estado del envío
4. Si usas `onboarding@resend.dev`, solo funciona para emails de prueba

### Las plantillas no se actualizan

1. Verifica que la migración se aplicó correctamente
2. Refresca la página del admin
3. Revisa la consola del navegador para errores

## 📚 Recursos Adicionales

- [Documentación de Resend](https://resend.com/docs)
- [Pricing de Resend](https://resend.com/pricing) - 100 emails/día gratis
- [Variables de entorno en Next.js](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)

