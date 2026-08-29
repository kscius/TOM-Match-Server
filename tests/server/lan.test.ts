import { describe, expect, it } from 'vitest'
import { rankLanIpv4Addresses } from '../../src/server/lan.js'

describe('rankLanIpv4Addresses', () => {
  it('empty array returns empty array', () => {
    expect(rankLanIpv4Addresses([])).toEqual([])
  })

  it('prefers 192.168.x.x over 100.x (CGNAT) and 172.25.x.x (Hyper-V virtual)', () => {
    const input = ['100.100.10.1', '172.25.64.1', '192.168.1.50']
    expect(rankLanIpv4Addresses(input)[0]).toBe('192.168.1.50')
  })

  it('prefers 10.x.x.x over CGNAT 100.x', () => {
    const input = ['100.100.10.1', '10.0.0.5']
    expect(rankLanIpv4Addresses(input)[0]).toBe('10.0.0.5')
  })

  it('prefers 192.168 (tier 0) over 10.x (tier 1)', () => {
    const input = ['10.0.0.1', '192.168.0.5']
    expect(rankLanIpv4Addresses(input)[0]).toBe('192.168.0.5')
  })

  it('preserves relative order within the same tier', () => {
    const input = ['192.168.1.1', '192.168.1.2', '192.168.1.3']
    expect(rankLanIpv4Addresses(input)).toEqual(['192.168.1.1', '192.168.1.2', '192.168.1.3'])
  })

  it('places CGNAT 100.64-127.x last', () => {
    const input = ['100.80.5.1', '10.0.0.1', '192.168.1.1', '100.127.0.1']
    const ranked = rankLanIpv4Addresses(input)
    expect(ranked[ranked.length - 1]).toMatch(/^100\./)
    expect(ranked[ranked.length - 2]).toMatch(/^100\./)
    expect(ranked[0]).toBe('192.168.1.1')
  })

  it('puts non-CGNAT public IPs between RFC1918 and CGNAT', () => {
    const input = ['100.80.0.1', '1.2.3.4', '192.168.0.1']
    const ranked = rankLanIpv4Addresses(input)
    expect(ranked[0]).toBe('192.168.0.1')
    expect(ranked[1]).toBe('1.2.3.4')
    expect(ranked[2]).toBe('100.80.0.1')
  })

  it('does not mutate the original array', () => {
    const input = ['100.80.0.1', '192.168.1.1']
    const copy = [...input]
    rankLanIpv4Addresses(input)
    expect(input).toEqual(copy)
  })
})
