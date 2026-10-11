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

})
