# Desarrollo

## Estructura

El código completo está en `app/`. `public/rich.js` es un artefacto generado a partir de `rich-entry.js`; ejecuta `npm run build:editor` después de modificar el editor. No edites manualmente ese bundle.

## Comprobaciones

```sh
cd app
npm ci --ignore-scripts
npm run build:editor
npm test
```

Las pruebas crean bibliotecas temporales y no necesitan credenciales. La suite HTTP inicia un servidor temporal y comprueba respaldo, verificación, restauración y rechazo de escrituras desde otro origen. Las demás pruebas cubren migraciones, conflictos, jerarquías, archivos, fórmulas e importadores.

## Configuración del servidor

| Variable | Valor predeterminado | Uso |
| --- | --- | --- |
| `PORT` | `4317` | Puerto local; `0` elige uno disponible |
| `ESTUDIO_DATA_DIR` | `app/data` | Ruta absoluta de la biblioteca inicial |
| `ESTUDIO_SETTINGS` | `app/settings.json` | Ruta del archivo de ajustes |

Una biblioteca persistida en los ajustes tiene prioridad sobre `ESTUDIO_DATA_DIR`. Para un entorno de prueba aislado, utiliza rutas independientes para ambas variables. No apuntes pruebas destructivas a tu biblioteca personal.

## Distribución

Publica código fuente sin datos ni ajustes. Los instaladores pertenecen a los assets de una release, no al historial Git. Revisa la firma y la ausencia de rutas personales antes de distribuir un paquete. Consulta la guía de instalación para compilarlo.
