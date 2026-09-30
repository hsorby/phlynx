// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { analyzeMathXml } from '../../../../src/services/math/analyzeMath'
import { classifyRows, isInitialisable } from '../../../../src/services/math/variableKinds'

/** A component whose math is the given equations, in MathML. */
const model = (equations) => `<model xmlns="http://www.cellml.org/cellml/2.0#" name="m">
  <component name="c">
    <math xmlns="http://www.w3.org/1998/Math/MathML">${equations}</math>
  </component>
</model>`

// dV/dt = I, k_eff = k1 * k2, I = g * (V - E_in)
const MATH = model(`
  <apply><eq/><apply><diff/><bvar><ci>t</ci></bvar><ci>V</ci></apply><ci>I</ci></apply>
  <apply><eq/><ci>k_eff</ci><apply><times/><ci>k1</ci><ci>k2</ci></apply></apply>
  <apply><eq/><ci>I</ci><apply><times/><ci>g</ci><apply><minus/><ci>V</ci><ci>E_in</ci></apply></apply></apply>
`)

const ROWS = [
  { name: 't', type: 'variable' },
  { name: 'V', type: 'variable', stateRole: 'state', initialiser: 'V_init' },
  { name: 'V_init', type: 'constant' },
  { name: 'k1', type: 'constant' },
  { name: 'k2', type: 'global_constant' },
  { name: 'k_eff', type: 'variable' },
  { name: 'g', type: 'constant' },
  { name: 'I', type: 'variable' },
  { name: 'E_in', type: 'variable' }, // not defined here, so it comes through a port
]

const byName = (name) => ROWS.find((row) => row.name === name)

describe('classifyRows', () => {
  const kinds = classifyRows(analyzeMathXml(MATH), ROWS)

  it("takes the constants from the rows' types", () => {
    expect(kinds.get('k1')).toBe('constant')
    expect(kinds.get('k2')).toBe('constant')
    expect(kinds.get('g')).toBe('constant')
  })

  it('classifies what the math computes', () => {
    expect(kinds.get('t')).toBe('voi')
    expect(kinds.get('V')).toBe('state')
    expect(kinds.get('k_eff')).toBe('computed_constant')
    expect(kinds.get('I')).toBe('algebraic')
  })

  it('treats a variable the math uses but does not define as an input from a port', () => {
    expect(kinds.get('E_in')).toBe('external')
  })

  it('follows a row whose type changes', () => {
    const rows = ROWS.map((row) => (row.name === 'k1' ? { ...row, type: 'variable' } : row))
    const changed = classifyRows(analyzeMathXml(MATH), rows)
    expect(changed.get('k1')).toBe('external')
    expect(changed.get('k_eff')).toBe('algebraic')
  })

  it('returns null without an analysis', () => {
    expect(classifyRows(null, ROWS)).toBeNull()
  })
})

describe('isInitialisable', () => {
  const kinds = classifyRows(analyzeMathXml(MATH), ROWS)

  it('allows constants and computed constants only', () => {
    expect(isInitialisable(byName('k1'), kinds)).toBe(true)
    expect(isInitialisable(byName('k_eff'), kinds)).toBe(true)
    for (const name of ['t', 'V', 'I', 'E_in']) expect(isInitialisable(byName(name), kinds), name).toBe(false)
  })

  it('falls back to the row type without kinds, or for a row the math does not mention', () => {
    expect(isInitialisable(byName('V_init'), kinds)).toBe(true)
    expect(isInitialisable(byName('k1'), null)).toBe(true)
    expect(isInitialisable(byName('k_eff'), null)).toBe(false)
  })
})
