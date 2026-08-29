import type { TournamentFormatAdapter } from './adapter.js'
import type { Tournament } from './types.js'
import { TomXmlV184 } from '../formats/tom-xml-v184.js'

const adapters: TournamentFormatAdapter[] = []

export function registerAdapter(adapter: TournamentFormatAdapter): void {
  const idx = adapters.findIndex((a) => a.id === adapter.id)
  if (idx >= 0) adapters[idx] = adapter
  else adapters.push(adapter)
}

/** Register built-in TOM XML v1.84 adapter (idempotent). */
export function ensureDefaultAdapters(): void {
  if (!adapters.some((a) => a.id === TomXmlV184.id)) {
    registerAdapter(TomXmlV184)
  }
}

ensureDefaultAdapters()

export function parseTournament(xml: string, sourcePath: string): Tournament {
  ensureDefaultAdapters()
  for (const adapter of adapters) {
    if (adapter.canParse(xml)) {
      return adapter.parse(xml, sourcePath)
    }
  }
  throw new Error('No tournament format adapter can parse this file')
}

export { TomXmlV184 }
