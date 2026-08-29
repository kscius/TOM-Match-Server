import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type Express, type Request, type Response } from 'express'
import type { TournamentStore } from './store.js'
import {
  buildPlayerView,
  toPlayersDto,
  toTournamentDto
} from '../shared/tournament/dto.js'

function moduleDir(): string {
  // Works under tsx (src/server) and electron-vite SSR bundle (out/main).
  try {
    return dirname(fileURLToPath(import.meta.url))
  } catch {
    return __dirname
  }
}

/** Resolve player SPA dist relative to package root, not process.cwd(). */
export function resolvePlayerDist(): string {
  const here = moduleDir()
  const resources =
    typeof process.resourcesPath === 'string' ? process.resourcesPath : ''
  const candidates = [
    // electron-builder extraResources → resources/player
    ...(resources ? [join(resources, 'player')] : []),
    resolve(here, '../../dist/player'), // src/server or out/main → repo root
    resolve(process.cwd(), 'dist/player')
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'index.html'))) return dir
  }
  return candidates[0]!
}

function isLoopback(req: Request): boolean {
  const raw = req.socket.remoteAddress ?? ''
  return (
    raw === '127.0.0.1' ||
    raw === '::1' ||
    raw === '::ffff:127.0.0.1' ||
    raw.endsWith('/127.0.0.1')
  )
}

export function createApp(
  store: TournamentStore,
  options?: { playerDist?: string }
): Express {
  const app = express()
  app.disable('x-powered-by')

  // Same-origin / LAN only — do not set Access-Control-Allow-Origin: *

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true })
  })

  app.get('/api/tournament', (_req: Request, res: Response) => {
    const t = store.getTournament()
    if (!t) {
      res.status(404).json({ error: 'no_tournament' })
      return
    }
    res.json(toTournamentDto(t, store.getUpdatedAt()))
  })

  app.get('/api/players', (_req: Request, res: Response) => {
    const t = store.getTournament()
    if (!t) {
      res.status(404).json({ error: 'no_tournament' })
      return
    }
    res.json(toPlayersDto(t))
  })

  app.get('/api/players/:userid/view', (req: Request, res: Response) => {
    const userid = String(req.params.userid)
    const t = store.getTournament()
    if (!t) {
      res.json(buildPlayerView(null, userid))
      return
    }
    const known = t.players.some((p) => p.userid === userid)
    if (!known) {
      res.status(404).json({ error: 'unknown_userid' })
      return
    }
    res.json(buildPlayerView(t, userid))
  })

  // Host/debug only — loopback; never echo filesystem paths from errors.
  app.post('/api/reload', async (req: Request, res: Response) => {
    if (!isLoopback(req)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const ok = await store.reload()
    if (!store.getTournament() && !ok) {
      res.status(404).json({ error: 'no_tournament', ok: false })
      return
    }
    res.json({
      ok,
      updatedAt: store.getUpdatedAt(),
      ...(ok ? {} : { error: 'reload_failed' })
    })
  })

  const playerDist = options?.playerDist ?? resolvePlayerDist()
  if (existsSync(join(playerDist, 'index.html'))) {
    app.use(express.static(playerDist))
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api/')) {
        next()
        return
      }
      res.sendFile(join(playerDist, 'index.html'), (err) => {
        if (err) next()
      })
    })
  }

  return app
}
