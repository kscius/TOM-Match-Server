import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

const IPC = {
  openTdf: 'open-tdf',
  getStatus: 'get-status',
  getLanUrls: 'get-lan-urls',
  startServer: 'start-server',
  stopServer: 'stop-server',
  tournamentUpdated: 'tournament-updated'
} as const

export type HostStatus = {
  fileName: string | null
  tournamentName: string | null
  currentRound: number | null
  playerCount: number
  serverRunning: boolean
  port: number
  updatedAt: string | null
}

export type OpenTdfResult = {
  ok: boolean
  canceled: boolean
  status: HostStatus
}

const hostApi = {
  openTdf: (): Promise<OpenTdfResult> => ipcRenderer.invoke(IPC.openTdf),
  getStatus: (): Promise<HostStatus> => ipcRenderer.invoke(IPC.getStatus),
  getLanUrls: (): Promise<string[]> => ipcRenderer.invoke(IPC.getLanUrls),
  startServer: (): Promise<HostStatus> => ipcRenderer.invoke(IPC.startServer),
  stopServer: (): Promise<HostStatus> => ipcRenderer.invoke(IPC.stopServer),
  onTournamentUpdated: (callback: (status: HostStatus) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, status: HostStatus): void => {
      callback(status)
    }
    ipcRenderer.on(IPC.tournamentUpdated, listener)
    return () => {
      ipcRenderer.removeListener(IPC.tournamentUpdated, listener)
    }
  }
}

contextBridge.exposeInMainWorld('hostApi', hostApi)

export type HostApi = typeof hostApi

declare global {
  interface Window {
    hostApi: HostApi
  }
}
