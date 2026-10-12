// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it } from 'vitest'

import SimulationToolbar from '../../../src/components/simulation/SimulationToolbar.vue'
import { useProtocolStore } from '../../../src/stores/protocolStore.js'
import { useSimulationResultsStore } from '../../../src/stores/simulationResultsStore.js'
import { useSimulationSettingsStore } from '../../../src/stores/simulationSettingsStore.js'

const SWEEP = { key: 'a::k', nodeId: 'a', nodeName: 'a', parameterName: 'k', type: 'constant', from: 1, to: 3, points: 3 }

/**
 * Mounts the toolbar.
 *
 * @returns {import('@vue/test-utils').VueWrapper}
 */
const mountToolbar = () => mount(SimulationToolbar, { global: { plugins: [PrimeVue], directives: { tooltip: {} } } })

describe('SimulationToolbar sweep mode', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('offers sweep mode only once a sweep is set', async () => {
    const wrapper = mountToolbar()
    expect(wrapper.find('[data-testid="sim-sweep-mode"]').exists()).toBe(false)

    const settingsStore = useSimulationSettingsStore()
    settingsStore.setSimulationSettings({ ...settingsStore.simulationSettings, sweep: SWEEP })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="sim-sweep-mode"]').attributes('aria-pressed')).toBe('false')
    wrapper.unmount()
  })

  it('switches to the sweep, turning the protocol off, and plays', async () => {
    const settingsStore = useSimulationSettingsStore()
    settingsStore.setSimulationSettings({ ...settingsStore.simulationSettings, sweep: SWEEP })
    const protocolStore = useProtocolStore()
    protocolStore.isProtocolMode = true
    const resultsStore = useSimulationResultsStore()
    const wrapper = mountToolbar()

    await wrapper.find('[data-testid="sim-sweep-mode"]').trigger('click')

    expect(resultsStore.isSweepMode).toBe(true)
    expect(protocolStore.isProtocolMode).toBe(false)
    expect(wrapper.emitted('play')).toHaveLength(1)
    expect(wrapper.find('[data-testid="sim-sweep-mode"]').attributes('aria-pressed')).toBe('true')

    // Removing the sweep, from whichever view, turns sweep mode off.
    settingsStore.setSimulationSettings({ ...settingsStore.simulationSettings, sweep: null })
    await wrapper.vm.$nextTick()
    expect(resultsStore.isSweepMode).toBe(false)
    wrapper.unmount()
  })
})

describe('SimulationToolbar track run', () => {
  beforeEach(() => setActivePinia(createPinia()))

  const findTrack = (wrapper) => wrapper.find('button[aria-label="Track this run"]')

  it('sits beside the float button, and is disabled until a run can be tracked', () => {
    const wrapper = mountToolbar()
    const labels = wrapper.findAll('button').map((button) => button.attributes('aria-label'))
    expect(labels.indexOf('Float the results over the canvas')).toBe(labels.indexOf('Track this run') + 1)
    expect(findTrack(wrapper).attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('tracks the shown run', async () => {
    const store = useSimulationResultsStore()
    store.startRun(null)
    store.finishRun({
      results: { voi: { name: 'm/t', unit: 'second', values: new Float64Array([0, 1]) }, variables: new Map(), isStopped: false },
      mapping: new Map(),
      signature: 's',
      inspectionOutputs: [],
      inputs: { settings: {}, overrides: null },
    })
    const wrapper = mountToolbar()

    await findTrack(wrapper).trigger('click')
    expect(store.trackedRuns.map((run) => run.number)).toEqual([1])
    wrapper.unmount()
  })
})
