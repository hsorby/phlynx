/**
 * Generates a unique module name based on the module data and existing names.
 *
 * @param {*} moduleData - The module data to generate a name for.
 * @param {*} existingNames - A set of existing names to check against.
 * @returns {string} A unique module name.
 */
export function generateUniqueModuleName(moduleData, existingNames) {
  let finalName = moduleData.name
  let counter = 1

  while (existingNames.has(finalName)) {
    finalName = `${moduleData.name}_${counter}`
    counter++
  }

  return finalName
}

export function sanitiseModuleName(name) {
  // Sanitize: replace spaces with underscores, remove invalid characters
  // Valid CellML component names: alphanumeric, underscore, and must start with letter or underscore
  let sanitised = name
    .trim()
    .replace(/\s+/g, '_') // Replace spaces (and multiple spaces) with underscore
    .replace(/[^a-zA-Z0-9_]/g, '') // Remove all invalid characters

  // Ensure it starts with a letter or underscore
  if (sanitised && !/^[a-zA-Z_]/.test(sanitised)) {
    sanitised = '_' + sanitised
  }

  return sanitised
}

/**
 * Generates a unique node ID for drag-and-drop nodes.
 *
 * @returns {string} Unique node ID.
 */
export function getId(nodeIds, prefix = 'dndnode_') {
  // Find the highest existing ID
  let maxId = -1
  nodeIds.forEach((nodeId) => {
    if (nodeId.startsWith(prefix)) {
      const numPart = parseInt(nodeId.split('_')[1], 10)
      if (!isNaN(numPart) && numPart > maxId) {
        maxId = numPart
      }
    }
  })

  // Return the next ID in the sequence
  return `${prefix}${maxId + 1}`
}
