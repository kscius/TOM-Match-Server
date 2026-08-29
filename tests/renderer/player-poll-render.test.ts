import { describe, expect, it } from 'vitest'
import { shouldRerenderAfterSnapshot } from '../../src/renderer/player/poll-render.js'

describe('shouldRerenderAfterSnapshot', () => {
  const base = {
    isPoll: true,
    dataChanged: false,
    keyChanged: false,
    screen: 'roster' as const,
    hasSelection: false
  }

  it('skips render on unchanged roster poll (focus/scroll preservation)', () => {
    expect(shouldRerenderAfterSnapshot(base)).toBe(false)
  })

  it('always renders on initial non-poll load', () => {
    expect(shouldRerenderAfterSnapshot({ ...base, isPoll: false })).toBe(true)
  })

  it('renders when tournament updatedAt changed', () => {
    expect(shouldRerenderAfterSnapshot({ ...base, dataChanged: true })).toBe(
      true
    )
  })

  it('renders when tournament key changed', () => {
    expect(shouldRerenderAfterSnapshot({ ...base, keyChanged: true })).toBe(
      true
    )
  })

  it('renders on player screen with selection for live view refresh', () => {
    expect(
      shouldRerenderAfterSnapshot({
        ...base,
        screen: 'player',
        hasSelection: true
      })
    ).toBe(true)
  })

  it('does not render on roster merely because a stale selection flag exists', () => {
    expect(
      shouldRerenderAfterSnapshot({
        ...base,
        screen: 'roster',
        hasSelection: true
      })
    ).toBe(false)
  })

  it('renders when force is set after view mutation (404 → roster)', () => {
    expect(shouldRerenderAfterSnapshot({ ...base, force: true })).toBe(true)
  })
})
