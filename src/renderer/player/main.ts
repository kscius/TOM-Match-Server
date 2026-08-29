/**
 * Stream B — player phone UI (Spanish).
 * Consumes GET /api/tournament, /api/players, /api/players/:userid/view.
 * XSS-safe: textContent / createElement only — never innerHTML with names.
 */

const POLL_MS = 1500
const STORAGE_PREFIX = 'tom-viewer'

type PlayerStatus =
  | 'playing'
  | 'bye'
  | 'done'
  | 'dropped'
  | 'unpaired'
  | 'no_tournament'

interface TournamentDto {
  tournamentKey: string
  name: string
  currentRound: number
  roundCount: number
  playerCount: number
  updatedAt: string
}

interface PlayerListItem {
  userid: string
  displayName: string
  dropped?: { round: number }
}

interface PlayersResponse {
  players: PlayerListItem[]
}

interface PlayerViewResponse {
  player?: {
    userid: string
    displayName: string
    dropped?: { round: number }
  }
  stats?: {
    wins: number
    losses: number
    ties: number
    available: boolean
  }
  current?: {
    round: number
    status: PlayerStatus
    tableNumber?: number | null
    opponent?: { userid: string; displayName: string } | null
    outcome?: number | null
  }
  status?: PlayerStatus
}

type UiScreen = 'roster' | 'player'

interface AppState {
  tournament: TournamentDto | null
  players: PlayerListItem[]
  selectedUserId: string | null
  screen: UiScreen
  searchQuery: string
  lastUpdatedAt: string | null
  error: string | null
  loading: boolean
  view: PlayerViewResponse | null
}

const state: AppState = {
  tournament: null,
  players: [],
  selectedUserId: null,
  screen: 'roster',
  searchQuery: '',
  lastUpdatedAt: null,
  error: null,
  loading: true,
  view: null
}

const el = {
  tournamentName: document.getElementById('tournament-name')!,
  tournamentMeta: document.getElementById('tournament-meta')!,
  main: document.getElementById('main')!,
  pollStatus: document.getElementById('poll-status')!
}

const STATUS_MESSAGES: Record<PlayerStatus, string> = {
  playing: 'Partida en curso. Acude a tu mesa.',
  bye: 'Tienes un bye esta ronda (victoria automática).',
  done: 'Ronda completada. Espera la siguiente emparejada.',
  dropped: 'Estás dado de baja del torneo.',
  unpaired: 'Aún no tienes rival asignado. Espera el emparejamiento.',
  no_tournament: 'No hay torneo cargado en el servidor.'
}

const STATUS_LABELS: Record<PlayerStatus, string> = {
  playing: 'Jugando',
  bye: 'Bye',
  done: 'Finalizado',
  dropped: 'Baja',
  unpaired: 'Sin rival',
  no_tournament: 'Sin torneo'
}

function storageKey(tournamentKey: string): string {
  return `${STORAGE_PREFIX}:${tournamentKey}:userid`
}

function readPersistedUserId(tournamentKey: string): string | null {
  try {
    const value = localStorage.getItem(storageKey(tournamentKey))
    return value && value.length > 0 ? value : null
  } catch {
    return null
  }
}

function persistUserId(tournamentKey: string, userid: string): void {
  try {
    localStorage.setItem(storageKey(tournamentKey), userid)
  } catch {
    // localStorage may be unavailable; selection still works in-session
  }
}

function clearPersistedUserId(tournamentKey: string): void {
  try {
    localStorage.removeItem(storageKey(tournamentKey))
  } catch {
    // ignore
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

function sortPlayers(players: PlayerListItem[]): PlayerListItem[] {
  return [...players].sort((a, b) => {
    const byName = a.displayName.localeCompare(b.displayName, 'es', {
      sensitivity: 'base'
    })
    if (byName !== 0) return byName
    return a.userid.localeCompare(b.userid, 'es')
  })
}

function duplicateNameSet(players: PlayerListItem[]): Set<string> {
  const counts = new Map<string, number>()
  for (const p of players) {
    const key = p.displayName.trim().toLocaleLowerCase('es')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const dupes = new Set<string>()
  for (const [name, count] of counts) {
    if (count > 1) dupes.add(name)
  }
  return dupes
}

function isDuplicateName(
  displayName: string,
  dupes: Set<string>
): boolean {
  return dupes.has(displayName.trim().toLocaleLowerCase('es'))
}

function setText(node: HTMLElement, text: string): void {
  node.textContent = text
}

function clearChildren(node: HTMLElement): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild)
  }
}

