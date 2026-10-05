// @vitest-environment happy-dom
import fs from 'node:fs'
import path from 'node:path'

import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { analyzeMathXml } from '../../../src/services/math/analyzeMath.js'
import { reconcileRows } from '../../../src/services/math/reconcileRows.js'
import { migrateWorkspace } from '../../../src/services/workspaceMigrator.js'
import { useLibraryStore } from '../../../src/stores/libraryStore.js'
import { resolvePortCouplings } from '../../../src/utils/edges.js'
import { generateFlattenedModel } from '../../../src/utils/cellml.js'
import { interpretUnitExpression } from '../../../src/utils/unitExpression.js'
import { resolveBoundaryValues } from '../../../src/services/export/boundaryValues.js'
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

describe('generateFlattenedModel with units made from expressions', () => {
  const FLOW_REF = 'file:flow'
  // dV/dt = Q, in units only the generated units file defines.
  const FLOW_XML = `<model xmlns="http://www.cellml.org/cellml/2.0#" name="flow">
  <component name="flow">
    <variable name="t" units="second" interface="public"/>
    <variable name="V" units="uL" initial_value="1" interface="public"/>
    <variable name="Q" units="uL_per_s" initial_value="2"/>
    <math xmlns="http://www.w3.org/1998/Math/MathML">
      <apply><eq/><apply><diff/><bvar><ci>t</ci></bvar><ci>V</ci></apply><ci>Q</ci></apply>
    </math>
  </component>
</model>`

  beforeAll(async () => {
    await ensureLibCellmlReady()
  }, 120000)

  it('imports the generated units, and the result analyses cleanly', async () => {
    setActivePinia(createPinia())
    const store = useLibraryStore()
    const library = { names: store.availableUnitNames, definitions: store.unitDefinitions, expansions: store.unitExpansions }
    for (const text of ['uL', 'uL/s']) store.addGeneratedUnits(interpretUnitExpression(text, library))
    store.addMath(FLOW_REF, FLOW_XML)

    const rows = reconcileRows(analyzeMathXml(store.availableMath.get(FLOW_REF)), [], { defaults: store.getMathDefaults(FLOW_REF) })
    const node = { id: 'n1', type: 'instanceNode', data: { name: 'flow_1', mathRef: FLOW_REF, variables: rows, ports: [] } }

    const text = await (await generateFlattenedModel([node], [], store)).text()
    expect(text).toMatch(/<units name="uL_per_s">/)
    expect(text).toMatch(/<unit (?=[^>]*units="litre")(?=[^>]*prefix="micro")[^>]*\/>/)
  })
})

describe('boundary values in a migrated workspace', () => {
  beforeAll(async () => {
    await ensureLibCellmlReady()
  }, 120000)

  // The full export of this workspace also fails on main ("The model is not fully defined"), so this
  // checks the boundary conditions it hands to generateFlattenedModel instead.
  it('sets each boundary condition group once, from the module that supplies it', () => {
    setActivePinia(createPinia())
    const file = path.resolve(process.cwd(), 'tests/resources/migration-versioning/legacy/tran_hund_coupled.json')
    const migrated = migrateWorkspace(JSON.parse(fs.readFileSync(file, 'utf8')))

    // Legacy edges have no couplings yet; the workspace resolves them on load, in this order.
    const { nodes, edges } = migrated.flow
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const outCount = new Map()
    const inCount = new Map()
    for (const edge of edges) {
      const sourceIndex = outCount.get(edge.source) ?? 0
      const targetIndex = inCount.get(edge.target) ?? 0
      const couplings = resolvePortCouplings(
        nodeById.get(edge.source).data.ports ?? [],
        nodeById.get(edge.target).data.ports ?? [],
        sourceIndex,
        targetIndex
      )
      edge.data = { ...edge.data, couplings }
      outCount.set(edge.source, sourceIndex + 1)
      inCount.set(edge.target, targetIndex + 1)
    }

    const { supplied, missing, conflicts } = resolveBoundaryValues(nodes, edges)
    const environment = nodes.find((node) => node.data.name === 'Environment')
    expect(conflicts).toEqual([])
    expect(missing.size).toBe(0)
    expect([...supplied.get(environment.id)]).toEqual(expect.arrayContaining(['Na_o', 'Cl_o']))
    const suppliedNa = [...supplied.values()].filter((names) => names.has('Na_o'))
    expect(suppliedNa).toHaveLength(1)
  })
})
