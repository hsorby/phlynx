import { Parser } from 'htmlparser2'
export function createEmptyAnalysis() {
  return { componentName: '', declared: [], referenced: [], stateVariables: [], unresolved: [], assigned: [], voi: [] }
}

const stripNamespacePrefix = (qualifiedName) => qualifiedName.slice(qualifiedName.indexOf(':') + 1)

function buildAnalysis({ componentName, declared, referenced, stateVariables, assigned, voi }) {
  const unitsByName = new Map(declared.map((variable) => [variable.name, variable.units]))
  const referencedNames = Array.from(referenced)
  return {
    componentName,
    declared,
    referenced: referencedNames,
    stateVariables: Array.from(stateVariables),
    unresolved: referencedNames.filter((name) => !unitsByName.get(name)),
    assigned: Array.from(assigned),
    voi: Array.from(voi),
  }
}

/**
 * Analyzes CellML XML in one streaming pass, matching cellml-text-editor's analyzeModel plus the
 * assigned/voi roles. The parser is lenient, so malformed XML gives a best-effort result.
 *
 * @param {string} xml - CellML model XML.
 * @returns {MathAnalysis|null} The analysis, or null for empty input.
 */
export function analyzeMathXml(xml) {
  if (typeof xml !== 'string' || !xml.trim()) return null

  const collected = {
    componentName: '',
    declared: [],
    referenced: new Set(),
    stateVariables: new Set(),
    assigned: new Set(),
    voi: new Set(),
  }

  let hasSeenComponent = false
  let isComponentDone = false
  let ciText = null
  const stack = []

  const parser = new Parser(
    {
      onopentag(rawName, attributes) {
        const name = stripNamespacePrefix(rawName)
        const parent = stack[stack.length - 1]
        const frame = {
          name,
          children: 0,
          first: null,
          inComponent: parent?.inComponent ?? false,
          inMath: (parent?.inMath ?? false) || name === 'math',
          inBvar: (parent?.inBvar ?? false) || name === 'bvar',
          inLhs: parent?.inLhs ?? false,
          isTopLevelApply: false,
          isStateSettled: false,
          isStateCandidate: false,
          isComponent: false,
        }

        if (parent) {
          const index = parent.children++
          if (index === 0) parent.first = name

          // In <apply><diff/><bvar/><ci>x</ci></apply>, the first non-bvar operand is the state.
          if (parent.name === 'apply' && parent.first === 'diff' && index > 0 && !parent.isStateSettled && name !== 'bvar') {
            parent.isStateSettled = true
            frame.isStateCandidate = name === 'ci'
          }
          if (parent.isTopLevelApply && parent.first === 'eq' && index === 1) frame.inLhs = true
          if (parent.name === 'math' && name === 'apply') frame.isTopLevelApply = true
        }

        if (name === 'component' && !hasSeenComponent && !isComponentDone) {
          hasSeenComponent = true
          frame.isComponent = true
          frame.inComponent = true
          collected.componentName = attributes.name ?? ''
        }

        if (frame.inComponent) {
          if (name === 'variable' && !frame.inMath && attributes.name) {
            collected.declared.push({
              name: attributes.name,
              units: attributes.units ?? '',
              interface: attributes.interface ?? '',
              initialValue: attributes.initial_value ?? '',
            })
          } else if (name === 'ci' && frame.inMath) {
            ciText = ''
          }
        }

        stack.push(frame)
      },
      ontext(text) {
        if (ciText !== null) ciText += text
      },
      onclosetag() {
        const frame = stack.pop()
        if (!frame) return

        if (frame.name === 'ci' && ciText !== null) {
          const ciName = ciText.trim()
          ciText = null
          if (ciName) {
            collected.referenced.add(ciName)
            if (frame.isStateCandidate) collected.stateVariables.add(ciName)
            if (frame.inBvar) collected.voi.add(ciName)
            else if (frame.inLhs) collected.assigned.add(ciName)
          }
        }

        if (frame.isComponent) isComponentDone = true
      },
    },
    { xmlMode: true, decodeEntities: true }
  )

  parser.write(xml)
  parser.end()

  return hasSeenComponent ? buildAnalysis(collected) : createEmptyAnalysis()
}

/**
 * Analyzes several pieces of math, keeping their order.
 */
export function analyzeMathBatch(items) {
  return items.map(({ key, xml }) => ({ key, analysis: analyzeMathXml(xml) }))
}
