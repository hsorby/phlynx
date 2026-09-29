import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { normaliseLegacyMathML } from '../../../../src/services/math/normaliseMath'
import { useLibraryStore } from '../../../../src/stores/libraryStore'

const withOperator = (operator) =>
  `<math xmlns="http://www.w3.org/1998/Math/MathML"><apply><eq/><ci>r</ci><apply>${operator}<ci>q</ci></apply></apply></math>`

describe('normaliseLegacyMathML', () => {
  it('rewrites <sqrt/> as <root/>', () => {
    expect(normaliseLegacyMathML(withOperator('<sqrt/>'))).toBe(withOperator('<root/>'))
    expect(normaliseLegacyMathML(withOperator('<sqrt />'))).toBe(withOperator('<root/>'))
    expect(normaliseLegacyMathML(withOperator('<sqrt></sqrt>'))).toBe(withOperator('<root/>'))
    expect(normaliseLegacyMathML(withOperator('<m:sqrt/>'))).toBe(withOperator('<m:root/>'))
  })

  it('leaves valid math and variable names alone', () => {
    const valid = withOperator('<root/>').replace('<ci>q</ci>', '<ci>sqrt_q</ci>')
    expect(normaliseLegacyMathML(valid)).toBe(valid)
    expect(normaliseLegacyMathML('')).toBe('')
  })
})

describe('libraryStore', () => {
  it('stores legacy math in its CellML 2.0 form, whether added or loaded', () => {
    setActivePinia(createPinia())
    const store = useLibraryStore()

    store.addMath('file:added', withOperator('<sqrt/>'))
    expect(store.availableMath.get('file:added')).toBe(withOperator('<root/>'))

    store.loadState({ availableMath: [['file:loaded', withOperator('<sqrt/>')]] })
    expect(store.availableMath.get('file:loaded')).toBe(withOperator('<root/>'))
  })
})
