export type PlayerUiScreen = 'roster' | 'player'

export interface SnapshotRerenderInput {
  isPoll: boolean
  dataChanged: boolean
  keyChanged: boolean
  screen: PlayerUiScreen
  hasSelection: boolean
  /** Screen/error mutated by refreshPlayerView (e.g. 404 → roster). */
  force?: boolean
}

/**
 * Decide whether loadSnapshot should call render().
 * Unchanged roster polls must skip to preserve search focus + list scroll.
 */
export function shouldRerenderAfterSnapshot(
  input: SnapshotRerenderInput
): boolean {
  if (!input.isPoll) return true
  if (input.force) return true
  if (input.dataChanged || input.keyChanged) return true
  if (input.screen === 'player' && input.hasSelection) return true
  return false
}

export interface RosterUiPreserve {
  searchFocused: boolean
  selectionStart: number | null
  selectionEnd: number | null
  scrollTop: number
}

export function captureRosterUi(
  root: ParentNode,
  active: Element | null
): RosterUiPreserve | null {
  const input = root.querySelector('#player-search') as HTMLInputElement | null
  const list = root.querySelector('ul.roster') as HTMLElement | null
  if (!input && !list) return null
  return {
    searchFocused: input != null && active === input,
    selectionStart: input?.selectionStart ?? null,
    selectionEnd: input?.selectionEnd ?? null,
    scrollTop: list?.scrollTop ?? 0
  }
}

export function restoreRosterUi(
  root: ParentNode,
  snap: RosterUiPreserve | null
): void {
  if (!snap) return
  const input = root.querySelector('#player-search') as HTMLInputElement | null
  const list = root.querySelector('ul.roster') as HTMLElement | null
  if (list) list.scrollTop = snap.scrollTop
  if (input && snap.searchFocused) {
    input.focus()
    if (snap.selectionStart != null && snap.selectionEnd != null) {
      try {
        input.setSelectionRange(snap.selectionStart, snap.selectionEnd)
      } catch {
        // type=search may reject setSelectionRange in some engines
      }
    }
  }
}
