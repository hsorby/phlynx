import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { normaliseConfig, restorePorts } from '../../../src/utils/config.js'
import { couplingConflicts, multiplyFactor, parseMultiport, variableTypes } from '../../../src/utils/multiport.js'

const port = (variables, multiportType, multiplyFactor) => ({ label: 'p', variables, multiportType, multiplyFactor })

describe('parseMultiport', () => {
  it.each([
    ['sum', 'Sum'],
    ['SUM', 'Sum'],
    [true, 'True'],
    ['true', 'True'],
    ['multiply', 'Multiply'],
    ['None', 'None'],
    ['False', 'None'],
    [undefined, 'None'],
  ])('reads %j as %j', (value, expected) => {
    expect(parseMultiport(value)).toBe(expected)
  })

  it('copies a per-variable list as written', () => {
    const list = ['sum', 'True']
    expect(parseMultiport(list)).toEqual(list)
    expect(parseMultiport(list)).not.toBe(list)
  })

  it('reads a list whose entries all agree as that one value', () => {
    expect(parseMultiport(['None', false])).toBe('None')
    expect(parseMultiport(['sum', 'SUM'])).toBe('Sum')
  })
})

describe('variableTypes', () => {
  it('applies a whole-port value to every variable', () => {
    expect(variableTypes(port(['a', 'b'], 'Sum'))).toEqual(['Sum', 'Sum'])
    expect(variableTypes(port(['a'], undefined))).toEqual(['None'])
  })

  it('reads a list one entry per variable, ignoring case', () => {
    expect(variableTypes(port(['a', 'b', 'c'], ['sum', 'TRUE', 'Multiply']))).toEqual(['Sum', 'True', 'Multiply'])
  })

  it('reads None beside the other types as True', () => {
    expect(variableTypes(port(['a', 'b', 'c'], ['sum', 'None', false]))).toEqual(['Sum', 'True', 'True'])
  })

  it('rejects a list of the wrong length or with an unknown entry', () => {
    expect(() => variableTypes(port(['a', 'b'], ['sum']))).toThrow(/1 multiport entries for 2 variables/)
    expect(() => variableTypes(port(['a'], ['add']))).toThrow(/unknown multiport "add" for "a"/)
  })
})

describe('multiplyFactor', () => {
  it('reads a whole-port or per-variable factor, 1 when unset', () => {
    expect(multiplyFactor(port(['a', 'b'], 'Multiply', 2), 1)).toBe(2)
    expect(multiplyFactor(port(['a', 'b'], ['multiply', 'multiply'], [2, 3]), 1)).toBe(3)
    expect(multiplyFactor(port(['a'], 'Multiply'), 0)).toBe(1)
  })

  it('rejects a factor that is not a number', () => {
    expect(() => multiplyFactor(port(['a'], 'Multiply', 'x'), 0)).toThrow(/"a" needs a numeric multiply factor/)
  })
})

describe('couplingConflicts', () => {
  it('accepts a sum fed by plain or multiplied variables', () => {
    expect(couplingConflicts(port(['v_sum', 'u'], ['sum', 'True']), port(['v', 'u'], 'None'))).toEqual([])
    expect(couplingConflicts(port(['q'], 'Multiply'), port(['total'], 'Sum'))).toEqual([])
    expect(couplingConflicts(port(['a', 'b'], 'True'), port(['a'], 'None'))).toEqual([])
  })

  it('names the pairs that are both Sum or both Multiply', () => {
    expect(couplingConflicts(port(['x', 'y'], ['sum', 'multiply']), port(['p', 'q'], ['sum', 'multiply']))).toEqual([
      '"x" and "p" are both Sum variables.',
      '"y" and "q" are both Multiply variables.',
    ])
  })

  it('needs as many variables on both sides to sum or multiply', () => {
    expect(couplingConflicts(port(['x', 'y'], ['sum', 'True']), port(['p'], 'None'))).toEqual([
      'Ports "p" and "p" need the same number of variables to sum or multiply.',
    ])
  })

  it('reports a malformed list', () => {
    expect(couplingConflicts(port(['x'], ['sum', 'True']), port(['p'], 'None'))).toEqual([
      'Port "p" has 2 multiport entries for 1 variables.',
    ])
  })
})

it('round-trips a per-variable multi_port through a bundled config', () => {
  const configs = JSON.parse(readFileSync('src/assets/module_configs/BG.json', 'utf8'))
  const config = structuredClone(configs.find((c) => c.module_type === 'Nout_junction' && c.module_subtype === 'pv_simple'))
  config.exit_ports[0].multi_port = ['sum', 'True']

  const module = normaliseConfig(config)
  const exitPort = module.ports.find((p) => p.portType === 'exit_ports')
  expect(variableTypes(exitPort)).toEqual(['Sum', 'True'])
  expect(restorePorts(module.ports).exit_ports[0].multi_port).toEqual(['sum', 'True'])
})
