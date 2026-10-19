# Instalación y biblioteca

## Desarrollo local

Instala Node.js 26 o posterior y ejecuta los pasos del README. Usa la dirección exacta `http://127.0.0.1:4317`; el servidor comprueba Host y Origin. No lo expongas a Internet ni a una red compartida.

## Compilar para macOS Apple Silicon

Requisitos: macOS, herramientas de línea de comandos de Xcode, Python 3 y una distribución oficial de Node para darwin-arm64. La versión utilizada para validar esta entrega fue Node 26.12.0. Descarga el archivo y el fichero SHASUMS256.txt desde [Node.js](https://nodejs.org/dist/v26.12.0/), verifica el SHA-256 y extrae el runtime fuera del repositorio.

Desde la raíz del repositorio:

```sh
mkdir -p work outputs
cd app
npm ci --ignore-scripts
npm run build:editor
cd ..
swiftc -target arm64-apple-macosx13.0 -module-cache-path work/swift-cache app/native/Estudio.swift -o work/Estudio -framework Cocoa -framework WebKit
python3 app/scripts/build-macos.py --runtime /ruta/node-v26.12.0-darwin-arm64 --binary work/Estudio --dmg
```

El resultado se guarda en `outputs/Estudio.app` y `outputs/Estudio-Mac-AppleSilicon.dmg`. El script firma localmente y verifica la aplicación; no sustituye el proceso de Developer ID y notarización necesario para una distribución pública de confianza. Las compilaciones locales pueden no ser aceptadas automáticamente por Gatekeeper. El DMG se genera desde una copia temporal verificada: carpetas sincronizadas como Documents pueden añadir metadatos Finder a la copia `.app` suelta y alterar su verificación posterior. Utiliza el DMG para distribuirla.

## Almacenamiento

En la aplicación nativa, la biblioteca inicial se crea en `~/Library/Application Support/Estudio/Biblioteca`. Los ajustes se guardan en el mismo directorio de Estudio. En el modo web de desarrollo, la ubicación inicial es `app/data`.

Para utilizar un SSD externo, crea una carpeta vacía desde Finder y selecciónala desde Biblioteca. Conecta el disco antes de abrir la aplicación. Una unidad ausente o distinta bloquea las operaciones: no se crea otra biblioteca silenciosamente. No desconectes el disco durante una escritura o un respaldo.

## Respaldo y recuperación

Usa Biblioteca para crear y verificar un respaldo completo. Incluye SQLite y adjuntos, con manifiesto y hashes SHA-256. Restaurar crea una carpeta nueva; revisa el resultado antes de cambiar la biblioteca activa. Conserva otra copia en un disco diferente. La exportación JSON sirve para datos estructurados, pero no reemplaza el respaldo de los adjuntos.
