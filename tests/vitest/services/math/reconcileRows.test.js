import { describe, expect, it } from 'vitest'
import { reconcileRows } from '../../../../src/services/math/reconcileRows'

const analysis = (overrides = {}) => ({
  componentName: 'c',
  declared: [],
  referenced: [],
  stateVariables: [],
  unresolved: [],
  assigned: [],
  voi: [],
  ...overrides,
})

const byName = (rows) => Object.fromEntries(rows.map((row) => [row.name, row]))

describe('reconcileRows (simple mode)', () => {
  it('creates a default initialiser for a state and marks computed variables', () => {
    const rows = byName(
      reconcileRows(analysis({ referenced: ['t', 'V', 'k', 'I'], stateVariables: ['V'], assigned: ['I'], voi: ['t'] }))
    )
    expect(rows.V).toMatchObject({ type: 'variable', stateRole: 'state', initialiser: 'V_init' })
    expect(rows.V_init).toMatchObject({ type: 'constant', access: 'no_access' })
    expect(rows.I.type).toBe('variable')
    expect(rows.t.type).toBe('variable')
    expect(rows.k.type).toBe('constant')
  })

  it('keeps what the person entered over what the XML says', () => {
    const previous = [{ name: 'k', units: 'metre', value: '3', type: 'global_constant', access: 'no_access' }]
    const rows = byName(
      reconcileRows(analysis({ referenced: ['k'], declared: [{ name: 'k', units: 'second', interface: '', initialValue: '1' }] }), previous)
    )
    expect(rows.k).toMatchObject({ units: 'metre', value: '3', type: 'global_constant', access: 'no_access' })
  })

  it('seeds units and numeric values from declarations for new rows', () => {
    const rows = byName(
      reconcileRows(analysis({ referenced: ['k'], declared: [{ name: 'k', units: 'second', interface: 'public', initialValue: '1.5' }] }))
    )
    expect(rows.k).toMatchObject({ units: 'second', value: '1.5', access: 'access' })
  })

  it('pairs a state with its named initialiser, even one computed by the math', () => {
    const rows = byName(
      reconcileRows(
        analysis({
          referenced: ['c', 'c_init', 'a'],
          stateVariables: ['c'],
          assigned: ['c_init'],
          declared: [{ name: 'c', units: 'mM', interface: '', initialValue: 'c_init' }],
        })
      )
    )
    expect(rows.c.initialiser).toBe('c_init')
    expect(rows.c_init.type).toBe('variable')
    expect(rows.c_init.units).toBe('mM')
  })

  it('carries forward an initialiser known only from a previous pass, including a shared one', () => {
    const previous = [
      { name: 'A', stateRole: 'state', initialiser: 'shared_init', units: 'mM', type: 'variable' },
      { name: 'B', stateRole: 'state', initialiser: 'shared_init', units: 'mM', type: 'variable' },
      { name: 'shared_init', value: '2', units: 'mM', type: 'constant', access: 'no_access' },
    ]
    const rows = reconcileRows(analysis({ referenced: ['A', 'B'], stateVariables: ['A', 'B'] }), previous)
    const named = byName(rows)
    expect(named.A.initialiser).toBe('shared_init')
    expect(named.B.initialiser).toBe('shared_init')
    expect(rows.filter((row) => row.name === 'shared_init')).toHaveLength(1)
    expect(named.shared_init.value).toBe('2')
  })

  it('drops the state marking when a variable stops being a state', () => {
    const previous = [{ name: 'V', stateRole: 'state', initialiser: 'V_init', type: 'variable' }]
    const rows = byName(reconcileRows(analysis({ referenced: ['V'] }), previous))
    expect(rows.V.stateRole).toBeUndefined()
    expect(rows.V.initialiser).toBeUndefined()
  })

  it('does not mutate previous rows', () => {
    const previous = [{ name: 'V', units: 'volt', value: '1', type: 'constant', access: 'access' }]
    const snapshot = JSON.parse(JSON.stringify(previous))
    reconcileRows(analysis({ referenced: ['V'], stateVariables: ['V'] }), previous)
    expect(previous).toEqual(snapshot)
  })
})

describe('reconcileRows (advanced mode)', () => {
  const declared = [
    { name: 't', units: 'second', interface: 'public', initialValue: '' },
    { name: 'V', units: 'volt', interface: '', initialValue: '-0.08' },
    { name: 'k', units: 'per_second', interface: '', initialValue: '2' },
    { name: 'I', units: 'amp', interface: '', initialValue: '' },
  ]

  it('builds rows from declarations, with text-owned units and textInit', () => {
    const previous = [{ name: 'k', units: 'metre', value: '9', type: 'global_constant', access: 'no_access' }]
    const rows = byName(
      reconcileRows(analysis({ declared, referenced: ['t', 'V', 'k', 'I'], stateVariables: ['V'] }), previous, { mode: 'advanced' })
    )
    expect(Object.keys(rows)).toEqual(expect.arrayContaining(['t', 'V', 'k', 'I', 'V_init']))
    expect(rows.k).toMatchObject({ units: 'per_second', value: '9', type: 'global_constant', textInit: '2' })
    expect(rows.I).toMatchObject({ type: 'variable' })
    expect(rows.I.textInit).toBeUndefined()
    expect(rows.t).toMatchObject({ type: 'variable', access: 'access' })
    expect(rows.V).toMatchObject({ stateRole: 'state', type: 'variable', textInit: '-0.08' })
  })
})
