import { resolve } from 'node:path'
import { createApp } from './app.js'
import { getLanAddresses } from './lan.js'
import { TournamentStore } from './store.js'

const PORT = Number(process.env.PORT ?? 8787)
const TDF_PATH = process.env.TDF_PATH

async function main(): Promise<void> {
  const store = new TournamentStore()
  if (TDF_PATH) {
    await store.load(resolve(TDF_PATH))
    console.log(`Loaded TDF: ${resolve(TDF_PATH)}`)
  } else {
    console.log('No TDF_PATH set — API will return no_tournament until load')
  }

  const app = createApp(store)
  const host = '0.0.0.0'
  app.listen(PORT, host, () => {
    const lan = getLanAddresses()
    console.log(`TOM LAN viewer listening on http://${host}:${PORT}`)
    for (const ip of lan) {
      console.log(`  LAN: http://${ip}:${PORT}`)
    }
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