function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

function resolveStatus(view: PlayerViewResponse | null): PlayerStatus {
  if (!view) return 'unpaired'
  if (view.current?.status) return view.current.status
  if (view.status) return view.status
  return 'unpaired'
}

function formatMeta(t: TournamentDto | null): string {
  if (!t) return 'Sin datos de torneo'
  const parts: string[] = []
  if (typeof t.currentRound === 'number') {
    parts.push(`Ronda ${t.currentRound}`)
  }
  if (typeof t.roundCount === 'number' && t.roundCount > 0) {
    parts.push(`de ${t.roundCount}`)
  }
  if (typeof t.playerCount === 'number') {
    parts.push(`${t.playerCount} jugadores`)
  }
  return parts.join(' · ') || 'Torneo activo'
}

function renderHeader(): void {
  const name = state.tournament?.name?.trim() || 'Torneo'
  setText(el.tournamentName, name)
  setText(el.tournamentMeta, formatMeta(state.tournament))
}

function renderErrorBanner(message: string): HTMLElement {
  const p = createEl('p', 'banner banner-error')
  setText(p, message)
  return p
}

function renderRoster(): void {
  clearChildren(el.main)

  if (state.error && state.players.length === 0) {
    el.main.appendChild(renderErrorBanner(state.error))
  }

  if (!state.tournament && !state.loading) {
    const banner = createEl('p', 'banner')
    setText(banner, STATUS_MESSAGES.no_tournament)
    el.main.appendChild(banner)
  }

  const panel = createEl('section', 'panel')
  const title = createEl('h2', 'panel-title')
  setText(title, 'Selecciona tu nombre')
  panel.appendChild(title)

  const label = createEl('label', 'search-label')
  label.htmlFor = 'player-search'
  setText(label, 'Buscar')
  panel.appendChild(label)

  const input = createEl('input', 'search-input')
  input.type = 'search'
  input.id = 'player-search'
  input.placeholder = 'Nombre o ID…'
  input.autocomplete = 'off'
  input.spellcheck = false
  input.value = state.searchQuery
  input.addEventListener('input', () => {
    state.searchQuery = input.value
    renderRosterList(listHost, dupes)
  })
  panel.appendChild(input)

  const listHost = createEl('div')
  panel.appendChild(listHost)
  el.main.appendChild(panel)

  const dupes = duplicateNameSet(state.players)
  renderRosterList(listHost, dupes)

  if (state.loading && state.players.length === 0) {
    const loading = createEl('p', 'banner')
    setText(loading, 'Cargando lista de jugadores…')
    el.main.insertBefore(loading, panel)
  }
}

function renderRosterList(host: HTMLElement, dupes: Set<string>): void {
  clearChildren(host)

  const q = state.searchQuery.trim().toLocaleLowerCase('es')
  const filtered = sortPlayers(state.players).filter((p) => {
    if (!q) return true
    return (
      p.displayName.toLocaleLowerCase('es').includes(q) ||
      p.userid.toLocaleLowerCase('es').includes(q)
    )
  })

  if (filtered.length === 0) {
    const empty = createEl('p', 'roster-empty')
    setText(
      empty,
      state.players.length === 0
        ? 'No hay jugadores en el torneo.'
        : 'Ningún jugador coincide con la búsqueda.'
    )
    host.appendChild(empty)
    return
  }

  const ul = createEl('ul', 'roster')
  ul.setAttribute('role', 'listbox')
  ul.setAttribute('aria-label', 'Lista de jugadores')

  for (const player of filtered) {
    const li = createEl('li')
    const btn = createEl('button', 'roster-item')
    btn.type = 'button'
    btn.setAttribute('role', 'option')

    const nameEl = createEl('span', 'roster-name')
    setText(nameEl, player.displayName)
    btn.appendChild(nameEl)

    if (isDuplicateName(player.displayName, dupes)) {
      const idEl = createEl('span', 'roster-userid')
      setText(idEl, player.userid)
      btn.appendChild(idEl)
    }

    if (player.dropped) {
      const badge = createEl('span', 'roster-badge')
      setText(badge, `Baja (ronda ${player.dropped.round})`)
      btn.appendChild(badge)
    }

    btn.addEventListener('click', () => {
      void selectPlayer(player.userid)
    })

    li.appendChild(btn)
    ul.appendChild(li)
  }

  host.appendChild(ul)
}

