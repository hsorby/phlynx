import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useWorkspaceSearch } from '../../../src/composables/useWorkspaceSearch.js'

/** Builds an instance node. */
const makeNode = (id, data = {}) => ({ id, position: { x: 0, y: 0 }, data: { name: id, ...data } })

/** Builds the search over a fresh set of nodes. */
function setup(initial) {
  const nodes = ref(initial)
  const zoomToNode = vi.fn()
  const findNode = (id) => nodes.value.find((node) => node.id === id)
  const search = useWorkspaceSearch({ nodes, findNode, zoomToNode })
  /** Types a query, as the input does. */
  const type = (text) => {
    search.searchQuery.value = text
    search.runSearch()
  }
  return { nodes, zoomToNode, search, type }
}

describe('useWorkspaceSearch', () => {
  it('matches name, module and maths file case-insensitively, in workspace order', () => {
    const { search, type } = setup([
      makeNode('heart', { moduleRef: 'Pump' }),
      makeNode('Na_channel'),
      makeNode('vessel', { mathRef: 'na_maths.cellml' }),
      makeNode('other'),
    ])
    type('NA')
    expect(search.matchingNodesList.value.map((node) => node.id)).toEqual(['Na_channel', 'vessel'])
    expect(search.matchCount.value).toBe(2)
    type('pump')
    expect([...search.matchingNodeIds.value]).toEqual(['heart'])
  })

  it('ignores spaces around the query', () => {
    const { search, type } = setup([makeNode('heart')])
    type('  heart ')
    expect(search.matchCount.value).toBe(1)
  })

  it('is inactive for a blank query: no count, nothing dimmed', () => {
    const { search, type } = setup([makeNode('heart')])
    type('   ')
    expect(search.isActive.value).toBe(false)
    expect(search.matchCount.value).toBeNull()
    expect(search.getNodeClass({ id: 'heart' })).toBe('')
  })

  it('highlights matches and dims the rest', () => {
    const { search, type } = setup([makeNode('heart'), makeNode('lung')])
    type('heart')
    expect(search.getNodeClass({ id: 'heart' })).toBe('node-search-match')
    expect(search.getNodeClass({ id: 'lung' })).toBe('node-search-dimmed')
  })

  it('steps through matches both ways, wrapping round, and zooms to each', () => {
    const { search, zoomToNode, type } = setup([makeNode('a1'), makeNode('a2'), makeNode('a3')])
    type('a')
    search.cycleToNextMatch()
    search.cycleToNextMatch()
    search.cycleToNextMatch()
    expect(zoomToNode.mock.calls.map(([id]) => id)).toEqual(['a2', 'a3', 'a1'])
    search.cycleToPreviousMatch()
    expect(zoomToNode).toHaveBeenLastCalledWith('a3')
    expect(search.currentMatchIndex.value).toBe(2)
  })

  it('zooms to a single match again rather than stepping past it', () => {
    const { search, zoomToNode, type } = setup([makeNode('heart'), makeNode('lung')])
    type('heart')
    search.cycleToNextMatch()
    search.cycleToNextMatch()
    search.cycleToPreviousMatch()
    expect(zoomToNode.mock.calls).toEqual([['heart'], ['heart']])
  })

  it('clears the query and its matches', () => {
    const { search, type } = setup([makeNode('heart')])
    type('heart')
    search.clearSearch()
    expect(search.searchQuery.value).toBe('')
    expect(search.matchingNodesList.value).toEqual([])
  })

  it('re-runs when a node is renamed, keeping the current match', async () => {
    const { nodes, search, type } = setup([makeNode('a1'), makeNode('a2'), makeNode('b')])
    type('a')
    search.selectMatch(1)
    nodes.value[2].data.name = 'a3'
    await nextTick()
    expect(search.matchingNodesList.value.map((node) => node.id)).toEqual(['a1', 'a2', 'b'])
    expect(search.currentMatchIndex.value).toBe(1)
  })

  it('goes back to the first match when the current one stops matching', async () => {
    const { nodes, search, type } = setup([makeNode('a1'), makeNode('a2')])
    type('a')
    search.selectMatch(1)
    nodes.value[1].data.name = 'z'
    await nextTick()
    expect(search.matchCount.value).toBe(1)
    expect(search.currentMatchIndex.value).toBe(0)
  })

  it('does not re-run when a node only moves', async () => {
    const { nodes, search, type } = setup([makeNode('a1')])
    type('a')
    await nextTick()
    const before = search.matchingNodeIds.value
    nodes.value[0].position.x = 50
    await nextTick()
    expect(search.matchingNodeIds.value).toBe(before)
  })
})
