// @vitest-environment happy-dom
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { analyzeMathXml } from '../../../src/services/math/analyzeMath.js'
import { reconcileRows } from '../../../src/services/math/reconcileRows.js'
import { useLibraryStore } from '../../../src/stores/libraryStore.js'
import { generateFlattenedModel } from '../../../src/utils/cellml.js'
import { ensureLibCellmlReady } from '../helpers/libcellml-bootstrap.js'

const MATH_REF = 'file:decay'
// dx/dt = g - k * x. The initialiser is private, as math saved before variables were always public may have.
const XML = `<model xmlns="http://www.cellml.org/cellml/2.0#" name="decay">
  <component name="decay">
    <variable name="t" units="second" interface="public"/>
    <variable name="x" units="dimensionless" initial_value="x_init" interface="public"/>
    <variable name="x_init" units="dimensionless" initial_value="2" interface="private"/>
    <variable name="k" units="per_second" initial_value="0.5"/>
    <variable name="g" units="per_second"/>
    <math xmlns="http://www.w3.org/1998/Math/MathML">
      <apply><eq/>
        <apply><diff/><bvar><ci>t</ci></bvar><ci>x</ci></apply>
        <apply><minus/><ci>g</ci><apply><times/><ci>k</ci><ci>x</ci></apply></apply>
      </apply>
    </math>
  </component>
</model>`
const UNITS = `<model xmlns="http://www.cellml.org/cellml/2.0#" name="units">
  <units name="per_second"><unit units="second" exponent="-1"/></units>
</model>`

describe('generateFlattenedModel with values only in the rows', () => {
  let store

  beforeAll(async () => {
    await ensureLibCellmlReady()
  }, 120000)

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useLibraryStore()
    store.addUnitsFile({ componentFile: 'units.cellml', model: UNITS })
    store.addMath(MATH_REF, XML)
    store.assignGlobalConstant('g', '0.1', 'per_second')
  })

  /** A node whose rows are built from the stored math, as a new instance's are. */
  function buildNode(changes = {}) {
    const rows = reconcileRows(analyzeMathXml(store.availableMath.get(MATH_REF)), [{ name: 'g', type: 'global_constant' }], {
      defaults: store.getMathDefaults(MATH_REF),
    }).map((row) => (row.name in changes ? { ...row, value: changes[row.name] } : row))
    return { id: 'n1', type: 'instanceNode', data: { name: 'decay_1', mathRef: MATH_REF, variables: rows, ports: [] } }
  }

  it('initialises the state and constants from the rows, and the result analyses cleanly', async () => {
    const node = buildNode()
    expect(Object.fromEntries(node.data.variables.map((row) => [row.name, row.value]))).toMatchObject({ x_init: '2', k: '0.5' })

    const text = await (await generateFlattenedModel([node], [], store)).text()
    expect(text).toMatch(/<variable name="x" units="dimensionless" initial_value="x_init"/)
    expect(text).toMatch(/<variable name="x_init"[^>]*initial_value="2"/)
    expect(text).toMatch(/<variable name="x_init" units="dimensionless" interface="public"\/>/)
    expect(text).toMatch(/<variable name="k"[^>]*initial_value="0\.5"/)
    expect(text).toMatch(/<variable name="g"[^>]*initial_value="0\.1"/)
  })

  it('names the parameters left without a value', () => {
    expect(() => generateFlattenedModel([buildNode({ k: '' })], [], store)).toThrow(/Missing parameter values: decay_1\.k/)
  })
})
