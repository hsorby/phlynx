import { Position } from '@vue-flow/core'
import { HANDLE_SIDES, SOURCE_HANDLE_PRIORITY, TARGET_HANDLE_PRIORITY } from './constants'

export function randomHandleSide() {
    return HANDLE_SIDES[Math.floor(Math.random() * HANDLE_SIDES.length)]
}

export function getHandleId(handle) {
    return `handle_${handle.uid}`
}

export function handlePosition(side) {
  switch (side) {
    case 'left':
      return Position.Left
    case 'right':
      return Position.Right
    case 'top':
      return Position.Top
    case 'bottom':
      return Position.Bottom
    default:
      return Position.Left
  }
}

export function getHandleStyle(handle, allHandles) {
  const handlesOfSameType = allHandles.filter((h) => h.side === handle.side)
  const n = handlesOfSameType.length

  // Space between each port.
  const handleSpacing = 16
  const positionIndex = handlesOfSameType.findIndex((h) => h.uid === handle.uid)

  // guard: if not found, fall back to 0
  const safeIndex = positionIndex === -1 ? 0 : positionIndex

  // This calculates the offset from the center
  const offset = handleSpacing * (positionIndex - (n - 1) / 2)

  if (['top', 'bottom'].includes(handle.side)) {
    // Let CSS calculate the 50% mark and apply the offset
    return {
      left: `calc(50% + ${offset}px)`,
    }
  }

  // Let CSS calculate the 50% mark and apply the offset
  return {
    top: `calc(50% + ${offset}px)`,
  }
}
