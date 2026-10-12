// @vitest-environment happy-dom
import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const nodes = ref([])
const selected = ref([])
vi.mock('@vue-flow/core', async (importOriginal) => {
  const { computed } = await import('vue')
  return {
    ...(await importOriginal()),
    useVueFlow: () => ({ nodes, getSelectedNodes: computed(() => selected.value.map((id) => ({ id }))) }),
  }
})
const run = vi.hoisted(() => vi.fn())
vi.mock('../../../src/composables/useSimulation', async () => {
  const { ref } = await import('vue')
  return { useSimulation: () => ({ run, stop: vi.fn(), keepCurrent: vi.fn(), isStale: ref(false) }) }
})
vi.mock('../../../src/services/simulation/libopencorLoader', () => ({ libopencor: { status: 'ready' } }))

const { useSimulationRunner } = await import('../../../src/composables/useSimulationRunner.js')

/**
 * Runs the composable in a component.
 *
 * @param {Object} [options]
 * @returns {Object} What it returned.
 */
function setUpRunner(options) {
  let runner
  mount(
    defineComponent({
      setup() {
        runner = useSimulationRunner(options)
        return () => null
      },
    })
  )
  return runner
}

describe('useSimulationRunner', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    run.mockClear()
    nodes.value = [{ id: 'b' }, { id: 'a' }]
    selected.value = []
  })

  it('says why play can’t run the selection until there is one, then runs it sorted', () => {
    const runner = setUpRunner()
    runner.store.scopeMode = 'selection'
    expect(runner.blockedReason.value).toBe('Select instances on the canvas')
    selected.value = ['b', 'a']
    expect(runner.canPlay.value).toBe(true)
    runner.play()
    expect(run).toHaveBeenCalledWith(['a', 'b'])
  })

  it('runs the whole model at once when switched to it', () => {
    const runner = setUpRunner()
    runner.store.scopeMode = 'selection'
    runner.scopeMode.value = 'model'
    expect(run).toHaveBeenCalledWith(null)
  })

  it('runs an instance editor’s instance on its own', () => {
    const runner = setUpRunner({ instanceId: 'b' })
    expect(runner.blockedReason.value).toBeNull()
    runner.play()
    expect(run).toHaveBeenCalledWith(['b'])
  })
})
