# TOM Match Server

App Electron (Windows/macOS) que lee archivos `.tdf` de **Tournament Operations Manager (TOM)** y sirve una UI móvil en la LAN para que los jugadores vean mesa, rival y récord (W–L–T).

Repositorio: https://github.com/kscius/TOM-Match-Server

## Requisitos

- Node.js 20+ (LTS) y npm
- Para el instalador Windows: compilar **en Windows** (recomendado)

## Desarrollo

```bash
npm install
npm test
npm run typecheck
npm run build:player
npm run start:server   # headless: set PORT=8787 y TDF_PATH=./samples/in-progress.tdf
npm run dev            # Electron + UI del host
```

1. En la app host: **Abrir archivo .tdf** (el que TOM va guardando).
2. Comparte la URL LAN (ej. `http://192.168.1.145:8787`) o el QR.
3. Cada jugador elige su nombre; la selección se guarda en el dispositivo.

Puerto por defecto: **8787** (bind `0.0.0.0`). Abre el firewall de Windows para ese puerto en la red local.

## Compilar en Windows (instalador `.exe`)

En una máquina **Windows x64**:

```bat
git clone https://github.com/kscius/TOM-Match-Server.git
cd TOM-Match-Server
npm install
npm test
npm run dist:win
```

Salida en `release-build/`:

- Instalador NSIS: `TOM Match Server-0.1.0-win-x64.exe`
- Portable: `TOM Match Server-0.1.0-portable.exe`

Notas:

- `npm run dist:win` ejecuta `build` (player SPA + Electron) y luego `electron-builder --win --x64`.
- Distribuye solo artefactos de `release-build/` (ignora cualquier carpeta `release/` antigua).
  Si `release-build/` está bloqueado por una instancia abierta, el build puede escribirse en `release-build-fixed/` — usa esos `.exe`.
- No hace falta firmar el código para uso interno; Windows SmartScreen puede avisar la primera vez.
- Compilar el `.exe` desde macOS no es fiable; usa Windows o un runner `windows-latest`.
- Icono personalizado: opcional (`build/icon.ico`); sin él se usa el icono por defecto de Electron.

Solo empaquetar sin instalador (carpeta):

```bat
npm run pack
```

## Solución de problemas

**`Cannot read properties of undefined (reading 'openTdf')`**
Causa: builds antiguos empaquetaban el preload como ESM (incompatible con `sandbox`); `hostApi` no se cargaba.
Solución: usa un build con preload CJS — `npm run dist:win` y redistribuye los `.exe` de `release-build/` (o `release-build-fixed/` si esa carpeta quedó bloqueada).

## Seguridad

- Solo LAN, sin autenticación.
- No se exponen fechas de nacimiento ni rutas de archivo al cliente.
- `POST /api/reload` solo desde loopback.
- Los samples del repo tienen `<birthdate>` vacíos a propósito.
