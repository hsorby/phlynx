import { buildPorts, buildPortLabels } from './buildPorts'
import { getHandleId } from '../../utils/portHandles'
import { SOURCE_PORT_TYPE, TARGET_PORT_TYPE } from '../../utils/constants'
import { extractVariablesFromMath } from '../../utils/cellml'
import { resolvePortCouplings, checkAndClaimCouplings, buildUsedPortKeys } from '../../utils/edges'

function buildNodes(libraryStore, instances, progressCallback = null) {

  return instances.map((instance, index) => {
    if (progressCallback) {
      progressCallback(index, instances.length, instance.name)
    }

    const configData = libraryStore.findConfigByName(instance.module_type, instance.module_subtype)

    if (!configData) {
      console.warn(
        `No config found for module "${instance.name}" ` +
          `(module_type: ${instance.module_type}, module_subtype: ${instance.module_subtype})`
      )
      // Return a placeholder node - SMELL - this is v different from configData structure
      return {
        id: instance.name, // SMELL
        type: 'instanceNode',
        position: { x: 100, y: 100 },
        data: {
          ...instance,
          name: instance.name,
          ports: [],
          label: `${instance.name} (missing config)`,
          portLabels: {},
          error: true,
        },
      }
    }

    const { config, configIndex, module, componentFile } = configData
    const model = libraryStore.getModelByCollectionName(componentFile)

    const componentType = config?.component_type
    const variables = extractVariablesFromMath(model)

    libraryStore.setParameterValuesForInstance(
      instance.name,
      variables,
      componentFile,
      componentType,
      configIndex
    )

    // Check if instance has explicit position
    const hasPosition = instance.x !== undefined && instance.y !== undefined

    if (progressCallback && index === instances.length) {
      progressCallback(instances.length, instances.length, 'Building connections...')
    }

    return {
      id: instance.name,
      type: 'instanceNode',
      // Use instance position if provided, otherwise provide dummy position
      ...(hasPosition
        ? {
            position: { x: instance.x, y: -instance.y },
          }
        : {
            position: { x: 100, y: 100 },
            style: { opacity: 0 }, // Hidden until layout runs
          }),
      data: {
        componentType: componentType,
        configIndex: configIndex,
        label: `${config.component_type} — ${componentFile}`,
        name: instance.name,
        portLabels: buildPortLabels(config),
        variables: variables,
        ports: buildPorts(instance, config),
        hasPrescribedPosition: hasPosition,
        componentFile: componentFile,
      },
    }
  })
}

// maps instance configurations onto vueflow nodes, then builds edges
function buildEdges(instances, visualNodes) {
  const edges = []
  const nodeMap = new Map(visualNodes.map((n) => [n.id, n]))

  // Tracks consumed single-connection port label slots across all edges built so far.
  // Populated via checkAndClaimCouplings; see portCouplings.js for key format.
  const usedPortKeys = new Set()

  // For each target node, track how many times it has been connected to as a
  // target so far — this is its inp_modules ordinal index for the next edge.
  const targetInboundCount = new Map()

  instances.forEach((instance) => {
    if (!instance.out_modules) return

    const sourceNode = nodeMap.get(instance.name)
    if (!sourceNode || sourceNode.data.error) return

    const targets = instance.out_modules.split(' ').filter((t) => t.trim())

    targets.forEach((targetName, sourceIndex) => {
      // sourceIndex = position of this target in the source's out_modules list.
      // Used to select the correct ordinal port slot on the source side.

      const targetNode = nodeMap.get(targetName)
      if (!targetNode || targetNode.data.error) return

      // Each port's name field holds the neighbour module name (set by buildPorts).
      // Find the source handle whose name matches this specific target, and the
      // target handle whose name matches this specific source module.
      const sourcePort = sourceNode.data.ports.find(
        (p) => p.type === SOURCE_PORT_TYPE && p.name === targetName
      )
      const targetPort = targetNode.data.ports.find(
        (p) => p.type === TARGET_PORT_TYPE && p.name === instance.name
      )

      if (!sourcePort || !targetPort) {
        console.warn(
          `[buildEdges] Could not find matching handles between "${instance.name}" and "${targetName}" — skipping.`
        )
        return
      }

      // targetIndex = how many times this target node has already been connected
      // to as a target. Used to select the correct ordinal port slot on the target side.
      const targetIndex = targetInboundCount.get(targetName) ?? 0

      // Resolve the specific port-label couplings for this conduit edge, taking
      // ordinal position into account for repeated same-label slots.
      const couplings = resolvePortCouplings(
        sourceNode.data.portLabels ?? [],
        targetNode.data.portLabels ?? [],
        sourceIndex,
        targetIndex
      )

      if (couplings.length === 0) {
        console.warn(
          `[buildEdges] No compatible port label matches between "${instance.name}" and "${targetName}" — conduit edge skipped.`
        )
        return
      }

      // Enforce the non-multiport single-connection constraint.
      // All-or-nothing: if any coupling violates it, the whole conduit is rejected.
      const { valid, conflicts } = checkAndClaimCouplings(
        instance.name,
        targetName,
        couplings,
        usedPortKeys
      )

      if (!valid) {
        console.warn(
          `[buildEdges] Conduit "${instance.name}" -> "${targetName}" rejected:\n` +
            conflicts.map((c) => `  • ${c}`).join('\n')
        )
        return
      }

      // Increment the target's inbound count only after a successful edge
      targetInboundCount.set(targetName, targetIndex + 1)

      edges.push({
        id: `${instance.name}--${targetName}`,
        source: instance.name,
        target: targetName,
        sourceHandle: getHandleId(sourcePort),
        targetHandle: getHandleId(targetPort),
        data: {
          couplings,
        },
      })
    })
  })

  return edges
}

export function buildWorkflowGraph(libraryStore, instances, progressCallback = null) {
  const nodes = buildNodes(libraryStore, instances, progressCallback)
  const edges = buildEdges(instances, nodes)
  return { nodes, edges }
}