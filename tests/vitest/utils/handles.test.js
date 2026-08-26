import { describe, expect, it } from 'vitest'
import { buildGhostHandles, getHandleStyle, normaliseHandleSlots } from '../../../src/utils/handles'

describe('handle layout', () => {
  it('keeps explicit side slots stable even when the handle array order changes', () => {
    const leftHandles = [
      { uid: 'left-1', side: 'left', variant: 'default', slotIndex: 0 },
      { uid: 'left-2', side: 'left', variant: 'default', slotIndex: 1 },
      { uid: 'ghost-1', side: 'left', variant: 'ghost', slotIndex: 2 },
      { uid: 'ghost-2', side: 'left', variant: 'ghost', slotIndex: 3 },
    ]

    const reordered = [leftHandles[2], leftHandles[0], leftHandles[3], leftHandles[1]]

    expect(getHandleStyle(leftHandles[0], leftHandles)).toEqual(getHandleStyle(leftHandles[0], reordered))
    expect(getHandleStyle(leftHandles[1], leftHandles)).toEqual(getHandleStyle(leftHandles[1], reordered))
  })

  it('assigns stable slot indices to ghost handles and active handles on each side', () => {
    const handles = [...buildGhostHandles(2, 2)]
    const normalised = normaliseHandleSlots(handles)

    expect(normalised.every((handle) => Number.isInteger(handle.slotIndex))).toBe(true)
    expect(normalised.filter((handle) => handle.side === 'left').map((handle) => handle.slotIndex)).toEqual([0, 1])
  })
})
