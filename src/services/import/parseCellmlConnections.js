/**
 * parseCellMLConnections.js
 *
 * Parses a CellML 1.x/2.x file and extracts:
 *   - The set of component names (excluding 'environment' and other excluded components)
 *   - The connections between components as edges
 *   - Per-component port configs ready for builderStore.addConfigFile
 *
 * Port directionality is NOT used. All ports are general_ports.
 * The canonical port label for a connection is the variable name from whichever
 * component defines the variable (i.e. it appears as the LHS of an equation in
 * that component's math). Falls back to alphabetically first variable name if
 * no math definition is found.
 *
 * Variables that serve as the environment's time signal are excluded throughout.
 */

import { EXCLUDED_COMPONENTS, TIME_NAMES, TIME_UNITS } from '../../utils/constants'

function getOwnedVariables(compElement) {
  const owned = new Set()

  for (const mathEl of compElement.querySelectorAll('math')) {
    // Only consider direct children of <math> — top-level statements
    for (const apply of mathEl.children) {
      if (apply.tagName !== 'apply') continue
      const children = Array.from(apply.children)
      if (children[0]?.tagName !== 'eq') continue

      const lhs = children[1]
      if (lhs?.tagName === 'ci') {
        owned.add(lhs.textContent.trim())
      } else if (lhs?.tagName === 'apply') {
        // ODE: <apply><diff/>...</apply>
        const diffCi = lhs.querySelector('ci')
        if (diffCi) owned.add(diffCi.textContent.trim())
      }
    }
  }

  // Initial values — constants defined in this component
  for (const variable of compElement.querySelectorAll('variable')) {
    if (variable.getAttribute('initial_value') !== null) {
      const varName = variable.getAttribute('name')
      if (varName) owned.add(varName)
    }
  }

  return owned
}

/**
 * Parse the raw CellML XML string and return structured graph data.
 *
 * @param {string} cellmlContent - Raw XML string
 * @param {string} filename - The filename (used as module_file in configs)
 * @returns {{
 *   components: string[],
 *   edges: Array<{ source: string, target: string }>,
 *   configs: Array<object>
 * }}
 */
export function parseCellMLConnections(cellmlContent, filename) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(cellmlContent, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`Failed to parse CellML XML: ${parseError.textContent}`)
  }

  // --- 1. Detect time variable names from the environment component ---
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

  // --- 2. Build component info map and defined-variable sets ---
  // componentVariableInfo: compName -> Map<varName, { units }>
  // componentDefinedVars:  compName -> Set<varName>  (LHS of equations)
  const componentVariableInfo = new Map()
  const componentDefinedVars = new Map()

  for (const comp of doc.querySelectorAll('component')) {
    const compName = comp.getAttribute('name')
    if (!compName) continue

    const varMap = new Map()
    for (const variable of comp.querySelectorAll('variable')) {
      const varName = variable.getAttribute('name')
      if (!varName) continue
      varMap.set(varName, {
        units: variable.getAttribute('units') ?? 'dimensionless',
      })
    }
    componentVariableInfo.set(compName, varMap)
    componentDefinedVars.set(compName, getDefinedVariables(comp))
  }

  // --- 3. Parse all <connection> blocks ---
  //
  // For CellML 1.x: <connection><map_components .../><map_variables .../></connection>
  // For CellML 2.x: <connection component_1="..." component_2="..."><map_variables .../></connection>
  //
  // We accumulate:
  //   edgeSet:    unique component pairs
  //   portLabels: compName -> Set<canonicalLabel>  (deduplicated per variable)

  // portLabels: compName -> Set of canonical port label strings
  const portLabelSets = new Map()
  const edgeSet = new Map() // pairKey -> { source, target }

  const ensurePortSet = (compName) => {
    if (!portLabelSets.has(compName)) portLabelSets.set(compName, new Set())
    return portLabelSets.get(compName)
  }

  for (const connection of doc.querySelectorAll('connection')) {
    // Support both CellML 1.x (map_components child) and 2.x (attributes on connection)
    let comp1, comp2
    const mapComponents = connection.querySelector('map_components')
    if (mapComponents) {
      comp1 = mapComponents.getAttribute('component_1')
      comp2 = mapComponents.getAttribute('component_2')
    } else {
      comp1 = connection.getAttribute('component_1')
      comp2 = connection.getAttribute('component_2')
    }

    if (!comp1 || !comp2) continue
    if (EXCLUDED_COMPONENTS.has(comp1) || EXCLUDED_COMPONENTS.has(comp2)) continue

    const labels1 = ensurePortSet(comp1)
    const labels2 = ensurePortSet(comp2)

    for (const mapVar of connection.querySelectorAll('map_variables')) {
      const var1 = mapVar.getAttribute('variable_1')
      const var2 = mapVar.getAttribute('variable_2')
      if (!var1 || !var2) continue
      if (excludedVarNames.has(var1) || excludedVarNames.has(var2)) continue

      // Canonical label: prefer the variable name from whichever component
      // defines it (LHS of equation). Fall back to alphabetically first.
      const defined1 = componentDefinedVars.get(comp1)?.has(var1)
      const defined2 = componentDefinedVars.get(comp2)?.has(var2)

      let canonicalLabel
      if (defined1 && !defined2) {
        canonicalLabel = var1
      } else if (defined2 && !defined1) {
        canonicalLabel = var2
      } else {
        // Both defined, neither defined, or ambiguous — alphabetically first
        canonicalLabel = [var1, var2].sort()[0]
      }

      labels1.add(canonicalLabel)
      labels2.add(canonicalLabel)
    }

    // One edge per unique component pair — undirected since we have no direction info
    const pairKey = [comp1, comp2].sort().join('|||')
    if (!edgeSet.has(pairKey)) {
      edgeSet.set(pairKey, { source: comp1, target: comp2 })
    }
  }

  // --- 4. Build component list ---
  const components = [...componentVariableInfo.keys()].filter(
    (name) => !EXCLUDED_COMPONENTS.has(name) && portLabelSets.has(name)
  )

  // --- 5. Build configs ---
  const configs = components.map((compName) => {
    const labelSet = portLabelSets.get(compName) ?? new Set()

    // One general_port entry per canonical label, variables array contains
    // all local variable names that map to this canonical label across all connections
    const general_ports = [...labelSet].map((label) => ({
      port_type: label,
      variables: [label],
    }))

    const variables_and_units = []
    for (const [varName, { units }] of componentVariableInfo.get(compName)) {
      variables_and_units.push([varName, units, 'access', 'variable'])
    }

    return {
      module_file: filename,
      module_type: compName,
      vessel_type: compName,
      BC_type: 'nn',
      entrance_ports: [],
      exit_ports: [],
      general_ports,
      variables_and_units,
    }
  })

  const edges = [...edgeSet.values()]

  return { components, edges, configs }
}