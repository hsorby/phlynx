/**
 * parseCellMLConnections.js
 *
 * Parses a CellML 1.x/2.x file and extracts:
 *   - The set of component names (excluding 'environment')
 *   - The connections between components as edges
 *   - Per-component port configs ready for builderStore.addConfigFile
 *
 * Port directionality is inferred from the public_interface attribute on each
 * component's variable declarations:
 *   public_interface="out"  ->  exit_ports  (source)
 *   public_interface="in"   ->  entrance_ports  (target)
 *
 *
 * Variables that serve as the environment's time signal (e.g., 'time', 't') are
 * excluded from port labels — their name is detected dynamically from the
 * environment component's variable declarations.
 * 
 */

import { EXCLUDED_COMPONENTS, TIME_NAMES, TIME_UNITS } from "../../utils/constants"

/**
 * Parse the raw CellML XML string and return structured graph data.
 *
 * @param {string} cellmlContent - Raw XML string
 * @param {string} filename - The filename (used as module_file in configs)
 * @returns {{
 *   components: string[],
 *   edges: Array<{ source: string, target: string }>,
 *   configs: Array<object>   // shaped for builderStore.addConfigFile
 * }}
 */
export function parseCellMLConnections(cellmlContent, filename) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(cellmlContent, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`Failed to parse CellML XML: ${parseError.textContent}`)
  }

  // --- 1. Detect the time variable name from the environment component ---
  const excludedVarNames = new Set()
  for (const comp of doc.querySelectorAll('component')) {
    if (comp.getAttribute('name') === 'environment') {
      for (const variable of comp.querySelectorAll('variable')) {
        const varName = variable.getAttribute('name')
        const varUnits = variable.getAttribute('units') ?? ''
        if (varName && (TIME_NAMES.has(varName) || TIME_UNITS.has(varUnits))) {
          excludedVarNames.add(varName)
        }
      }
      break
    }
  }

  // --- 2. Build a map of component -> variable -> { iface, units } ---
  // { componentName -> { variableName -> { iface: 'in'|'out'|'none', units: string } } }
  const componentVariableInfo = new Map()

  for (const comp of doc.querySelectorAll('component')) {
    const compName = comp.getAttribute('name')
    if (!compName) continue

    const varMap = new Map()
    for (const variable of comp.querySelectorAll('variable')) {
      const varName = variable.getAttribute('name')
      if (!varName) continue
      varMap.set(varName, {
        iface: variable.getAttribute('public_interface') ?? 'none',
        units: variable.getAttribute('units') ?? 'dimensionless',
      })
    }
    componentVariableInfo.set(compName, varMap)
  }

  // --- 3. Parse all <connection> blocks ---
  //
  // For each non-excluded component pair we accumulate:
  //   - One edge (source -> target)
  //   - One port label entry per <map_variables> line (one per variable)
  //
  // Data structures:
  //   edgeMap    : canonical pair key -> { source, target }
  //   portLabels : componentName -> { entrance_ports, exit_ports } (one entry per variable)

  const edgeMap = new Map()
  // portLabels: compName -> { entrance_ports: [...], exit_ports: [...] }
  // One entry per <map_variables> line, each variable gets its own port label.
  const portLabels = new Map()

  const ensurePortLabels = (compName) => {
    if (!portLabels.has(compName)) portLabels.set(compName, { entrance_ports: [], exit_ports: [] })
    return portLabels.get(compName)
  }

  // edgePeers: used only to count out-vars per pair for edge direction + port handle naming
  // compName -> Set of peer names (for port handle construction in useLoadFromCellML)
  const edgePeers = new Map()

  for (const connection of doc.querySelectorAll('connection')) {
    const mapComponents = connection.querySelector('map_components')
    if (!mapComponents) continue

    const comp1 = mapComponents.getAttribute('component_1')
    const comp2 = mapComponents.getAttribute('component_2')
    if (!comp1 || !comp2) continue

    // Skip connections involving excluded components on either side
    if (EXCLUDED_COMPONENTS.has(comp1) || EXCLUDED_COMPONENTS.has(comp2)) continue

    const labels1 = ensurePortLabels(comp1)
    const labels2 = ensurePortLabels(comp2)

    let outCount1 = 0
    let outCount2 = 0

    for (const mapVar of connection.querySelectorAll('map_variables')) {
      const var1 = mapVar.getAttribute('variable_1')
      const var2 = mapVar.getAttribute('variable_2')
      if (!var1 || !var2) continue

      // Skip time-like variables
      if (excludedVarNames.has(var1) || excludedVarNames.has(var2)) continue

      const info1 = componentVariableInfo.get(comp1)?.get(var1)
      const info2 = componentVariableInfo.get(comp2)?.get(var2)
      const iface1 = info1?.iface ?? 'none'
      const iface2 = info2?.iface ?? 'none'

      // Each variable gets its own port label entry
      if (iface1 === 'out') {
        labels1.exit_ports.push({ port_type: var1, variables: [var1] })
        outCount1++
      } else if (iface1 === 'in') {
        labels1.entrance_ports.push({ port_type: var1, variables: [var1] })
      }

      if (iface2 === 'out') {
        labels2.exit_ports.push({ port_type: var2, variables: [var2] })
        outCount2++
      } else if (iface2 === 'in') {
        labels2.entrance_ports.push({ port_type: var2, variables: [var2] })
      }
    }

    // Register one edge per unique component pair
    const edgeKey = [comp1, comp2].sort().join('|||')
    if (!edgeMap.has(edgeKey)) {
      const source = outCount1 >= outCount2 ? comp1 : comp2
      const target = source === comp1 ? comp2 : comp1
      edgeMap.set(edgeKey, { source, target })
      // Track peers for port handle construction
      if (!edgePeers.has(source)) edgePeers.set(source, new Set())
      edgePeers.get(source).add(target)
      if (!edgePeers.has(target)) edgePeers.set(target, new Set())
      edgePeers.get(target).add(source)
    }
  }

  // --- 4. Build the component list ---
  // Only include components that participate in at least one non-time connection
  const components = [...componentVariableInfo.keys()].filter(
    (name) => !EXCLUDED_COMPONENTS.has(name) && portLabels.has(name)
  )

  // --- 5. Build configs shaped for builderStore.addConfigFile ---
  // One port label entry per peer
  const configs = components.map((compName) => {
    const { entrance_ports, exit_ports } = portLabels.get(compName) ?? { entrance_ports: [], exit_ports: [] }

    // Build variables_and_units from all public variables on this component
    const variables_and_units = []
    for (const [varName, { iface, units }] of componentVariableInfo.get(compName)) {
      if (iface === 'none') continue
      variables_and_units.push([varName, units, 'access', 'variable'])
    }

    return {
      module_file: filename,
      module_type: compName,
      vessel_type: compName,
      BC_type: 'nn',
      entrance_ports,
      exit_ports,
      variables_and_units,
    }
  })

  // --- 6. Build edges list ---
  const edges = [...edgeMap.values()]

  return { components, edges, configs }
}