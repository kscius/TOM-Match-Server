/** Domain model for a loaded tournament (TOM XML or future adapters). */

export type PlayerViewStatus =
  | 'playing'
  | 'bye'
  | 'done'
  | 'dropped'
  | 'unpaired'
  | 'no_tournament'

export interface Dropped {
  status: number
  round: number
  timestamp?: string
}

export interface Player {
  userid: string
  firstname: string
  lastname: string
  displayName: string
  dropped?: Dropped
}

export interface Match {
  outcome: number
  tableNumber: number
  /** Normal pairing — player1 userid */
  player1?: string
  /** Normal pairing — player2 userid */
  player2?: string
  /** Bye match — single player userid */
  player?: string
  timestamp?: string
}

export interface Round {
  number: number
  type?: number
  stage?: number
  matches: Match[]
}

export interface Stats {
  wins: number
  losses: number
  ties: number
  available: boolean
}

export interface Tournament {
  name: string
  /** Absolute path; internal only — never expose via player-facing DTOs */
  sourcePath: string
  version?: string
  players: Player[]
  rounds: Round[]
}

export interface OpponentRef {
  userid: string
  displayName: string
}

export interface PlayerCurrent {
  round: number
  status: PlayerViewStatus
  tableNumber: number | null
  opponent: OpponentRef | null
  outcome: number | null
}

export interface PlayerView {
  player: {
    userid: string
    displayName: string
    dropped?: { round: number }
  } | null
  stats: Stats
  current: PlayerCurrent
}
