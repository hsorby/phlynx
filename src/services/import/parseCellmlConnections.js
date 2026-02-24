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
 *   public_interface="out"  →  exit_ports  (source)
 *   public_interface="in"   →  entrance_ports  (target)
 *
 * Each <map_variables> entry becomes its own port label.
 * Multiple <connection> blocks between the same component pair are merged into
 * a single edge but each produce their own port label entries.
 */

const EXCLUDED_COMPONENTS = new Set(['environment'])

/**
 * Parse the raw CellML XML string and return structured graph data.
 *
 * @param {string} cellmlContent - Raw XML string
 * @param {string} filename - The filename (used as module_file in configs)
 * @returns {{
 *   components: string[],
 *   edges: Array<{ source: string, target: string, variables: string[] }>,
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

  // --- 1. Build a map of component → variable → public_interface ---
  // { componentName → { variableName → 'in' | 'out' | 'none' } }
  const componentVariableInterfaces = new Map()

  for (const comp of doc.querySelectorAll('component')) {
    const compName = comp.getAttribute('name')
    if (!compName) continue

    const varMap = new Map()
    for (const variable of comp.querySelectorAll('variable')) {
      const varName = variable.getAttribute('name')
      const iface = variable.getAttribute('public_interface') ?? 'none'
      if (varName) varMap.set(varName, iface)
    }
    componentVariableInterfaces.set(compName, varMap)
  }

  // --- 2. Parse all <connection> blocks ---
  // Accumulate per-component port label entries, keyed by component name.
  // { componentName → { entrance_ports: [...], exit_ports: [...] } }
  const componentPortAccumulator = new Map()

  // Track unique edges: key = canonical pair string, value = { source, target }
  // We use the component that has 'out' variables as the source.
  // For pairs where direction is ambiguous we fall back to component_1 → component_2.
  const edgeMap = new Map()

  const ensurePortAccumulator = (name) => {
    if (!componentPortAccumulator.has(name)) {
      componentPortAccumulator.set(name, { entrance_ports: [], exit_ports: [] })
    }
    return componentPortAccumulator.get(name)
  }

  for (const connection of doc.querySelectorAll('connection')) {
    const mapComponents = connection.querySelector('map_components')
    if (!mapComponents) continue

    const comp1 = mapComponents.getAttribute('component_1')
    const comp2 = mapComponents.getAttribute('component_2')
    if (!comp1 || !comp2) continue

    // Skip connections that involve excluded components on either side
    if (EXCLUDED_COMPONENTS.has(comp1) || EXCLUDED_COMPONENTS.has(comp2)) continue

    // Ensure accumulator entries exist for both components
    const acc1 = ensurePortAccumulator(comp1)
    const acc2 = ensurePortAccumulator(comp2)

    // Process each mapped variable pair
    for (const mapVar of connection.querySelectorAll('map_variables')) {
      const var1 = mapVar.getAttribute('variable_1')
      const var2 = mapVar.getAttribute('variable_2')
      if (!var1 || !var2) continue

      // Look up the public_interface for each side
      const iface1 = componentVariableInterfaces.get(comp1)?.get(var1) ?? 'none'
      const iface2 = componentVariableInterfaces.get(comp2)?.get(var2) ?? 'none'

      // Assign to the appropriate port bucket for each component
      if (iface1 === 'out') {
        acc1.exit_ports.push({ port_type: var1, variables: [var1] })
      } else if (iface1 === 'in') {
        acc1.entrance_ports.push({ port_type: var1, variables: [var1] })
      }

      if (iface2 === 'out') {
        acc2.exit_ports.push({ port_type: var2, variables: [var2] })
      } else if (iface2 === 'in') {
        acc2.entrance_ports.push({ port_type: var2, variables: [var2] })
      }
    }

    // Register edge — canonical key ensures one edge per pair regardless of
    // which component is 1 vs 2 across multiple connection blocks.
    const edgeKey = [comp1, comp2].sort().join('|||')
    if (!edgeMap.has(edgeKey)) {
      // Determine source/target: the component with more 'out' variables in this
      // connection is the source. Fall back to comp1 → comp2.
      let outCount1 = 0
      let outCount2 = 0
      for (const mapVar of connection.querySelectorAll('map_variables')) {
        const var1 = mapVar.getAttribute('variable_1')
        const var2 = mapVar.getAttribute('variable_2')
        if (componentVariableInterfaces.get(comp1)?.get(var1) === 'out') outCount1++
        if (componentVariableInterfaces.get(comp2)?.get(var2) === 'out') outCount2++
      }
      const source = outCount1 >= outCount2 ? comp1 : comp2
      const target = source === comp1 ? comp2 : comp1
      edgeMap.set(edgeKey, { source, target })
    }
  }

  // --- 3. Build the component list ---
  const components = [...componentVariableInterfaces.keys()].filter(
    (name) => !EXCLUDED_COMPONENTS.has(name) && componentPortAccumulator.has(name)
  )

  // --- 4. Build configs shaped for builderStore.addConfigFile ---
  // addConfigFile expects an array of config objects, each with:
  //   module_file, module_type, entrance_ports[], exit_ports[]
  // We pass one config per component, with no BC_type/vessel_type
  // (these are CellML components, not vessel-array vessels).
  const configs = components.map((compName) => {
    const { entrance_ports, exit_ports } = componentPortAccumulator.get(compName)
    return {
      module_file: filename,
      module_type: compName,
      entrance_ports,
      exit_ports,
    }
  })

  // --- 5. Build edges list ---
  const edges = [...edgeMap.values()]

  return { components, edges, configs }
}