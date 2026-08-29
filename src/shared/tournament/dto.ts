import { tournamentKey } from './keys.js'
import { currentRoundNumber, buildPlayerView } from './view.js'
import type { Player, PlayerView, Tournament } from './types.js'

/** Allowlisted tournament summary — never includes sourcePath or PII dates. */
export interface TournamentDto {
  tournamentKey: string
  name: string
  currentRound: number
  roundCount: number
  playerCount: number
  updatedAt: string
}

export interface PlayerListItemDto {
  userid: string
  displayName: string
  dropped?: { round: number }
}

export interface PlayersDto {
  players: PlayerListItemDto[]
}

function playerListItem(p: Player): PlayerListItemDto {
  const item: PlayerListItemDto = {
    userid: p.userid,
    displayName: p.displayName
  }
  if (p.dropped) {
    item.dropped = { round: p.dropped.round }
  }
  return item
}

export function toTournamentDto(
  tournament: Tournament,
  updatedAt: string
): TournamentDto {
  return {
    tournamentKey: tournamentKey(tournament.name, tournament.sourcePath),
    name: tournament.name,
    currentRound: currentRoundNumber(tournament),
    roundCount: tournament.rounds.length,
    playerCount: tournament.players.length,
    updatedAt
  }
}

export function toPlayersDto(tournament: Tournament): PlayersDto {
  const players = tournament.players
    .map(playerListItem)
    .sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, {
        sensitivity: 'base'
      })
    )
  return { players }
}

export function toPlayerViewDto(view: PlayerView): PlayerView {
  return view
}

export { buildPlayerView }
