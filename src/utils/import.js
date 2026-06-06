import Papa from 'papaparse'

import { IMPORT_KEYS, IMPORT_LABELS } from './constants'
import { isCellML } from './cellml'

export const checkModulesAreLoaded = (modulesRequired, libraryStore) => {
  const errors = []
  const warnings = []
  const missingResources = {
    configs: new Set(),
    moduleTypes: new Set(),
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
  const moduleTypesInConfigs = new Set()

  libraryStore.availableCollections.forEach((file) => {
    file.modules?.forEach((module) => {
      module.configs?.forEach((config) => {
        if (config.module_type && config.module_subtype) {
          const key = `${config.module_type}:${config.module_subtype}`
          // Store config with its associated file information
          availableConfigs.set(key, config)

          if (config.module_type) {
            moduleTypesInConfigs.add(config.module_type)
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
      const moduleFileIssue = validateModuleFileAssociation(config, libraryStore)
      
      if (moduleFileIssue) {
        // Use composite key for automatic deduplication via Map
        const issueKey = `${moduleFileIssue.config}:${moduleFileIssue.issue}`
        missingResources.moduleFileIssues.set(issueKey, moduleFileIssue)
        
        // Add to appropriate missing resource category
        if (moduleFileIssue.issue === 'missing_file' || moduleFileIssue.issue === 'stub_file') {
          missingComponents.push(config.module_type)
          missingResources.moduleTypes.add(config.module_type)
        }
      } else {
        // Only check for missing module if file association is valid
        if (config.module_type && !availableCellMLModules.has(config.module_type)) {
          missingComponents.push(config.module_type)
          missingResources.moduleTypes.add(config.module_type)
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

  if (missingResources.moduleFileIssues.size > 0) {
    const issueMessages = [...missingResources.moduleFileIssues.values()].map(issue => issue.message)
    warnings.push(`Module file issues: ${[...new Set(issueMessages)].join('; ')}`)
  }

  const needsConfigFile = missingConfigs.length > 0
  const needsComponentFile = missingComponents.length > 0 || 
    [...missingResources.componentFileIssues.values()].some(issue => 
      issue.issue === 'missing_file' || issue.issue === 'stub_file'
    )
  const hasModuleFileMismatch = [...missingResources.componentFileIssues.values()].some(issue =>
    issue.issue === 'component_not_in_file'
  )

  return {
    errors,
    warnings,
    isValid: true,
    isComplete: errors.length === 0 && warnings.length === 0,
    missingResources: {
      configs: [...missingResources.configs],
      moduleTypes: [...missingResources.moduleTypes],
      componentFileIssues: groupComponentFileIssues([...missingResources.componentFileIssues.values()]),
    },
    needsConfigFile,
    needsComponentFile,
    hasComponentFileMismatch,
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
function validateModuleFileAssociation(config, libraryStore) {
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
  
  // Find the component file in available modules
  const componentFile = libraryStore.availableCollections.find(
    f => f.filename === component_file
  )
  
  if (!componentFile) {
    // The specified component file doesn't exist in the store
    return {
      config: `${module_type}:${module_subtype}`,
      expectedFile: component_file,
      componentType: component_type,
      issue: 'missing_file',
      message: `Component file "${component_file}" not found (needed for ${module_type}:${module_subtype})`,
    }
  }
  
  // Check if it's just a stub (config was uploaded but component file wasn't)
  if (componentFile.isStub) {
    return {
      config: `${module_type}:${module_subtype}`,
      expectedFile: component_file,
      componentType: component_type,
      issue: 'stub_file',
      message: `Component file "${component_file}" needs to be uploaded (needed for ${module_type}:${module_subtype})`,
    }
  }
  
  // Verify components come from the CellML file stated in the config
  const componentExists = componentFile.components?.some(
    c => (c.name === component_type || c.componentName === component_type)
  )
  
  if (!componentExists) {
    // The file exists but doesn't contain the expected component
    const availableComponents = componentFile.components?.map(c => c.name || c.componentName).join(', ') || 'none'
    return {
      config: `${module_type}:${module_subtype}`,
      expectedFile: component_file,
      componentType: component_type,
      issue: 'component_not_in_file',
      message: `Component "${component_type}" not found in "${component_file}" (has: ${availableComponents})`,
    }
  }
  
  // All checks passed - the component comes from the correct file as specified in the config
  return null
}

/**
 * Groups component file issues by file AND issue type.
 * This ensures different issues (e.g., 'missing_file' vs 'component_not_in_file')
 * for the same file are reported separately.
 * * @param {Array} componentFileIssues - Array of issue objects
 * @returns {Array} Grouped issues with consolidated messages
 */
export function groupComponentFileIssues(componentFileIssues) {
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
        moduleTypes: new Set(),
        // Generate a unique ID for UI loops
        uniqueKey: groupKey
      })
    }
    
    const group = issuesGrouped.get(groupKey)
    group.configs.push(issue.config)
    if (issue.moduleType) {
      group.moduleTypes.add(issue.moduleType)
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
        message = `Component file "${group.file}" missing components: ${[...group.moduleTypes].join(', ')}`
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
      moduleTypes: [...group.moduleTypes],
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
        if (
          !(
            parsed.length > 0 &&
            'entrance_ports' in parsed[0] &&
            'exit_ports' in parsed[0] &&
            'general_ports' in parsed[0] &&
            'module_subtype' in parsed[0] &&
            'module_type' in parsed[0] &&
            'module_format' in parsed[0] &&
            'module_file' in parsed[0] &&
            'component_type' in parsed[0]
          )
        ) {
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
      parser: parseModuleJson,
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