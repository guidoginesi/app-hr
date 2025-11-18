# Configuración de Vercel

## Variables de Entorno Requeridas

Para que la aplicación funcione correctamente en Vercel, necesitas configurar las siguientes variables de entorno en el dashboard de Vercel:

### Variables Públicas (NEXT_PUBLIC_*)
Estas variables son accesibles tanto en el cliente como en el servidor:

- `NEXT_PUBLIC_SUPABASE_URL`: URL de tu proyecto Supabase
  - Ejemplo: `https://galmfdqysnhmvzefidma.supabase.co`

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Clave anónima de Supabase
  - Esta es la clave pública que se usa en el cliente

### Variables Privadas (Solo servidor)
Estas variables solo están disponibles en el servidor:

- `SUPABASE_SERVICE_ROLE_KEY`: Clave de servicio de Supabase
  - **IMPORTANTE**: Esta clave tiene permisos completos, nunca la expongas en el cliente
  - Se usa para operaciones del servidor como subir archivos y consultas administrativas

- `OPENAI_API_KEY`: Clave de API de OpenAI
  - Se usa para el análisis de CVs con IA

## Cómo Configurar en Vercel

1. Ve a tu proyecto en Vercel: https://vercel.com/dashboard
2. Selecciona tu proyecto `app-hr`
3. Ve a **Settings** → **Environment Variables**
4. Agrega cada variable de entorno:
   - Click en **Add New**
   - Ingresa el nombre de la variable
   - Ingresa el valor
   - Selecciona los ambientes donde aplica (Production, Preview, Development)
   - Click en **Save**

5. Después de agregar todas las variables, necesitas **redesplegar** la aplicación:
   - Ve a **Deployments**
   - Click en los tres puntos (...) del último deployment
   - Selecciona **Redeploy**

## Verificación

Después de configurar las variables y redesplegar, verifica que:
- La aplicación carga correctamente
- No hay errores en los logs de Vercel
- Las rutas API funcionan correctamente

## Troubleshooting

Si sigues viendo errores después de configurar las variables:

1. Verifica que todas las variables estén escritas correctamente (sin espacios extra)
2. Verifica que las variables estén habilitadas para el ambiente correcto (Production)
3. Revisa los logs de Vercel en **Deployments** → Click en el deployment → **Logs**
4. Asegúrate de que las claves de Supabase sean válidas y no hayan expirado

