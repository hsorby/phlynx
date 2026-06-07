import Papa from 'papaparse'

import { IMPORT_KEYS, IMPORT_LABELS } from './constants'
import { isCellML, doesComponentExistInModel } from './cellml'

export const checkModulesAreLoaded = (modulesRequired, libraryStore) => {
  const errors = []
  const warnings = []
  const missingResources = {
    configs: new Set(),
    components: new Set(),
    componentFileIssues: new Map(),
  }
  const availableComponents = new Set()

  libraryStore.availableCollections.forEach((file) => {
    if (file.isStub) {
      return
    }

    file.modules?.forEach((module) => {
      const moduleName = module.name || module.componentName
      if (moduleName) {
        availableComponents.add(moduleName)
      }
    })
  })

  // Get all available configs (module_type + module_subtype combinations)
  // and the component_type they point to
  const availableConfigs = new Map() // key: "module_type:module_subtype", value: config object with metadata
  const componentTypesInConfigs = new Set()

  libraryStore.availableCollections.forEach((file) => {
    file.modules?.forEach((module) => {
      module.configs?.forEach((config) => {
        if (config.module_type && config.module_subtype) {
          const key = `${config.module_type}:${config.module_subtype}`
          // Store config with its associated file information
          availableConfigs.set(key, config)

          if (config.component_type) {
            componentTypesInConfigs.add(config.component_type)
          }
        }
      })
    })
  })

  // Check each module in the CSV
  const missingConfigs = []
  const missingComponents = []

  modulesRequired.forEach((module) => {
    const moduleType = module.module_type?.trim()
    const moduleSubtype = module.module_subtype?.trim()

    if (!moduleType || !moduleSubtype) return

    const key = `${moduleType}:${moduleSubtype}`
    const config = availableConfigs.get(key)

    if (!config) {
      missingConfigs.push(key)
      missingResources.configs.add(key)
    } else {
      const componentFileIssue = validateCollectionFileAssociation(config, libraryStore)
      
      if (componentFileIssue) {
        // Use composite key for automatic deduplication via Map
        const issueKey = `${componentFileIssue.config}:${componentFileIssue.issue}`
        missingResources.componentFileIssues.set(issueKey, componentFileIssue)
        
        if (
          componentFileIssue.issue === 'missing_file' ||
          componentFileIssue.issue === 'stub_file' ||
          componentFileIssue.issue === 'component_not_in_file'
        ) {
          missingComponents.push(config.component_type)
          missingResources.components.add(config.component_type)
        }
      } else {
        // Only check for missing module if file association is valid
        if (config.module_type && !availableComponents.has(config.component_type)) {
          missingComponents.push(config.component_type)
          missingResources.components.add(config.component_type)
        }
      }
    }
  })

  // Generate warnings
  if (missingConfigs.length > 0) {
    warnings.push(`Missing configurations for: ${[...new Set(missingConfigs)].join(', ')}`)
  }

  if (missingComponents.length > 0) {
    warnings.push(`Missing CellML components: ${[...new Set(missingComponents)].join(', ')}`)
  }

  if (missingResources.componentFileIssues.size > 0) {
    const issueMessages = [...missingResources.componentFileIssues.values()].map(issue => issue.message)
    warnings.push(`Collection file issues: ${[...new Set(issueMessages)].join('; ')}`)
  }

  const needsConfigFile = missingConfigs.length > 0
  const needsComponentFile =
    missingComponents.length > 0 ||
    [...missingResources.componentFileIssues.values()].some(
      (issue) =>
        issue.issue === 'missing_file' ||
        issue.issue === 'stub_file' ||
        issue.issue === 'component_not_in_file'
    )
  const hasCollectionFileMismatch = [...missingResources.componentFileIssues.values()].some(
    (issue) => issue.issue === 'component_not_in_file'
  )

  return {
    errors,
    warnings,
    isValid: true,
    isComplete: errors.length === 0 && warnings.length === 0,
    missingResources: {
      configs: [...missingResources.configs],
      components: [...missingResources.components],
      componentFileIssues: groupCollectionFileIssues([...missingResources.componentFileIssues.values()]),
    },
    needsConfigFile,
    needsComponentFile,
    hasCollectionFileMismatch,
  }
}

/**
 * Validates that a config's component_file field correctly points to a file
 * that contains the specified component_type.
 * 
 * This ensures that components come from the CellML file specified in the config.
 * 
 * @param {Object} config - The configuration object with module_type, module_subtype, component_file, component_type
 * @param {Object} libraryStore - The store containing availableCollections
 * @returns {Object|null} - Issue object if there's a problem, null if validation passes
 */
