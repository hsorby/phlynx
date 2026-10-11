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
    wrapper.unmount()
  })
})
