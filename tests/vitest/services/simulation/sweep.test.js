import { describe, expect, it } from 'vitest'

import {
  createSweep,
  findSweepProblem,
  isSweepableEntry,
  isSweepableRow,
  MAX_SWEEP_POINTS,
  resolveSweepTarget,
  sweepLabel,
  sweepValues,
} from '../../../../src/services/simulation/sweep.js'

const node = (id, name, variables) => ({ id, data: { name, variables } })

describe('isSweepableRow', () => {
  it('sweeps what has a value of its own, not what the model computes', () => {
    for (const type of ['constant', 'global_constant']) expect(isSweepableRow({ name: 'x', type }, 'n1', new Set()), type).toBe(true)
    expect(isSweepableRow({ name: 'x', type: 'variable' }, 'n1', new Set())).toBe(false)
  })

  it('sweeps a boundary condition only while nothing connected supplies it', () => {
    const row = { name: 'V', type: 'boundary_condition' }
    expect(isSweepableRow(row, 'n1', new Set(['n1::V']))).toBe(true)
    expect(isSweepableRow(row, 'n1', new Set())).toBe(false)
  })
})

describe('isSweepableEntry', () => {
  const entry = (overrides) => ({ key: 'n1::g', nodeId: 'n1', rowName: 'g', kind: 'constant', reportedName: null, ...overrides })
  const unsupplied = new Set()

  it('leaves out the parameter already swept', () => {
    expect(isSweepableEntry(entry(), { unsupplied, sweep: { key: 'n1::g', type: 'constant', parameterName: 'g' } })).toBe(false)
    expect(isSweepableEntry(entry(), { unsupplied, sweep: { key: 'n1::k', type: 'constant', parameterName: 'k' } })).toBe(true)
  })

  it('leaves out a global constant already swept, from whichever instance', () => {
    const global = entry({ key: 'global::T', nodeId: 'n2', rowName: 'T', kind: 'global_constant' })
    expect(isSweepableEntry(global, { unsupplied, sweep: { key: 'n1::T', type: 'global_constant', parameterName: 'T' } })).toBe(false)
  })

  it('leaves out what the last run computed', () => {
    const variables = new Map([
      ['cell/g', { kind: 'computedConstant' }],
      ['cell/k', { kind: 'constant' }],
    ])
    expect(isSweepableEntry(entry({ reportedName: 'cell/g' }), { unsupplied, variables })).toBe(false)
    expect(isSweepableEntry(entry({ reportedName: 'cell/k' }), { unsupplied, variables })).toBe(true)
    // Not in the last run: the row type decides.
    expect(isSweepableEntry(entry(), { unsupplied, variables })).toBe(true)
  })
})

describe('createSweep', () => {
  it('spans half the value either side', () => {
    const sweep = createSweep(node('n1', 'cell', []), { name: 'V', type: 'boundary_condition', units: 'millivolt', value: '-80' }, () => null)
    expect(sweep).toMatchObject({ key: 'n1::V', nodeName: 'cell', parameterName: 'V', units: 'millivolt', from: -120, to: -40, points: 51 })
    expect(sweepLabel(sweep)).toBe('cell/V')
  })

  it('spans 0 to 1 for a value of 0 or none', () => {
    expect(createSweep(node('n1', 'cell', []), { name: 'k', type: 'constant', value: '0' }, () => null)).toMatchObject({ from: 0, to: 1 })
  })
})

describe('findSweepProblem', () => {
  const sweep = { parameterName: 'V', from: -100, to: 50, points: 16 }

  it('passes a complete sweep', () => {
    expect(findSweepProblem(sweep)).toBeNull()
  })

  it.each([
    [null, /choose a parameter/i],
    [{ ...sweep, from: null }, /start and end/],
    [{ ...sweep, to: 50, from: 50 }, /different value/],
    [{ ...sweep, points: 1 }, /from 2 to/],
    [{ ...sweep, points: MAX_SWEEP_POINTS + 1 }, /from 2 to/],
    [{ ...sweep, points: 2.5 }, /from 2 to/],
  ])('stops %j', (candidate, message) => {
    expect(findSweepProblem(candidate)).toMatch(message)
  })
})

describe('sweepValues', () => {
  it('spaces the values evenly, from the lower end up, ending exactly at the upper', () => {
    expect(sweepValues({ from: 0, to: 1, points: 5 })).toEqual([0, 0.25, 0.5, 0.75, 1])
    expect(sweepValues({ from: 50, to: -100, points: 4 })).toEqual([-100, -50, 0, 50])
    expect(sweepValues({ from: 0, to: 0.3, points: 4 }).at(-1)).toBe(0.3)
  })
})

describe('resolveSweepTarget', () => {
  const nodes = [
    node('n1', 'cell', [
      { name: 'V', type: 'boundary_condition' },
      { name: 'I', type: 'variable' },
      { name: 'g', type: 'global_constant' },
    ]),
  ]
  const mapping = new Map([
    ['n1::V', 'parameters/V'],
    ['n1::I', 'cell/I'],
    ['n1::g', 'global_parameters/g'],
  ])
  const variables = new Map([
    ['parameters/V', { kind: 'constant' }],
    ['cell/I', { kind: 'algebraic' }],
    ['global_parameters/g', { kind: 'constant' }],
  ])
  const resolve = (sweep) => resolveSweepTarget({ sweep, nodes, mapping, variables })

  it('names the constant libOpenCOR changes', () => {
    expect(resolve({ nodeId: 'n1', nodeName: 'cell', parameterName: 'V', type: 'boundary_condition' })).toEqual({ component: 'parameters', variable: 'V' })
  })

  it('finds a global constant through any instance using it', () => {
    expect(resolve({ nodeId: 'gone', nodeName: 'other', parameterName: 'g', type: 'global_constant' })).toEqual({
      component: 'global_parameters',
      variable: 'g',
    })
  })

  it('explains what can’t be swept', () => {
    expect(resolve({ nodeId: 'n1', nodeName: 'cell', parameterName: 'I', type: 'constant' }).problem).toMatch(/computed by the model/)
    expect(resolve({ nodeId: 'n2', nodeName: 'other', parameterName: 'V', type: 'constant' }).problem).toMatch(/isn’t in the simulated instances/)
  })
})
