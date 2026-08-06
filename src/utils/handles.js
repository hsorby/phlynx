import { Position } from '@vue-flow/core'
import {
  HANDLE_SIDES,
  SOURCE_HANDLE_PRIORITY,
  TARGET_HANDLE_PRIORITY,
  TARGET_HANDLE_TYPE,
  SOURCE_HANDLE_TYPE,
  HANDLE_VARIANT,
  HANDLE_SPACING,
} from './constants'

export function randomHandleSide() {
  return HANDLE_SIDES[Math.floor(Math.random() * HANDLE_SIDES.length)]
}

export function getHandleId(handle) {
  return `handle_${handle.uid}`
}

export function getHandleUidFromHandleId(handleId) {
  return handleId.replace("handle_", "")
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

  const positionIndex = handlesOfSameType.findIndex((h) => h.uid === handle.uid)
  const safeIndex = positionIndex === -1 ? 0 : positionIndex

  const offset = HANDLE_SPACING * (safeIndex - (n - 1) / 2)

  if (['top', 'bottom'].includes(handle.side)) {
    return { left: `calc(50% + ${offset}px)` }
  }

  return { top: `calc(50% + ${offset}px)` }
}

function parseInstanceNames(connectedInstances) {
  return Array.from(
    new Set(connectedInstances?.trim().split(/\s+/).filter(Boolean) ?? [])
  )
}

export function findMostCentralGhostHandle(side, allHandles) {
  const handlesOnSide = allHandles.filter((h) => h.side === side)
  const center = (handlesOnSide.length - 1) / 2

  let mostCentral = null
  let smallestDistance = Infinity

  handlesOnSide.forEach((h, index) => {
    if (h.variant !== HANDLE_VARIANT.GHOST) return
    const distance = Math.abs(index - center)
    if (distance < smallestDistance) {
      smallestDistance = distance
      mostCentral = h
    }
  })

  return mostCentral
}

export function buildHandles(instanceRef, ghostHandles) {
  const handles = ghostHandles.map((h) => ({ ...h }))

  const promote = (names, type, side) => {
    names.forEach((name) => {
      const ghost = findMostCentralGhostHandle(side, handles)

      if (!ghost) {
        console.warn(
          `[buildHandles] No free "${side}" ghost slot for "${name}" on instance ` +
            `"${instanceRef.name}" — exceeds the per-edge handle limit. Adding an overflow handle.`
        )
        handles.push({
          uid: crypto.randomUUID(),
          type,
          side,
          name,
          variant: HANDLE_VARIANT.DEFAULT,
        })
        return
      }

      ghost.type = type
      ghost.name = name
      ghost.variant = HANDLE_VARIANT.DEFAULT
    })
  }

  if (instanceRef.inp_instances) {
    promote(parseInstanceNames(instanceRef.inp_instances), TARGET_HANDLE_TYPE, 'top')
  }

  if (instanceRef.out_instances) {
    promote(parseInstanceNames(instanceRef.out_instances), SOURCE_HANDLE_TYPE, 'bottom')
  }

  return handles
}

export function buildGhostHandles(countTopBot = 7, countSides = 5) {
  const handles = []

  HANDLE_SIDES.forEach((side, sideIndex) => {
    let n = countTopBot
    if (side === "left" || side === "right"){
      n = countSides
    }

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

export function isCornerHandle(handle, allHandles) {
  const handlesOfSameType = allHandles.filter((h) => h.side === handle.side)
  const n = handlesOfSameType.length
  const positionIndex = handlesOfSameType.findIndex((h) => h.uid === handle.uid)

  return positionIndex === 0 || positionIndex === n - 1
}
