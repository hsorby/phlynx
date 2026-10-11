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

  describe('its curves', () => {
    const SWEEP = { key: 'n1::g', nodeId: 'n1', nodeName: 'channel', parameterName: 'g', units: 'siemens', type: 'constant', from: 1, to: 3, points: 51 }
    const twoParameters = [{ ...nodes[0], data: { ...nodes[0].data, variables: [...nodes[0].data.variables, { name: 'Ko', type: 'constant', units: 'mM', value: '5.4' }] } }]

    /** Mounts the editor on a channel with g and Ko. */
    function mountWithKo(sweep) {
      wrapper = mount(SweepEditor, {
        props: { nodes: twoParameters, sweep, 'onUpdate:sweep': (next) => wrapper.setProps({ sweep: next }) },
        global: { plugins: [PrimeVue] },
      })
    }

    it('adds a curve for each value of another parameter, from its own value, keeping the sweep', async () => {
      mountWithKo({ ...SWEEP, readout: 'min' })
      wrapper.findComponent(Menu).props('model').find((item) => item.label === 'Add a curve for each value of…').command()
      await flushPromises()
      const picker = wrapper.findComponent(VariablePathPicker)
      expect(picker.props('ariaLabel') ?? picker.attributes('aria-label')).toBe('Choose a parameter for the curves')
      expect(picker.props('index').filter((entry) => picker.props('filter')(entry)).map((entry) => entry.path)).toEqual(['channel/Ko'])
      picker.vm.$emit('pick', picker.props('index').find((entry) => entry.path === 'channel/Ko'))
      await flushPromises()

      expect(wrapper.props('sweep')).toMatchObject({ key: 'n1::g', readout: 'min', family: { key: 'n1::Ko', parameterName: 'Ko', values: [5.4] } })
      expect(wrapper.get('[data-testid="sim-sweep-family-values"]').element.value).toBe('5.4')
      expect(wrapper.get('[data-testid="sim-sweep-cost"]').text()).toBe('51 time courses.')
    })

    it('reads the values typed, or says which isn’t a number', async () => {
      mountWithKo({ ...SWEEP, family: { key: 'n1::Ko', nodeId: 'n1', nodeName: 'channel', parameterName: 'Ko', units: 'mM', type: 'constant', values: [5.4] } })
      const input = wrapper.get('[data-testid="sim-sweep-family-values"]')

      await input.setValue('2, 5.4 10')
      await input.trigger('change')
      expect(wrapper.props('sweep').family.values).toEqual([2, 5.4, 10])
      expect(wrapper.get('[data-testid="sim-sweep-cost"]').text()).toBe('51 × 3 = 153 time courses.')

      await input.setValue('2, high')
      await input.trigger('change')
      expect(wrapper.props('sweep').family.values).toEqual([2, 5.4, 10])
      expect(wrapper.get('[role="alert"]').text()).toBe('high isn’t a number.')

      // A change elsewhere, saved as a copy of the sweep, keeps what was typed, and why it can't be read.
      const sweep = wrapper.props('sweep')
      await wrapper.setProps({ sweep: { ...sweep, points: 11, family: { ...sweep.family, values: [...sweep.family.values] } } })
      expect(input.element.value).toBe('2, high')
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    })

    it('draws one curve again from the curves’ menu', async () => {
      mountWithKo({ ...SWEEP, family: { key: 'n1::Ko', nodeId: 'n1', nodeName: 'channel', parameterName: 'Ko', units: 'mM', type: 'constant', values: [5.4] } })
      wrapper.findAllComponents(Menu)[1].props('model').find((item) => item.label === 'Draw one curve').command()
      await flushPromises()
      expect(wrapper.props('sweep')).not.toHaveProperty('family')
      expect(wrapper.find('[data-testid="sim-sweep-family"]').exists()).toBe(false)
    })
  })
})
