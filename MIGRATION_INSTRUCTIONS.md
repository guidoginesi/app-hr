# 📋 Instrucciones para Aplicar el Schema del Funnel

## Paso 1: Aplicar el Schema en Supabase

1. **Abrí tu proyecto en Supabase:**
   - Ve a https://supabase.com/dashboard
   - Seleccioná tu proyecto

2. **Abrí el SQL Editor:**
   - En el menú lateral, click en "SQL Editor"
   - O ve directamente a: `https://supabase.com/dashboard/project/[TU_PROJECT_ID]/sql`

3. **Ejecutá el script de migración:**
   - Click en "New query"
   - Copiá TODO el contenido del archivo `db/migration-funnel.sql`
   - Pegalo en el editor
   - Click en "Run" (o presioná Cmd/Ctrl + Enter)

4. **Verificá que funcionó:**
   - Deberías ver un mensaje de éxito
   - Si hay errores, revisá que las tablas `jobs`, `candidates` y `applications` ya existan

## Paso 2: Migrar Aplicaciones Existentes (Opcional)

Si ya tenés aplicaciones en la base de datos, ejecutá el script de migración:

```bash
node scripts/migrate-applications-to-funnel.mjs
```

Este script:
- Actualiza todas las aplicaciones existentes para usar el nuevo modelo
- Mapea el campo `status` legacy a `current_stage` y `current_stage_status`
- Crea registros iniciales en `stage_history`

## Paso 3: Verificar que Todo Funciona

1. **Verificá en Supabase:**
   - Ve a "Table Editor" → `applications`
   - Deberías ver las nuevas columnas: `current_stage`, `current_stage_status`, etc.

2. **Probá en la app:**
   - Entrá a `/admin/candidates`
   - Abrí un candidato
   - Deberías ver el pipeline visual
   - Probá cambiar etapas con "Editar etapa"

## ⚠️ Notas Importantes

- El script de migración es **seguro** - no elimina datos existentes
- Las aplicaciones nuevas se crearán automáticamente con el nuevo modelo
- El campo `status` se mantiene para compatibilidad (pero está deprecated)

## 🐛 Si Algo Sale Mal

Si hay errores al ejecutar el SQL:

1. **Error: "type already exists"**
   - Es normal si ya ejecutaste el script antes
   - Podés ignorarlo o comentar esas líneas

2. **Error: "column already exists"**
   - Significa que ya tenés las columnas
   - Podés saltar ese paso

3. **Error de permisos:**
   - Asegurate de estar usando el SQL Editor (no necesitás permisos especiales)

## ✅ Checklist

- [ ] Schema aplicado en Supabase
- [ ] Aplicaciones existentes migradas (opcional)
- [ ] Pipeline visible en `/admin/candidates`
- [ ] Cambio de etapas funcionando

