import { describe, expect, it } from 'vitest'

import { unitSuggestions } from '../../../src/utils/units'

const NAMES = ['millivolt', 'millisecond', 'mV_per_ms', 'mV', 'mL_per_s', 'second', 'per_second']

describe('unitSuggestions', () => {
  it('puts an exact match first, then prefixes, then substrings, each shortest first', () => {
    expect(unitSuggestions('mv', NAMES)).toEqual(['mV', 'mV_per_ms'])
    expect(unitSuggestions('second', NAMES)).toEqual(['second', 'per_second', 'millisecond'])
  })

  it('finds names containing the typed text', () => {
    expect(unitSuggestions('per_s', NAMES)).toEqual(['per_second', 'mL_per_s'])
  })

  it('ignores case', () => {
    expect(unitSuggestions('MILLI', NAMES)).toEqual(['millivolt', 'millisecond'])
  })

  it('breaks length ties alphabetically', () => {
    expect(unitSuggestions('b', ['cb', 'ab', 'bb'])).toEqual(['bb', 'ab', 'cb'])
  })

  it('stops at the limit', () => {
    expect(unitSuggestions('m', NAMES, 2)).toHaveLength(2)
  })

  it('offers nothing for blank text or a name that is already complete', () => {
    expect(unitSuggestions('', NAMES)).toEqual([])
    expect(unitSuggestions('  ', NAMES)).toEqual([])
    expect(unitSuggestions('millivolt', NAMES)).toEqual([])
  })

  it('accepts a Set', () => {
    expect(unitSuggestions('volt', new Set(NAMES))).toEqual(['millivolt'])
  })
})
