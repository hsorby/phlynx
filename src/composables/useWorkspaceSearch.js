/**
 * The workspace search: finds instances by name, module or maths file, highlights them and steps through them.
 */
import { computed, ref, watch } from 'vue'

/**
 * Finds the nodes whose name, module or maths file contains the query, in workspace order.
 *
 * @param {Array<Object>} nodes
 * @param {string} query - Already trimmed and lowercased.
 * @returns {string[]} Node ids.
 */
function findNameMatches(nodes, query) {
  return nodes
    .filter((node) =>
      [node.data?.moduleRef, node.data?.name, node.data?.mathRef].some((field) => field?.toLowerCase().includes(query))
    )
    .map((node) => node.id)
}

/**
 * Builds the search state for a workspace.
 *
 * @param {Object} options
 * @param {import('vue').Ref<Array<Object>>} options.nodes - The workspace's nodes.
 * @param {Function} options.findNode - Gets a node by id.
 * @param {Function} options.zoomToNode - Centres the view on a node by id.
 * @returns {Object} The query, its matches, and the actions the search bar binds to.
 */
export function useWorkspaceSearch({ nodes, findNode, zoomToNode }) {
  const searchQuery = ref('')
  const matchIds = ref([])
  const currentMatchIndex = ref(0)

  const trimmedQuery = computed(() => searchQuery.value.trim().toLowerCase())
  const isActive = computed(() => trimmedQuery.value !== '')
  const matchingNodeIds = computed(() => new Set(matchIds.value))
  const matchCount = computed(() => (isActive.value ? matchIds.value.length : null))
  const matchingNodesList = computed(() => matchIds.value.map((id) => findNode(id)).filter(Boolean))

  /**
   * Re-runs the search, optionally keeping the current match if it still matches.
   *
   * @param {Object} [options]
   * @param {boolean} [options.keepCurrent=false]
   */
  const runSearch = ({ keepCurrent = false } = {}) => {
    const currentId = matchIds.value[currentMatchIndex.value]
    matchIds.value = isActive.value ? findNameMatches(nodes.value, trimmedQuery.value) : []
    const keptIndex = keepCurrent ? matchIds.value.indexOf(currentId) : -1
    currentMatchIndex.value = Math.max(keptIndex, 0)
  }

  const clearSearch = () => {
    searchQuery.value = ''
    runSearch()
  }

  /**
   * Makes a match current and zooms to it.
   *
   * @param {number} index
   */
  const selectMatch = (index) => {
    if (index < 0 || index >= matchIds.value.length) return
    currentMatchIndex.value = index
    zoomToNode(matchIds.value[index])
  }

  const cycleToNextMatch = () => {
    const count = matchIds.value.length
    if (count === 0) return
    // A single match is zoomed to again rather than stepped past.
    selectMatch(count === 1 ? 0 : (currentMatchIndex.value + 1) % count)
  }

  const cycleToPreviousMatch = () => {
    const count = matchIds.value.length
    if (count <= 1) return
    selectMatch((currentMatchIndex.value - 1 + count) % count)
  }

  /**
   * Gets the class that highlights or dims a node while a search is active.
   *
   * @param {{id: string}} props - The node's slot props.
   * @returns {string}
   */
  const getNodeClass = (props) => {
    if (!isActive.value) return ''
    return matchingNodeIds.value.has(props.id) ? 'node-search-match' : 'node-search-dimmed'
  }

  // Track only the fields the search reads; a deep watch walked every node on each drag frame and selection change.
  watch(
    () =>
      isActive.value
        ? nodes.value.map((n) => `${n.id}|${n.data?.name}|${n.data?.moduleRef}|${n.data?.mathRef}`).join('\n')
        : '',
    () => {
      if (isActive.value) runSearch({ keepCurrent: true })
    }
  )

  return {
    searchQuery,
    isActive,
    matchCount,
    matchingNodeIds,
    matchingNodesList,
    currentMatchIndex,
    runSearch,
    clearSearch,
    selectMatch,
    cycleToNextMatch,
    cycleToPreviousMatch,
    getNodeClass,
  }
}
