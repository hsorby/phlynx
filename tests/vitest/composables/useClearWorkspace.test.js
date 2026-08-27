import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@vue-flow/core', async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    useVueFlow: () => ({
      nodes: ref([]),
      edges: ref([]),
      setViewport: vi.fn(),
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    }),
  }
})

import { useClearWorkspace } from '../../../src/composables/useClearWorkspace.js'
import { useLibraryStore } from '../../../src/stores/libraryStore.js'

describe('useClearWorkspace', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('fully clears the library state, not just the global constants', async () => {
    const libraryStore = useLibraryStore()
    libraryStore.addMath('math:1', 'x = 1')
    libraryStore.addModule({
      moduleRef: 'module-1',
      mathRef: 'math:1',
      componentFile: 'component-1',
      name: 'Demo model',
    })
    libraryStore.assignGlobalConstant('gNa', 1, 'nS', 'data-ref-1')

    const { clearWorkspace } = useClearWorkspace()
    await clearWorkspace()

    const state = libraryStore.getState()
    expect(state.availableMath).toEqual([['math:1', 'x = 1']])
    expect(state.availableModules).toEqual([['module-1', {mathRef: 'math:1', componentFile: 'component-1', name: 'Demo model', moduleRef: 'module-1'}]])
    expect(state.globalConstants).toEqual([])
  })
})