function renderPlayerView(): void {
  clearChildren(el.main)

  if (state.error) {
    el.main.appendChild(renderErrorBanner(state.error))
  }

  const view = state.view
  const player =
    view?.player ??
    state.players.find((p) => p.userid === state.selectedUserId) ??
    null

  const header = createEl('section', 'panel player-header')

  const nameBlock = createEl('div')
  const nameEl = createEl('h2', 'player-name')
  setText(nameEl, player?.displayName ?? 'Jugador')
  nameBlock.appendChild(nameEl)

  const showUserId =
    player != null &&
    (isDuplicateName(player.displayName, duplicateNameSet(state.players)) ||
      !player.displayName.trim())
  if (player && showUserId) {
    const idEl = createEl('p', 'player-userid')
    setText(idEl, player.userid)
    nameBlock.appendChild(idEl)
  }
  header.appendChild(nameBlock)

  const statsRow = createEl('div', 'stats-row')
  const stats = view?.stats
  if (stats?.available) {
    const wlt = createEl('span', 'stats-wlt')
    setText(wlt, `${stats.wins}–${stats.losses}–${stats.ties}`)
    statsRow.appendChild(wlt)
    const label = createEl('span', 'stats-label')
    setText(label, 'W–L–T')
    statsRow.appendChild(label)
  } else {
    const label = createEl('span', 'stats-label')
    setText(label, 'Récord no disponible')
    statsRow.appendChild(label)
  }
  header.appendChild(statsRow)

  const changeBtn = createEl('button', 'btn btn-block')
  changeBtn.type = 'button'
  setText(changeBtn, 'Cambiar jugador')
  changeBtn.addEventListener('click', () => {
    changePlayer()
  })
  header.appendChild(changeBtn)

  el.main.appendChild(header)

  const status = resolveStatus(view)
  const statusPanel = createEl('section', 'panel status-card')

  if (!view && state.selectedUserId) {
    const loading = createEl('p', 'status-message')
    setText(loading, 'Cargando tu partida…')
    statusPanel.appendChild(loading)
    el.main.appendChild(statusPanel)
    return
  }

  const pill = createEl('span', 'status-pill')
  pill.dataset.status = status
  setText(pill, STATUS_LABELS[status])
  statusPanel.appendChild(pill)

  const msg = createEl('p', 'status-message')
  setText(msg, STATUS_MESSAGES[status])
  statusPanel.appendChild(msg)

  const grid = createEl('div', 'detail-grid')

  const roundDetail = createEl('div', 'detail')
  const roundLabel = createEl('span', 'detail-label')
  setText(roundLabel, 'Ronda')
  const roundValue = createEl('span', 'detail-value')
  const roundNum =
    view?.current?.round ?? state.tournament?.currentRound ?? null
  setText(roundValue, roundNum != null ? String(roundNum) : '—')
  roundDetail.appendChild(roundLabel)
  roundDetail.appendChild(roundValue)
  grid.appendChild(roundDetail)

  const tableDetail = createEl('div', 'detail')
  const tableLabel = createEl('span', 'detail-label')
  setText(tableLabel, 'Mesa')
  const tableValue = createEl('span', 'detail-value table-number')
  const tableNumber = view?.current?.tableNumber
  const tableText =
    status === 'bye' || status === 'dropped' || status === 'unpaired' ||
    status === 'no_tournament'
      ? '—'
      : tableNumber != null && tableNumber !== 0
        ? String(tableNumber)
        : '—'
  setText(tableValue, tableText)
  tableDetail.appendChild(tableLabel)
  tableDetail.appendChild(tableValue)
  grid.appendChild(tableDetail)

  const oppDetail = createEl('div', 'detail detail-full')
  const oppLabel = createEl('span', 'detail-label')
  setText(oppLabel, 'Rival')
  const oppValue = createEl('span', 'detail-value')
  const opponent = view?.current?.opponent
  if (status === 'bye') {
    setText(oppValue, '— (bye)')
  } else if (opponent?.displayName) {
    setText(oppValue, opponent.displayName)
  } else {
    setText(oppValue, '—')
  }
  oppDetail.appendChild(oppLabel)
  oppDetail.appendChild(oppValue)
  if (
    opponent?.displayName &&
    opponent.userid &&
    isDuplicateName(opponent.displayName, duplicateNameSet(state.players))
  ) {
    const oppId = createEl('span', 'player-userid')
    setText(oppId, opponent.userid)
    oppDetail.appendChild(oppId)
  }
  grid.appendChild(oppDetail)

  statusPanel.appendChild(grid)
  el.main.appendChild(statusPanel)
}

