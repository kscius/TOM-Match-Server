import os from 'node:os'

/**
 * Tier rank for phone-reachability (lower = better):
 *   0 → 192.168.0.0/16  (Wi-Fi home/event — best)
 *   1 → 10.0.0.0/8      (corporate LAN)
 *   2 → 172.16.0.0/12   (RFC-1918, incl. Hyper-V subnets 172.16–31)
 *   3 → other non-CGNAT (public / unknown)
 *   4 → 100.64.0.0/10   (CGNAT / Tailscale — worst)
 *
 * APIPA 169.254.0.0/16 is filtered out in listLanIpv4Addresses (not ranked).
 */
function lanTier(ip: string): number {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return 3
  const [a, b] = parts
  if (a === 192 && b === 168) return 0
  if (a === 10) return 1
  if (a === 172 && b >= 16 && b <= 31) return 2
  if (a === 100 && b >= 64 && b <= 127) return 4
  return 3
}

function isApipa(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  return parts.length === 4 && parts[0] === 169 && parts[1] === 254
}

/**
 * Stable sort by phone-reachability tier.
 * Within the same tier, the original relative order is preserved.
 */
export function rankLanIpv4Addresses(ips: string[]): string[] {
  return ips
    .map((ip, i) => ({ ip, i, t: lanTier(ip) }))
    .sort((x, y) => x.t - y.t || x.i - y.i)
    .map((x) => x.ip)
}

/** Non-internal IPv4 addresses in raw NIC order. */
export function listLanIpv4Addresses(): string[] {
  const nets = os.networkInterfaces()
  const result: string[] = []
  for (const entries of Object.values(nets)) {
    if (!entries) continue
    for (const entry of entries) {
      const family = String(entry.family)
      if (family !== 'IPv4' && family !== '4') continue
      if (entry.internal) continue
      if (isApipa(entry.address)) continue
      result.push(entry.address)
    }
  }
  return result
}

/** Non-internal IPv4 addresses sorted by phone-reachability (best first). */
export function listRankedLanIpv4Addresses(): string[] {
  return rankLanIpv4Addresses(listLanIpv4Addresses())
}

/**
 * getLanAddresses returns ranked IPs so both standalone and Electron
 * always put the most phone-reachable address first.
 */
export const getLanAddresses = listRankedLanIpv4Addresses
