import { XMLParser } from 'fast-xml-parser'
import type { TournamentFormatAdapter } from '../tournament/adapter.js'
import type { Dropped, Match, Player, Round, Tournament } from '../tournament/types.js'

const PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  processEntities: false,
  trimValues: true,
  isArray: (name: string, jpath: string, _isLeaf: boolean) => {
    if (name === 'pod' || name === 'subgroup' || name === 'match') return true
    // Only Swiss/pairings <round>, not <dropped><round>3</round>
    if (name === 'round') return jpath.includes('.rounds.round')
    // Roster / pod player refs — not bye <player> under a match
    if (name === 'player') {
      if (jpath.includes('.match.player')) return false
      return jpath.includes('.players.player')
    }
    return false
  }
} as const

const xmlParser = new XMLParser(PARSER_OPTIONS)

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return undefined
}

function textOf(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return textOf(value[0])
  }
  const rec = asRecord(value)
  if (rec && '#text' in rec) return String(rec['#text'] ?? '')
  return ''
}

function firstNode(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return asRecord(value[0])
  return asRecord(value)
}

function attr(node: Record<string, unknown> | undefined, name: string): string {
  if (!node) return ''
  const v = node[`@_${name}`]
  return v == null ? '' : String(v)
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function parseDropped(raw: unknown): Dropped | undefined {
  const node = asRecord(raw)
  if (!node) return undefined
  return {
    status: num(textOf(node.status), 0),
    round: num(textOf(node.round), 0),
    timestamp: textOf(node.timestamp) || undefined
  }
}

function parsePlayer(raw: unknown): Player | null {
  const node = asRecord(raw)
  if (!node) return null
  const userid = attr(node, 'userid')
  if (!userid) return null
  const firstname = textOf(node.firstname)
  const lastname = textOf(node.lastname)
  const displayName = `${firstname} ${lastname}`.trim() || userid
  const dropped = parseDropped(node.dropped)
  const player: Player = {
    userid,
    firstname,
    lastname,
    displayName
  }
  if (dropped) player.dropped = dropped
  return player
}

function useridFromSeat(seat: unknown): string | undefined {
  const node = firstNode(seat)
  if (!node) return undefined
  const id = attr(node, 'userid')
  return id || undefined
}

function parseMatch(raw: unknown): Match | null {
  const node = asRecord(raw)
  if (!node) return null
  const outcome = num(attr(node, 'outcome'), 0)
  const tableNumber = num(textOf(node.tablenumber), 0)
  const timestamp = textOf(node.timestamp) || undefined

  const byePlayer = useridFromSeat(node.player)
  if (byePlayer) {
    return {
      outcome,
      tableNumber,
      player: byePlayer,
      timestamp
    }
  }

  return {
    outcome,
    tableNumber,
    player1: useridFromSeat(node.player1),
    player2: useridFromSeat(node.player2),
    timestamp
  }
}

function parseRound(raw: unknown): Round | null {
  const node = asRecord(raw)
  if (!node) return null
  const number = num(attr(node, 'number'), 0)
  const matchesNode = asRecord(node.matches)
  const matchList = matchesNode?.match
  const matchesRaw = Array.isArray(matchList)
    ? matchList
    : matchList
      ? [matchList]
      : []
  const matches = matchesRaw
    .map(parseMatch)
    .filter((m): m is Match => m != null)

  return {
    number,
    type: attr(node, 'type') ? num(attr(node, 'type')) : undefined,
    stage: attr(node, 'stage') ? num(attr(node, 'stage')) : undefined,
    matches
  }
}

function collectRounds(root: Record<string, unknown>): Round[] {
  const podsNode = asRecord(root.pods)
  const podsRaw = podsNode?.pod
  const pods = Array.isArray(podsRaw) ? podsRaw : podsRaw ? [podsRaw] : []
  const rounds: Round[] = []

  for (const pod of pods) {
    const podRec = asRecord(pod)
    if (!podRec) continue
    const roundsNode = asRecord(podRec.rounds)
    const roundList = roundsNode?.round
    const list = Array.isArray(roundList)
      ? roundList
      : roundList
        ? [roundList]
        : []
    for (const r of list) {
      const parsed = parseRound(r)
      if (parsed) rounds.push(parsed)
    }
  }

  rounds.sort((a, b) => a.number - b.number)
  return rounds
}

function parseTournamentDoc(xml: string, sourcePath: string): Tournament {
  const doc = xmlParser.parse(xml) as Record<string, unknown>
  const root = asRecord(doc.tournament)
  if (!root) {
    throw new Error('Invalid TDF: missing <tournament> root')
  }

  const data = asRecord(root.data)
  const name = textOf(data?.name) || 'Untitled tournament'
  const version = attr(root, 'version') || undefined

  const playersNode = asRecord(root.players)
  const playersRaw = playersNode?.player
  const playerList = Array.isArray(playersRaw)
    ? playersRaw
    : playersRaw
      ? [playersRaw]
      : []
  const players = playerList
    .map(parsePlayer)
    .filter((p): p is Player => p != null)

  const rounds = collectRounds(root)

  return {
    name,
    sourcePath,
    version,
    players,
    rounds
  }
}

export const TomXmlV184: TournamentFormatAdapter = {
  id: 'tom-xml-v184',

  canParse(xml: string): boolean {
    const trimmed = xml.trimStart()
    if (!/<tournament[\s>]/i.test(trimmed)) return false
    // Match version on the <tournament> tag only (not <?xml version="1.0"?>).
    const tagMatch = /<tournament\b[^>]*>/i.exec(trimmed.slice(0, 800))
    if (!tagMatch) return false
    const tag = tagMatch[0]
    const versionMatch = /\bversion\s*=\s*["']([^"']+)["']/i.exec(tag)
    if (versionMatch) {
      const v = versionMatch[1]
      return v.startsWith('1.8')
    }
    return /\bgametype\s*=/i.test(tag)
  },

  parse(xml: string, sourcePath: string): Tournament {
    return parseTournamentDoc(xml, sourcePath)
  }
}