function render(): void {
  renderHeader()
  if (state.screen === 'roster' || !state.selectedUserId) {
    renderRoster()
  } else {
    renderPlayerView()
  }
}

async function selectPlayer(userid: string): Promise<void> {
  state.selectedUserId = userid
  state.screen = 'player'
  state.error = null
  state.view = null
  if (state.tournament?.tournamentKey) {
    persistUserId(state.tournament.tournamentKey, userid)
  }
  await refreshPlayerView()
  render()
}

function changePlayer(): void {
  if (state.tournament?.tournamentKey) {
    clearPersistedUserId(state.tournament.tournamentKey)
  }
  state.selectedUserId = null
  state.view = null
  state.screen = 'roster'
  state.searchQuery = ''
  state.error = null
  render()
}

async function refreshPlayerView(): Promise<void> {
  if (!state.selectedUserId) {
    state.view = null
    return
  }
  try {
    const view = await fetchJson<PlayerViewResponse>(
      `/api/players/${encodeURIComponent(state.selectedUserId)}/view`
    )
    state.view = view
    state.error = null
  } catch (err) {
    const status =
      err instanceof Error && err.message.startsWith('HTTP ')
        ? err.message
        : null
    if (status === 'HTTP 404') {
      state.error =
        'Jugador no encontrado en el torneo. Elige otro de la lista.'
      state.view = null
      state.selectedUserId = null
      state.screen = 'roster'
      if (state.tournament?.tournamentKey) {
        clearPersistedUserId(state.tournament.tournamentKey)
      }
    } else {
      state.error = 'No se pudo actualizar tu partida. Reintentando…'
    }
  }
}

async function loadSnapshot(isPoll: boolean): Promise<void> {
  try {
    const [tournament, playersRes] = await Promise.all([
      fetchJson<TournamentDto>('/api/tournament'),
      fetchJson<PlayersResponse>('/api/players')
    ])

    const prevKey = state.tournament?.tournamentKey ?? null
    const updatedAt = tournament.updatedAt ?? null
    const changed = updatedAt !== state.lastUpdatedAt
    const keyChanged = prevKey !== null && prevKey !== tournament.tournamentKey

    state.tournament = tournament
    state.players = Array.isArray(playersRes.players)
      ? sortPlayers(playersRes.players)
      : []
    state.loading = false
    state.error = null

    if (!isPoll || keyChanged) {
      const persisted = readPersistedUserId(tournament.tournamentKey)
      if (
        persisted &&
        state.players.some((p) => p.userid === persisted)
      ) {
        state.selectedUserId = persisted
        state.screen = 'player'
      } else {
        if (persisted) clearPersistedUserId(tournament.tournamentKey)
        if (keyChanged) {
          state.selectedUserId = null
          state.view = null
          state.screen = 'roster'
        }
      }
    }

    if (!isPoll || changed || keyChanged || state.selectedUserId) {
      state.lastUpdatedAt = updatedAt
      if (state.selectedUserId && state.screen === 'player') {
        await refreshPlayerView()
      }
    }

    setText(
      el.pollStatus,
      updatedAt
        ? `Actualizado ${formatUpdatedAt(updatedAt)}`
        : 'Esperando datos…'
    )
    render()
  } catch {
    state.loading = false
    if (!state.tournament) {
      state.error =
        'No se pudo conectar con el servidor del torneo. Comprueba la red.'
    } else if (!isPoll) {
      state.error = 'Error al cargar el torneo. Reintentando…'
    }
    setText(el.pollStatus, 'Sin conexión — reintentando…')
    render()
  }
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling(): void {
  if (pollTimer != null) return
  pollTimer = setInterval(() => {
    void loadSnapshot(true)
  }, POLL_MS)
}

void (async function boot() {
  render()
  await loadSnapshot(false)
  startPolling()
})()
