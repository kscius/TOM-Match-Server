import type { Match, Stats, Tournament } from './types.js'

function playerInMatch(match: Match, userid: string): boolean {
  return (
    match.player === userid ||
    match.player1 === userid ||
    match.player2 === userid
  )
}

/**
 * Derive W-L-T from completed matches.
 * Bye (outcome 5) counts as a win. Outcomes 1/2 are wins for player1/player2.
 * Outcome 0 (incomplete) is ignored. Ties not observed in TOM samples → remain 0.
 */
export function computeStats(tournament: Tournament, userid: string): Stats {
  let wins = 0
  let losses = 0
  let ties = 0
  let sawCompleted = false

  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (!playerInMatch(match, userid)) continue

      if (match.outcome === 5) {
        if (match.player === userid) {
          wins += 1
          sawCompleted = true
        }
        continue
      }

      if (match.outcome === 1 || match.outcome === 2) {
        sawCompleted = true
        const won =
          (match.outcome === 1 && match.player1 === userid) ||
          (match.outcome === 2 && match.player2 === userid)
        if (won) wins += 1
        else losses += 1
        continue
      }
    }
  }

  return {
    wins,
    losses,
    ties,
    available: sawCompleted
  }
}
