import { useVueFlow } from '@vue-flow/core'
import { useLibraryStore } from '../stores/libraryStore'
import { notify } from '../utils/notify'
import { useGtm } from './useGtm'
import { useClearWorkspace } from '../utils/workspace' 
import { buildWorkflowGraph } from '../services/import/buildWorkflow'
import { useWorkflowLayout } from './useWorkflowLayout'

export function useLoadFromCellML() {
  const { nodes: currentNodes, addNodes } = useVueFlow()
  const store = useLibraryStore()
  const { trackEvent } = useGtm()
  const { clearWorkspace } = useClearWorkspace()
  const { prepareLayout } = useWorkflowLayout()

  const loadFromCellML = async (cellmlPayload, componentFile, progressCallback = null) => {
    try {
      await clearWorkspace()

      if (progressCallback) progressCallback(0, 100, 'Building CellML graph...')

      // We extract components, modules, and edges directly from our updated parser
      const { components = [], modules = [], edges = [] } = cellmlPayload || {}

      if (components.length === 0) {
        notify.info({
          title: 'No Connections Found',
          message: `${componentFile} contains no inter-component connections.`,
        })
        return
      }

      // 1. Register our perfectly normalized modules into the library store!
      // This bypasses the need for the old nested-array configs entirely.
      modules.forEach(mod => {
        store.addModule(mod) 
      })

      // 2. Convert to instanceRefs so buildWorkflowGraph can generate handles correctly
      const instanceRefs = components.map((compName) => {
        const outInstances = edges
          .filter((e) => e.source === compName)
          .map((e) => e.target)
          .join(' ')

        const inInstances = edges
          .filter((e) => e.target === compName)
          .map((e) => e.source)
          .join(' ')

        return {
          name: compName,
          module_type: compName, 
          module_subtype: 'cellml_import',
          out_instances: outInstances,
          inp_instances: inInstances,
        }
      })

      // 3. Let buildWorkflowGraph do its magic (handles, opacity: 0, couplings, etc.)
      const result = buildWorkflowGraph(
        instanceRefs, 
        store.availableModules, 
        currentNodes.value, 
        progressCallback
      )

      // 4. Layout and render
      const layoutPromise = prepareLayout(result.pendingEdges, progressCallback)
      addNodes(result.pendingInstances)
      
      await layoutPromise

      trackEvent('cellml_connection_load', {
        category: 'CellML',
        action: 'load_from_cellml_connections',
        label: `Components: ${components.length}, Edges: ${edges.length}`,
        file_type: 'cellml',
      })
    } catch (error) {
      notify.error({ message: `Failed to load CellML connections: ${error.message}` })
      throw error
    }
  }

  return { loadFromCellML }
}