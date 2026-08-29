import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')

function findBuiltPreload(): string | null {
  const cjs = resolve(projectRoot, 'out/preload/index.cjs')
  return existsSync(cjs) ? cjs : null
}

describe('built preload sandbox compatibility', () => {
  const preloadPath = findBuiltPreload()

  it.skipIf(!preloadPath)(
    'emits CJS with require("electron") (sandbox cannot load ESM preload)',
    () => {
      expect(preloadPath!.endsWith('.cjs')).toBe(true)
      const content = readFileSync(preloadPath!, 'utf8')

      expect(content).toMatch(/require\(["']electron["']\)/)
      expect(content.trimStart()).not.toMatch(/^import\s+.*\s+from\s+['"]electron['"]/)
    }
  )
})
