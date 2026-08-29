import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTournament } from '../../src/shared/tournament/registry.js'
import { toPlayersDto, toTournamentDto } from '../../src/shared/tournament/dto.js'
import { buildPlayerView, currentRoundNumber } from '../../src/shared/tournament/view.js'
import { computeStats } from '../../src/shared/tournament/stats.js'
import { tournamentKey } from '../../src/shared/tournament/keys.js'

const samplesDir = resolve(import.meta.dirname, '../../samples')
const sparsePath = resolve(samplesDir, 'sparse.tdf')
const inProgressPath = resolve(samplesDir, 'in-progress.tdf')

const KRISTIAN = '5161593'
const DROPPED_PLAYER = '6284270' // David Islas, dropped round 3
const BYE_ROUND4 = '5844238' // Arturo Franco — bye in round 4

function load(path: string) {
  const xml = readFileSync(path, 'utf8')
  return parseTournament(xml, path)
}

describe('TOM XML v1.84 parser + view matrix', () => {
  it('parses sparse TDF (empty pods, roster only)', () => {
    const t = load(sparsePath)
    expect(t.name).toBe('TORNEO MUNDIAL 28826')
    expect(t.players.length).toBe(3)
    expect(t.rounds).toEqual([])
    expect(currentRoundNumber(t)).toBe(0)

    const kristian = t.players.find((p) => p.userid === KRISTIAN)
    expect(kristian?.displayName).toBe('Kristian Bernal')
  })

  it('parses in-progress TDF with current round 4', () => {
    const t = load(inProgressPath)
    expect(t.rounds.length).toBeGreaterThanOrEqual(4)
    expect(currentRoundNumber(t)).toBe(4)
  })

  it('known pairing for userid 5161593 (Kristian Bernal) in round 4', () => {
    const t = load(inProgressPath)
    const view = buildPlayerView(t, KRISTIAN)
    expect(view.player?.displayName).toBe('Kristian Bernal')
    expect(view.current.round).toBe(4)
    expect(view.current.status).toBe('playing')
    expect(view.current.outcome).toBe(0)
    expect(view.current.tableNumber).toBe(6)
    expect(view.current.opponent?.userid).toBe('6284276')
    expect(view.current.opponent?.displayName).toBe('Oscar Ochoa')
  })

  it('treats bye (outcome 5) as status bye and win in stats', () => {
    const t = load(inProgressPath)
    const view = buildPlayerView(t, BYE_ROUND4)
    expect(view.current.status).toBe('bye')
    expect(view.current.opponent).toBeNull()
    expect(view.current.outcome).toBe(5)

    const stats = computeStats(t, BYE_ROUND4)
    expect(stats.available).toBe(true)
    expect(stats.wins).toBeGreaterThanOrEqual(1)
  })

  it('marks incomplete matches (outcome 0) as playing', () => {
    const t = load(inProgressPath)
    const view = buildPlayerView(t, KRISTIAN)
    expect(view.current.outcome).toBe(0)
    expect(view.current.status).toBe('playing')
  })

  it('marks dropped player without current pairing as dropped', () => {
    const t = load(inProgressPath)
    const player = t.players.find((p) => p.userid === DROPPED_PLAYER)
    expect(player?.dropped?.round).toBe(3)

    const view = buildPlayerView(t, DROPPED_PLAYER)
    expect(view.current.status).toBe('dropped')
    expect(view.player?.dropped?.round).toBe(3)
  })

  it('computes W-L-T for Kristian (2-1-0 from rounds 1–3)', () => {
    const t = load(inProgressPath)
    const stats = computeStats(t, KRISTIAN)
    expect(stats).toEqual({
      wins: 2,
      losses: 1,
      ties: 0,
      available: true
    })
  })

  it('omits birthdate, creationdate, lastmodifieddate, sourcePath from DTO JSON', () => {
    const t = load(inProgressPath)
    const tournamentJson = JSON.stringify(toTournamentDto(t, '2026-08-28T00:00:00.000Z'))
    const playersJson = JSON.stringify(toPlayersDto(t))
    const viewJson = JSON.stringify(buildPlayerView(t, KRISTIAN))

    for (const blob of [tournamentJson, playersJson, viewJson]) {
      expect(blob).not.toMatch(/birthdate/i)
      expect(blob).not.toMatch(/creationdate/i)
      expect(blob).not.toMatch(/lastmodifieddate/i)
      expect(blob).not.toMatch(/sourcePath/)
      expect(blob).not.toMatch(/02\/27\//)
    }

    const dto = toTournamentDto(t, '2026-08-28T00:00:00.000Z')
    expect(dto.tournamentKey).toBe(tournamentKey(t.name, t.sourcePath))
    expect(dto.currentRound).toBe(4)
    expect(Object.keys(dto).sort()).toEqual(
      [
        'tournamentKey',
        'name',
        'currentRound',
        'roundCount',
        'playerCount',
        'updatedAt'
      ].sort()
    )
  })

  it('returns unpaired when player has no match in current round and is not dropped', () => {
    const t = load(sparsePath)
    const view = buildPlayerView(t, KRISTIAN)
    expect(view.current.status).toBe('unpaired')
  })

  it('returns no_tournament when tournament is null', () => {
    const view = buildPlayerView(null, KRISTIAN)
    expect(view.current.status).toBe('no_tournament')
  })
})
