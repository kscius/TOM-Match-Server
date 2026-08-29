import type {
  Match,
  Player,
  PlayerView,
  PlayerViewStatus,
  Tournament
} from './types.js'
import { computeStats } from './stats.js'

/** Highest round number that has at least one match. */
export function currentRoundNumber(tournament: Tournament): number {
  let max = 0
  for (const round of tournament.rounds) {
    if (round.matches.length > 0 && round.number > max) {
      max = round.number
    }
  }
  return max
}

function findPlayer(tournament: Tournament, userid: string): Player | undefined {
  return tournament.players.find((p) => p.userid === userid)
}

function displayNameFor(tournament: Tournament, userid: string): string {
  const p = findPlayer(tournament, userid)
  if (p) return p.displayName
  return userid
}

function findMatchForPlayer(
  tournament: Tournament,
  roundNumber: number,
  userid: string
): Match | undefined {
  const round = tournament.rounds.find((r) => r.number === roundNumber)
  if (!round) return undefined
  return round.matches.find(
    (m) =>
      m.player === userid || m.player1 === userid || m.player2 === userid
  )
}

function resolveStatus(
  match: Match | undefined,
  player: Player | undefined,
  roundNumber: number
): PlayerViewStatus {
  if (match) {
    if (match.outcome === 5 || match.player !== undefined) {
      return 'bye'
    }
    if (match.outcome === 0) return 'playing'
    if (match.outcome === 1 || match.outcome === 2) return 'done'
    // Unknown outcome codes: still paired — treat as in progress.
    return 'playing'
  }

  if (
    player?.dropped &&
    player.dropped.round <= roundNumber &&
    !match
  ) {
    return 'dropped'
  }

  return 'unpaired'
}

/**
 * Build the player-facing view for a userid.
 * When tournament is null, returns no_tournament status (HTTP layer may still 200).
 */
export function buildPlayerView(
  tournament: Tournament | null,
  userid: string
): PlayerView {
  if (!tournament) {
    return {
      player: null,
      stats: { wins: 0, losses: 0, ties: 0, available: false },
      current: {
        round: 0,
        status: 'no_tournament',
        tableNumber: null,
        opponent: null,
        outcome: null
      }
    }
  }

  const player = findPlayer(tournament, userid)
  const round = currentRoundNumber(tournament)
  const match = findMatchForPlayer(tournament, round, userid)
  const status = resolveStatus(match, player, round)

  let opponent: { userid: string; displayName: string } | null = null
  let tableNumber: number | null = null
  let outcome: number | null = null

  if (match) {
    outcome = match.outcome
    tableNumber =
      match.tableNumber === 0 && status === 'bye' ? null : match.tableNumber

    if (status !== 'bye') {
      const oppId =
        match.player1 === userid
          ? match.player2
          : match.player2 === userid
            ? match.player1
            : undefined
      if (oppId) {
        opponent = {
          userid: oppId,
          displayName: displayNameFor(tournament, oppId)
        }
      }
    }
  }

  return {
    player: player
      ? {
          userid: player.userid,
          displayName: player.displayName,
          ...(player.dropped ? { dropped: { round: player.dropped.round } } : {})
        }
      : {
          userid,
          displayName: userid
        },
    stats: computeStats(tournament, userid),
    current: {
      round,
      status,
      tableNumber,
      opponent,
      outcome
    }
  }
}
