import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { basename, join } from 'node:path'
import type { Server } from 'node:http'
import { createApp } from '../server/app'
import { TournamentStore } from '../server/store'
import { getLanAddresses } from '../server/lan'
import { currentRoundNumber } from '../shared/tournament/view'

const PORT = 8787
const BIND_HOST = '0.0.0.0'
/** Push host UI when TDF watch reloads (store has no EventEmitter). */
const STATUS_POLL_MS = 1500

const IPC = {
  openTdf: 'open-tdf',
  getStatus: 'get-status',
  getLanUrls: 'get-lan-urls',
  startServer: 'start-server',
  stopServer: 'stop-server',
  tournamentUpdated: 'tournament-updated'
} as const

type HostStatus = {
  fileName: string | null
  tournamentName: string | null
  currentRound: number | null
  playerCount: number
  serverRunning: boolean
  port: number
  updatedAt: string | null
}

let mainWindow: BrowserWindow | null = null
let store: TournamentStore
let httpServer: Server | null = null
let statusPollTimer: ReturnType<typeof setInterval> | null = null
let lastNotifiedUpdatedAt: string | null = null

function isServerListening(): boolean {
  return httpServer !== null && httpServer.listening
}

function buildLanUrls(): string[] {
  return getLanAddresses().map((ip) => `http://${ip}:${PORT}`)
}

function buildStatus(): HostStatus {
  const snapshot = store.getSnapshot()
  const tournament = snapshot.tournament
  const pathForName = snapshot.path

  if (!tournament) {
    return {
      fileName: pathForName ? basename(pathForName) : null,
      tournamentName: null,
      currentRound: null,
      playerCount: 0,
      serverRunning: isServerListening(),
      port: PORT,
      updatedAt: null
    }
  }

  const round = currentRoundNumber(tournament)

  return {
    fileName: pathForName ? basename(pathForName) : null,
    tournamentName: tournament.name,
    currentRound: round > 0 ? round : null,
    playerCount: tournament.players.length,
    serverRunning: isServerListening(),
    port: PORT,
    updatedAt: snapshot.updatedAt
  }
}

function notifyRenderer(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const status = buildStatus()
    lastNotifiedUpdatedAt = status.updatedAt
    mainWindow.webContents.send(IPC.tournamentUpdated, status)
  }
}

function startStatusPoll(): void {
  if (statusPollTimer) return
  statusPollTimer = setInterval(() => {
    const updatedAt = store.getUpdatedAt()
    if (updatedAt !== lastNotifiedUpdatedAt) {
      notifyRenderer()
    }
  }, STATUS_POLL_MS)
}

async function startHttpServer(): Promise<void> {
  if (isServerListening()) return

  const expressApp = createApp(store)

  await new Promise<void>((resolve, reject) => {
    const server = expressApp.listen(PORT, BIND_HOST, () => {
      httpServer = server
      resolve()
    })
    server.once('error', reject)
  })
}

async function stopHttpServer(): Promise<void> {
  if (!httpServer) return

  const server = httpServer
  httpServer = null

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 740,
    show: false,
    title: 'TOM LAN Viewer',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // electron-vite emits out/renderer/index.html (not renderer/host/)
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.openTdf, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Abrir archivo .tdf',
      properties: ['openFile'],
      filters: [{ name: 'TOM Tournament', extensions: ['tdf'] }]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false as const, canceled: true as const, status: buildStatus() }
    }

    const filePath = result.filePaths[0]!
    await store.load(filePath)
    notifyRenderer()
    startStatusPoll()

    return { ok: true as const, canceled: false as const, status: buildStatus() }
  })

  ipcMain.handle(IPC.getStatus, () => buildStatus())

  ipcMain.handle(IPC.getLanUrls, () => buildLanUrls())

  ipcMain.handle(IPC.startServer, async () => {
    await startHttpServer()
    notifyRenderer()
    return buildStatus()
  })

  ipcMain.handle(IPC.stopServer, async () => {
    await stopHttpServer()
    notifyRenderer()
    return buildStatus()
  })
}

app.whenReady().then(async () => {
  store = new TournamentStore()
  registerIpc()
  await startHttpServer()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (statusPollTimer) {
    clearInterval(statusPollTimer)
    statusPollTimer = null
  }
  void store?.close()
  void stopHttpServer()
})
