import { Position } from '@vue-flow/core'
import {
  HANDLE_SIDES,
  SOURCE_HANDLE_PRIORITY,
  TARGET_HANDLE_PRIORITY,
  TARGET_HANDLE_TYPE,
  SOURCE_HANDLE_TYPE,
  HANDLE_VARIANT,
} from './constants'

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
  const handlesOfSameType = allHandles.filter(
    (h) => h.side === handle.side 
  )
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

function parseInstanceNames(connectedInstances) {
  return Array.from(
    new Set(connectedInstances?.trim().split(/\s+/).filter(Boolean) ?? [])
  )
}

/**
 * Creates a list of handles for an instance node given the instance ref 
 * defined in an instance array file.
 * 
 * @param {object} instanceRef 
 * @returns {[handle]} handle 
 */
export function buildHandles(instanceRef) {
  const handles = []

  if (instanceRef.inp_instances) {
    const inputs = parseInstanceNames(instanceRef.inp_instances)
    inputs.forEach((name) => {
      handles.push({
        uid: crypto.randomUUID(),
        type: TARGET_HANDLE_TYPE,
        side: 'left',
        name,
      })
    })
  }

  if (instanceRef.out_instances) {
    const outputs = parseInstanceNames(instanceRef.out_instances)
    outputs.forEach((name) => {
      handles.push({
        uid: crypto.randomUUID(),
        type: SOURCE_HANDLE_TYPE,
        side: 'right',
        name,
      })
    })
  }

  return handles
}

export function buildGhostHandles(count = 16) {
  const perSide = Math.floor(count / HANDLE_SIDES.length)
  const remainder = count % HANDLE_SIDES.length

  const handles = []

  HANDLE_SIDES.forEach((side, sideIndex) => {
    // spread any remainder across the first few sides so odd counts still work
    const n = perSide + (sideIndex < remainder ? 1 : 0)

    for (let i = 0; i < n; i++) {
      handles.push({
        uid: crypto.randomUUID(),
        side,
        name: '',
        variant: HANDLE_VARIANT.GHOST,
      })
    }
  })

  return handles
}
