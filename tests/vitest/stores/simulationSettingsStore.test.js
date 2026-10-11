import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { cloneSimulationSettings, useSimulationSettingsStore } from '../../../src/stores/simulationSettingsStore.js'

const SWEEP = { key: 'a::k', nodeId: 'a', nodeName: 'a', parameterName: 'k', units: 'mM', type: 'constant', from: 1, to: 3, points: 3, readout: 'min' }

describe('simulationSettingsStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('saves and loads a sweep, with its reading', () => {
    const store = useSimulationSettingsStore()
    store.setSimulationSettings({ ...store.simulationSettings, sweep: SWEEP })
    const saved = store.getState()
    expect(saved.simulationSettings.sweep).toEqual(SWEEP)

    const loaded = useSimulationSettingsStore()
    loaded.resetState()
    loaded.loadState(JSON.parse(JSON.stringify(saved)))
    expect(loaded.simulationSettings.sweep).toEqual(SWEEP)
  })

  it('copies a sweep, so a draft of it is its own', () => {
    const copy = cloneSimulationSettings({ sweep: SWEEP })
    expect(copy.sweep).toEqual(SWEEP)
    expect(copy.sweep).not.toBe(SWEEP)
  })
})
