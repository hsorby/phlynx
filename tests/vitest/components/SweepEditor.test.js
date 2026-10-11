// @vitest-environment happy-dom
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Menu from 'primevue/menu'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'


vi.mock('@vue-flow/core', async (importOriginal) => ({
  ...(await importOriginal()),
  useVueFlow: () => ({ edges: ref([]) }),
}))

const { default: SweepEditor } = await import('../../../src/components/simulation/SweepEditor.vue')
const { useSimulationResultsStore } = await import('../../../src/stores/simulationResultsStore.js')
const { useSimulationSettingsStore } = await import('../../../src/stores/simulationSettingsStore.js')
const { default: VariablePathPicker } = await import('../../../src/components/simulation/VariablePathPicker.vue')

const nodes = [
  {
    id: 'n1',
    data: {
      name: 'channel',
      variables: [
        { name: 'g', type: 'constant', units: 'siemens', value: '2' },
        { name: 'I', type: 'variable', units: 'ampere' },
      ],
    },
  },
]

let wrapper
beforeEach(() => setActivePinia(createPinia()))
afterEach(() => wrapper?.unmount())

/**
 * Mounts the editor, keeping its sweep in step with what it emits.
 *
 * @param {Object|null} sweep
 */
function mountEditor(sweep = null) {
  wrapper = mount(SweepEditor, {
    props: { nodes, sweep, 'onUpdate:sweep': (next) => wrapper.setProps({ sweep: next }) },
    global: { plugins: [PrimeVue] },
  })
}

const addButton = () => wrapper.findAll('button').find((button) => button.text() === 'Sweep a parameter')

describe('SweepEditor', () => {
  it('adds a sweep from the + button, then hides it', async () => {
    mountEditor()
    expect(wrapper.findComponent(VariablePathPicker).exists()).toBe(false)

    await addButton().trigger('click')
    const picker = wrapper.findComponent(VariablePathPicker)
    // Only the parameter is offered, not what the model computes.
    const offered = picker.props('index').filter(picker.props('filter')).map((entry) => entry.path)
    expect(offered).toEqual(['channel/g'])

    picker.vm.$emit('pick', picker.props('index').find((entry) => entry.path === 'channel/g'))
    await flushPromises()
    expect(wrapper.props('sweep')).toMatchObject({ key: 'n1::g', parameterName: 'g', from: 1, to: 3 })
    expect(wrapper.findComponent(VariablePathPicker).exists()).toBe(false)
    expect(addButton()).toBeUndefined()
  })

  it('stops sweeping from its menu', async () => {
    mountEditor({ key: 'n1::g', nodeId: 'n1', nodeName: 'channel', parameterName: 'g', units: 'siemens', type: 'constant', from: 1, to: 3, points: 51 })
    expect(wrapper.find('[data-testid="sim-sweep-parameter"]').exists()).toBe(true)

    wrapper.findComponent(Menu).props('model').find((item) => item.label === 'Stop sweeping').command()
    await flushPromises()
    expect(wrapper.props('sweep')).toBeNull()
    expect(addButton()).toBeDefined()
  })

  describe('its reading', () => {
    const SWEEP = { key: 'n1::g', nodeId: 'n1', nodeName: 'channel', parameterName: 'g', units: 'siemens', type: 'constant', from: 1, to: 3, points: 51 }

    /**
     * Finishes a run, as the sweep's cost and notes go by the last run's.
     *
     * @param {Object} results
     */
    const finish = (results) =>
      useSimulationResultsStore().finishRun({ results: { variables: new Map(), voi: { values: new Float64Array(1) }, ...results }, mapping: new Map(), signature: 's', inspectionOutputs: [], inputs: {} })

    it('reads each time course’s end unless another reading is chosen', async () => {
      mountEditor(SWEEP)
      const readout = wrapper.get('[data-testid="sim-sweep-readout"]')
      expect(readout.find('[aria-pressed="true"]').text()).toBe('End')

      await readout.findAll('button').find((button) => button.text() === 'Min').trigger('click')
      expect(wrapper.props('sweep')).toMatchObject({ readout: 'min' })
    })

    it('says how many time courses it runs, and about how long, going by the last run', async () => {
      mountEditor(SWEEP)
      expect(wrapper.get('[data-testid="sim-sweep-cost"]').text()).toBe('51 time courses.')

      finish({ elapsedMs: 2000, isSteadyState: false })
      await flushPromises()
      expect(wrapper.get('[data-testid="sim-sweep-cost"]').text()).toBe('51 time courses, about 2 min.')

      finish({ elapsedMs: 4, isSteadyState: true })
      await flushPromises()
      expect(wrapper.get('[data-testid="sim-sweep-cost"]').text()).toBe('51 solves, under a second.')
    })

    it('warns of a long sweep, and of a peak a time course settling before the plots start can’t read', async () => {
      mountEditor({ ...SWEEP, points: 201, readout: 'min' })
      expect(wrapper.find('[data-testid="sim-sweep-long"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="sim-sweep-transient"]').exists()).toBe(false)

      const settingsStore = useSimulationSettingsStore()
      settingsStore.setSimulationSettings({ ...settingsStore.simulationSettings, initialPoint: 0, startingPoint: 1, endingPoint: 2 })
      await flushPromises()
      expect(wrapper.get('[data-testid="sim-sweep-transient"]').text()).toMatch(/a min in the first moments/)

      await wrapper.setProps({ sweep: { ...SWEEP, readout: 'end' } })
      expect(wrapper.find('[data-testid="sim-sweep-transient"]').exists()).toBe(false)
    })
  })
})
