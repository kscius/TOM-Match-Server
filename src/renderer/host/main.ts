import QRCode from 'qrcode'

/** Mirrors preload HostStatus — kept local so renderer stays Electron-free. */
type HostStatus = {
  fileName: string | null
  tournamentName: string | null
  currentRound: number | null
  playerCount: number
  serverRunning: boolean
  port: number
  updatedAt: string | null
}

type HostApi = {
  openTdf: () => Promise<{ ok: boolean; canceled: boolean; status: HostStatus }>
  getStatus: () => Promise<HostStatus>
  getLanUrls: () => Promise<string[]>
  startServer: () => Promise<HostStatus>
  stopServer: () => Promise<HostStatus>
  onTournamentUpdated: (callback: (status: HostStatus) => void) => () => void
}

declare global {
  interface Window {
    hostApi: HostApi
  }
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing #${id}`)
  return el
}

function setText(id: string, value: string): void {
  $(id).textContent = value
}

function showError(message: string | null): void {
  const el = $('error')
  if (!message) {
    el.hidden = true
    el.textContent = ''
    return
  }
  el.hidden = false
  el.textContent = message
}

async function renderQr(url: string | null): Promise<void> {
  const canvas = $('qr-canvas') as HTMLCanvasElement
  const caption = $('qr-caption')

  if (!url) {
    const ctx = canvas.getContext('2d')
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
    caption.textContent = 'Abre un torneo y mantén el servidor activo'
    return
  }

  await QRCode.toCanvas(canvas, url, {
    width: 200,
    margin: 2,
    color: { dark: '#111111', light: '#ffffff' }
  })
  caption.textContent = url
}

function renderLanUrls(urls: string[]): void {
  const list = $('lan-urls')
  list.replaceChildren()

  if (urls.length === 0) {
    const li = document.createElement('li')
    li.textContent = 'No se detectaron direcciones IPv4 LAN'
    list.appendChild(li)
    return
  }

  for (const url of urls) {
    const li = document.createElement('li')
    const code = document.createElement('code')
    code.textContent = url
    li.appendChild(code)
    list.appendChild(li)
  }
}

async function applyStatus(status: HostStatus, urls?: string[]): Promise<void> {
  setText('file-name', status.fileName ?? 'Ninguno')
  setText('tournament-name', status.tournamentName ?? '—')
  setText(
    'current-round',
    status.currentRound != null ? String(status.currentRound) : '—'
  )
  setText('player-count', String(status.playerCount))
  setText(
    'server-state',
    status.serverRunning
      ? `Activo · puerto ${status.port}`
      : 'Detenido'
  )

  const toggle = $('btn-toggle') as HTMLButtonElement
  toggle.textContent = status.serverRunning ? 'Detener servidor' : 'Iniciar servidor'
  toggle.dataset.running = status.serverRunning ? '1' : '0'

  const lanUrls = urls ?? (await window.hostApi.getLanUrls())
  renderLanUrls(lanUrls)

  const primary = status.serverRunning ? (lanUrls[0] ?? null) : null
  await renderQr(primary)
}

async function refresh(): Promise<void> {
  const [status, urls] = await Promise.all([
    window.hostApi.getStatus(),
    window.hostApi.getLanUrls()
  ])
  await applyStatus(status, urls)
}

async function onOpenFile(): Promise<void> {
  showError(null)
  try {
    const result = await window.hostApi.openTdf()
    if (result.canceled) return
    const urls = await window.hostApi.getLanUrls()
    await applyStatus(result.status, urls)
  } catch (err) {
    showError(err instanceof Error ? err.message : 'No se pudo abrir el archivo')
  }
}

async function onToggleServer(): Promise<void> {
  showError(null)
  const toggle = $('btn-toggle') as HTMLButtonElement
  const running = toggle.dataset.running === '1'

  try {
    const status = running
      ? await window.hostApi.stopServer()
      : await window.hostApi.startServer()
    const urls = await window.hostApi.getLanUrls()
    await applyStatus(status, urls)
  } catch (err) {
    showError(
      err instanceof Error
        ? err.message
        : running
          ? 'No se pudo detener el servidor'
          : 'No se pudo iniciar el servidor'
    )
  }
}

function boot(): void {
  $('btn-open').addEventListener('click', () => {
    void onOpenFile()
  })
  $('btn-toggle').addEventListener('click', () => {
    void onToggleServer()
  })

  window.hostApi.onTournamentUpdated((status) => {
    void window.hostApi.getLanUrls().then((urls) => applyStatus(status, urls))
  })

  void refresh().catch((err) => {
    showError(err instanceof Error ? err.message : 'Error al cargar el estado')
  })
}

boot()