function validateCollectionFileAssociation(config, libraryStore) {
  const { component_file, component_type, module_type, module_subtype } = config
  
  if (!component_file) {
    // Config doesn't specify a module file
    return {
      config: `${module_type}:${module_subtype}`,
      expectedFile: 'unknown',
      componentType: component_type,
      issue: 'no_file_specified',
      message: `Config for ${module_type}:${module_subtype} doesn't specify a component_file`,
    }
  }
  
  // Find the collection in the library
  const collection = libraryStore.availableCollections.find(
    f => f.filename === component_file
  )
  
  // Expected file is missing (or provided one is empty)
  if (!collection || !collection.model) {
    return {
      config: `${module_type}:${module_subtype}`,
      expectedFile: component_file,
      componentType: component_type,
      issue: 'missing_file',
      message: `Component file "${component_file}" not found (needed for ${module_type}:${module_subtype})`,
    }
  }
  
  // Only config provided and still need component 
  if (collection.isStub) {
    return {
      config: `${module_type}:${module_subtype}`,
      expectedFile: component_file,
      componentType: component_type,
      issue: 'stub_file',
      message: `Component file "${component_file}" needs to be uploaded (needed for ${module_type}:${module_subtype})`,
    }
  }
  
  if (!doesComponentExistInModel(collection.model, component_type)) {
    return {
      config: `${module_type}:${module_subtype}`,
      expectedFile: component_file,
      componentType: component_type,
      issue: 'component_not_in_file',
      message: `Component "${component_type}" not found in "${component_file}"`,
    }
  }

  // All checks passed
  return null
}

/**
 * Groups collection file issues by file AND issue type.
 * This ensures different issues (e.g., 'missing_file' vs 'component_not_in_file')
 * for the same file are reported separately.
 * @param {Array} componentFileIssues - Array of issue objects
 * @returns {Array} Grouped issues with consolidated messages
 */
export function groupCollectionFileIssues(componentFileIssues) {
  if (!componentFileIssues || componentFileIssues.length === 0) {
    return []
  }

  // key: "filename:issueType"
  const issuesGrouped = new Map()
  
  componentFileIssues.forEach(issue => {
    const file = issue.expectedFile
    // Create a composite key to separate different issues for the same file
    const groupKey = `${file}:${issue.issue}`
    
    if (!issuesGrouped.has(groupKey)) {
      issuesGrouped.set(groupKey, {
        file,
        issue: issue.issue,
        configs: [],
        componentTypes: new Set(),
        // Generate a unique ID for UI loops
        uniqueKey: groupKey
      })
    }
    
    const group = issuesGrouped.get(groupKey)
    group.configs.push(issue.config)
    if (issue.componentType) {
      group.componentTypes.add(issue.componentType)
    }
  })
  
  // Convert to array and format messages
  return Array.from(issuesGrouped.values()).map(group => {
    let message = ''
    
    switch (group.issue) {
      case 'missing_file':
        message = `Component file "${group.file}" not found`
        break
      case 'stub_file':
        message = `Component file "${group.file}" needs to be uploaded`
        break
      case 'component_not_in_file':
        message = `Component file "${group.file}" missing components: ${[...group.componentTypes].join(', ')}`
        break
      case 'no_file_specified':
        message = `Module config doesn't specify a component file`
        break
      default:
        message = `Issue with "${group.file}"`
    }
    
    message += ` (needed for: ${group.configs.join(', ')})`
    
    return {
      file: group.file,
      issue: group.issue,
      message,
      configs: group.configs,
      componentTypes: [...group.componentTypes],
      uniqueKey: group.uniqueKey
    }
  })
}

const parseModuleArray = (file, libraryStore = null) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (v) => v.trim(),
      complete: (results) => {
        if (
          !(
            results.data?.length > 0 &&
            'name' in results.data[0] &&
            'module_subtype' in results.data[0] &&
            'module_type' in results.data[0] &&
            'inp_modules' in results.data[0] &&
            'out_modules' in results.data[0]
          )
        ) {
          reject(new Error(`Invalid module array file format. Required columns: name, module_type, module_subtype, inp_modules, out_modules`))
          return
        }
        if (libraryStore) {
          const completionStatus = checkModulesAreLoaded(results.data, libraryStore)
          resolve({
            data: results.data,
            // warnings: completionStatus.warnings,
            completionStatus: completionStatus,
          })
        } else {
          resolve({
            data: results.data,
            // warnings: [],
            completionStatus: null,
          })
        }
      },
      error: (err) => reject(err),
    })
  })
}

const parseConfigJson = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result)
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error('Config file must be a non-empty array of configuration objects.')
        } else if (!('entrance_ports' in parsed[0] &&
            'exit_ports' in parsed[0] &&
            'general_ports' in parsed[0] &&
            'module_subtype' in parsed[0] &&
            'module_type' in parsed[0] &&
            'module_format' in parsed[0] &&
            'component_file' in parsed[0] &&
            'component_type' in parsed[0]
          ))
          {
          throw new Error('Invalid module configuration file format.')
        }
        resolve(parsed)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsText(file)
  })
}

