import type { Tournament } from './types.js'

/** Pluggable tournament file format adapter. */
export interface TournamentFormatAdapter {
  readonly id: string
  canParse(xml: string): boolean
  parse(xml: string, sourcePath: string): Tournament
}
