import { describe, expect, it } from 'vitest'
import { nextPrimaryUrl } from '../../src/shared/lan-primary.js'
import { rankLanIpv4Addresses, listLanIpv4Addresses } from '../../src/server/lan.js'

describe('nextPrimaryUrl', () => {
  const urls = ['http://192.168.1.10:8787', 'http://10.0.0.2:8787']

  it('returns null when server is stopped', () => {
    expect(nextPrimaryUrl(urls, urls[0], false)).toBeNull()
  })

  it('returns first URL when running and no selection', () => {
    expect(nextPrimaryUrl(urls, null, true)).toBe(urls[0])
  })

  it('keeps manual selection when still in the list', () => {
    expect(nextPrimaryUrl(urls, urls[1], true)).toBe(urls[1])
  })

  it('falls back to first when selection left the list', () => {
    expect(nextPrimaryUrl(urls, 'http://172.25.0.1:8787', true)).toBe(urls[0])
  })

  it('returns null for empty list while running', () => {
    expect(nextPrimaryUrl([], null, true)).toBeNull()
  })
})

describe('rankLanIpv4Addresses boundaries', () => {
  it('treats 100.63 as non-CGNAT and 100.64 as CGNAT', () => {
    const ranked = rankLanIpv4Addresses(['100.64.0.1', '100.63.255.1', '192.168.0.1'])
    expect(ranked).toEqual(['192.168.0.1', '100.63.255.1', '100.64.0.1'])
  })

  it('treats 100.127 as CGNAT and 100.128 as non-CGNAT', () => {
    const ranked = rankLanIpv4Addresses(['100.128.0.1', '100.127.255.1'])
    expect(ranked[0]).toBe('100.128.0.1')
    expect(ranked[1]).toBe('100.127.255.1')
  })

  it('treats 172.15 as non-RFC1918 and 172.16–31 as RFC1918', () => {
    const ranked = rankLanIpv4Addresses([
      '172.32.0.1',
      '172.15.0.1',
      '172.16.0.1',
      '172.31.255.1'
    ])
    expect(ranked.slice(0, 2)).toEqual(['172.16.0.1', '172.31.255.1'])
    expect(ranked.slice(2)).toEqual(['172.32.0.1', '172.15.0.1'])
  })

  it('orders Hyper-V case as 192.168 then 172.25 then CGNAT', () => {
    expect(
      rankLanIpv4Addresses(['100.100.10.1', '172.25.64.1', '192.168.1.50'])
    ).toEqual(['192.168.1.50', '172.25.64.1', '100.100.10.1'])
  })
})

describe('listLanIpv4Addresses APIPA filter', () => {
  it('does not return 169.254 link-local addresses when present on a NIC', () => {
    // Smoke: whatever NICs exist, none should be APIPA.
    for (const ip of listLanIpv4Addresses()) {
      expect(ip.startsWith('169.254.')).toBe(false)
    }
  })
})
