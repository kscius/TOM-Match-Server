import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

/** URL/file-safe slug from tournament name. */
export function slug(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'tournament'
}

/** Short hex hash of absolute path (samples often have empty TOM `<id>`). */
export function pathHash(sourcePath: string, length = 8): string {
  const abs = resolve(sourcePath)
  return createHash('sha256').update(abs).digest('hex').slice(0, length)
}

/** Stable tournament key: slug(name) + short path hash. */
export function tournamentKey(name: string, sourcePath: string): string {
  return `${slug(name)}-${pathHash(sourcePath)}`
}
