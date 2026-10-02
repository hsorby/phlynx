import { describe, expect, it, vi } from 'vitest'

import { useLoadFromUrl } from '../../../src/composables/useLoadFromUrl.js'
import { initLibCellML } from '../../../src/utils/cellml.js'

const state = vi.hoisted(() => ({
  route: {
    hash: '#encoded-workspace',
    query: { open: 'workspace_json' },
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => state.route,
}))

describe('useLoadFromUrl', () => {
  it('waits for initLibCellML before dispatching the URL handler', async () => {
    const handler = vi.fn()
    const { load, isLoading } = useLoadFromUrl()

    const loadPromise = load({ workspace_json: handler })
    await Promise.resolve()

    expect(isLoading.value).toBe(true)
    expect(handler).not.toHaveBeenCalled()

    initLibCellML({})
    await loadPromise

    expect(handler).toHaveBeenCalledWith('encoded-workspace')
    expect(isLoading.value).toBe(false)
  })
})
