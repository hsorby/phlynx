// @vitest-environment happy-dom
import { computed, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFlowHistoryStore } from '../../../src/stores/historyStore.js'

const nodes = ref([])

vi.mock('@vue-flow/core', async (importOriginal) => ({
  ...(await importOriginal()),
  useVueFlow: () => ({
    nodes,
    edges: ref([]),
    getSelectedNodes: computed(() => nodes.value),
    userSelectionActive: ref(false),
    findNode: (id) => nodes.value.find((node) => node.id === id),
    findEdge: () => undefined,
    updateNodeData: (id, patch) => {
      const node = nodes.value.find((candidate) => candidate.id === id)
      if (node) node.data = { ...node.data, ...patch }
    },
  }),
}))

const { default: ContextSidebar } = await import('../../../src/components/ContextSidebar.vue')

let wrapper
afterEach(() => wrapper?.unmount())

/** Waits for the sidebar's deferred row rebuild, which lands after the next paint. */
async function waitForRows() {
  await flushPromises()
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
  await flushPromises()
}

describe('ContextSidebar instance parameters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    nodes.value = [
      reactive({
        id: 'a',
        data: {
          name: 'a',
          variables: [
            { name: 'k', value: '1', type: 'constant' },
            { name: 'm', value: '5', type: 'constant' },
          ],
        },
      }),
    ]
  })

  it('shows undone values, so the next edit doesn’t write the old ones back', async () => {
    wrapper = mount(ContextSidebar, { global: { plugins: [PrimeVue], stubs: { DataTable: { render: () => null } }, directives: { tooltip: {} } } })
    wrapper.vm.isCollapsed = false
    wrapper.vm.activeTabId = 'params'
    await waitForRows()

    wrapper.vm.parameterRows.find((row) => row.name === 'k').value = '2'
    wrapper.vm.handleParameterValueChange()
    await flushPromises()
    expect(nodes.value[0].data.variables[0].value).toBe('2')

    await useFlowHistoryStore().undo()
    await flushPromises()
    expect(wrapper.vm.parameterRows.find((row) => row.name === 'k').value).toBe('1')

    wrapper.vm.parameterRows.find((row) => row.name === 'm').value = '6'
    wrapper.vm.handleParameterValueChange()
    await flushPromises()
    expect(nodes.value[0].data.variables.map((row) => row.value)).toEqual(['1', '6'])
  })
})
