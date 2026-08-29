import os from 'node:os'

/** Non-internal IPv4 addresses suitable for LAN URL display. */
export function listLanIpv4Addresses(): string[] {
  const nets = os.networkInterfaces()
  const result: string[] = []
  for (const entries of Object.values(nets)) {
    if (!entries) continue
    for (const entry of entries) {
      const family = String(entry.family)
      if (family !== 'IPv4' && family !== '4') continue
      if (entry.internal) continue
      result.push(entry.address)
    }
  }
  return result
}

export const getLanAddresses = listLanIpv4Addresses