export const parseParametersFile = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true, // Converts row 1 to object keys
      skipEmptyLines: true,

      complete: (results) => {
        // results.data will be an array of objects
        // e.g., [{ param_name: 'a', value: '1' }, { param_name: 'b', value: '2' }]
        const cleanData = results.data.filter((row) => {
          // Check if variable_name exists and does NOT start with '#'
          return row.variable_name && !row.variable_name.trim().startsWith('#')
        })

        if (
          cleanData.length === 0 ||
          !(
            'variable_name' in cleanData[0] &&
            'units' in cleanData[0] &&
            'value' in cleanData[0] &&
            'data_reference' in cleanData[0]
          )
        ) {
          reject(new Error('Invalid parameter file format.'))
          return
        }

        resolve(cleanData)
      },

      error: (err) => reject(err),
    })
  })
}

const parseCellML = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target.result
        if (!isCellML(content)) {
          reject(new Error('Invalid CellML file.'))
          return
        }
        resolve(content)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsText(file)
  })
}

export function createDynamicFields(validation) {
  const fields = []

  if (validation.needsComponentFile) {
    const helpTexts = []
    
    // Add module types that are missing
    if (validation.missingResources.moduleTypes && validation.missingResources.moduleTypes.length > 0) {
      helpTexts.push(`Required module types: ${validation.missingResources.moduleTypes.join(', ')}`)
    }
    
    // Add specific file issues 
    if (validation.missingResources.componentFileIssues && validation.missingResources.componentFileIssues.length > 0) {
      const fileNames = validation.missingResources.componentFileIssues
        .filter(group => group.issue === 'missing_file' || group.issue === 'stub_file')
        .map(group => group.file)
      
      if (fileNames.length > 0) {
        helpTexts.push(`Required files: ${[...new Set(fileNames)].join(', ')}`)
      }
    }

    fields.push({
      key: IMPORT_KEYS.CELLML_FILE,
      label: IMPORT_LABELS.CELLML_FILE,
      required: true,
      accept: '.cellml, .xml',
      parser: parseCellML,
      helpText: helpTexts.length > 0 ? helpTexts.join(' | ') : 'Upload the CellML module file',
      processUpload: 'cellml',
    })
  }

  if (validation.needsConfigFile) {
    fields.push({
      key: IMPORT_KEYS.MODULE_CONFIG,
      label: IMPORT_LABELS.MODULE_CONFIG,
      required: true,
      accept: '.json',
      parser: parseConfigJson,
      helpText: `Required Configurations: ${(validation.missingResources.configs || []).join(', ')}`,
      processUpload: 'config',
    })
  }

  return fields
}

const configs = {
  [IMPORT_KEYS.MODULE_ARRAY]: {
    title: 'Import Module Array File',
    fields: [
      {
        key: IMPORT_KEYS.MODULE_ARRAY,
        label: IMPORT_LABELS.MODULE_ARRAY,
        accept: '.csv',
        limit: 1,
        required: true,
        parser: parseModuleArray,
        requiresStore: true,
        isDynamic: true,
      },
      {
        key: IMPORT_KEYS.PARAMETER,
        label: IMPORT_LABELS.PARAMETER,
        accept: '.csv',
        required: false,
        parser: parseParametersFile,
      },
    ],
  },
  [IMPORT_KEYS.MODULE_CONFIG]: {
    title: 'Import CellML Module Configuration',
    fields: [
      {
        key: IMPORT_KEYS.MODULE_CONFIG,
        label: IMPORT_LABELS.MODULE_CONFIG,
        accept: '.json',
        parser: parseConfigJson,
      },
    ],
  },
  [IMPORT_KEYS.CELLML_FILE]: {
    title: 'Import CellML File',
    fields: [
      {
        key: IMPORT_KEYS.CELLML_FILE,
        label: IMPORT_LABELS.CELLML_FILE,
        required: true,
        accept: '.cellml, .xml',
        parser: parseCellML,
      },
    ],
  },
  [IMPORT_KEYS.PARAMETER]: {
    title: 'Import Parameter Configuration',
    fields: [
      {
        key: IMPORT_KEYS.PARAMETER,
        label: IMPORT_LABELS.PARAMETER,
        accept: '.csv',
        parser: parseParametersFile,
      },
    ],
  },
  [IMPORT_KEYS.UNITS]: {
    title: 'Import Units Configuration',
    fields: [
      {
        key: IMPORT_KEYS.UNITS,
        label: IMPORT_LABELS.UNITS,
        accept: '.cellml, .xml',
        parser: parseCellML,
      },
    ],
  },
}

export function getImportConfig(type) {
  return configs[type] || null
}