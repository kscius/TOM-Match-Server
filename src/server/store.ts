import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { watch, type FSWatcher } from 'chokidar'
import { parseTournament } from '../shared/tournament/registry.js'
import type { Tournament } from '../shared/tournament/types.js'

const RETRY_DELAYS_MS = [50, 150, 350] as const

export interface TournamentStoreSnapshot {
  tournament: Tournament | null
  updatedAt: string
  path: string | null
  lastError: string | null
}

export class TournamentStore {
  private path: string | null = null
  private tournament: Tournament | null = null
  private updatedAt: string = new Date(0).toISOString()
  private lastError: string | null = null
  private watcher: FSWatcher | null = null
  private reloadTimer: ReturnType<typeof setTimeout> | null = null

  getSnapshot(): TournamentStoreSnapshot {
    return {
      tournament: this.tournament,
      updatedAt: this.updatedAt,
      path: this.path,
      lastError: this.lastError
    }
  }

  getTournament(): Tournament | null {
    return this.tournament
  }

  getUpdatedAt(): string {
    return this.updatedAt
  }

  async load(filePath: string): Promise<void> {
    const abs = resolve(filePath)
    this.path = abs
    await this.reloadWithRetry()
    this.startWatch(abs)
  }

  async reload(): Promise<boolean> {
    if (!this.path) return false
    return this.reloadWithRetry()
  }

  async close(): Promise<void> {
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer)
      this.reloadTimer = null
    }
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
  }

  private startWatch(abs: string): void {
    if (this.watcher) {
      void this.watcher.close()
      this.watcher = null
    }
    this.watcher = watch(abs, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
    })
    const schedule = (): void => {
      if (this.reloadTimer) clearTimeout(this.reloadTimer)
      this.reloadTimer = setTimeout(() => {
        void this.reloadWithRetry()
      }, 100)
    }
    this.watcher.on('change', schedule)
    this.watcher.on('add', schedule)
  }

  private async reloadWithRetry(): Promise<boolean> {
    if (!this.path) return false
    const path = this.path
    let lastErr: unknown

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      try {
        const xml = await readFile(path, 'utf8')
        const parsed = parseTournament(xml, path)
        this.tournament = parsed
        this.updatedAt = new Date().toISOString()
        this.lastError = null
        return true
      } catch (err) {
        lastErr = err
        const delay = RETRY_DELAYS_MS[attempt]
        await sleep(delay)
      }
    }

    // Keep last-good snapshot; record error only.
    this.lastError =
      lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'parse failed')
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
