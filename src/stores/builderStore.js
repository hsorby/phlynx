import { defineStore } from 'pinia'
import { ref } from 'vue'

import { extractVariablesFromModule } from '../utils/cellml'
import { assign } from 'markdown-it/lib/common/utils.mjs'

function mergeIntoStore(newModules, target) {
  const moduleMap = new Map(target.map((mod) => [mod.filename, mod]))

  if (newModules) {
    for (const newModule of newModules) {
      if (newModule && newModule.filename) {
        // Safety check
        moduleMap.set(newModule.filename, newModule)
      }
    }
  }

  target.length = 0
  target.push(...moduleMap.values())
}

// 'builder' is the store's ID
export const useBuilderStore = defineStore('builder', () => {
  // --- STATE ---
  const availableModules = ref([])
  const availableUnits = ref([])
  const lastSaveName = ref('phlynx-project')
  const lastExportName = ref('phlynx-export')

  const instanceParameterAssignments = ref(new Map())
  const availableParameters = ref(new Map())
  const availableVariableNameIdMap = ref(new Map())

  const moduleParameterMap = ref(new Map())
  const moduleAssignmentTypeMap = ref(new Map())

  // --- DEBUG ---

  function listModules() {
    availableModules.value.forEach((e) => console.log(e.filename))
  }

  function listUnits() {
    availableUnits.value.forEach((e) => {
      console.log(e.filename)
      console.log(e.model.substring(0, 200))
    })
  }

  // --- ACTIONS ---
  function normalizeValue(val) {
    if (!val || val === '-') return val // Ignore placeholders

    const num = parseFloat(val)

    // If it's not a number, return original string (e.g. text values)
    if (isNaN(num)) return val

    return String(num)
  }

  function createParameterKey(parameter) {
    return `${parameter.variable_name.trim()}||${parameter.units.trim()}||${normalizeValue(parameter.value.trim())}||${parameter.data_reference.trim()}`
  }

  function addParameterFile(filename, data) {
    if (!data || !Array.isArray(data)) return false

    for (const param of data) {
      const key = createParameterKey(param)
      if (availableParameters.value.has(key)) {
        availableParameters.value.get(key).count += 1
        availableParameters.value.get(key).source.push(filename)
        // console.log(`Parameter already exists, skipping: ${key}, count: ${availableParameters.value.get(key).count}`)
        continue
      }

      const trimmedVariableName = param.variable_name.trim()
      if (trimmedVariableName === '' || trimmedVariableName === '#') {
        continue
      }
      const newParameterSet = {
        data_reference: param.data_reference.trim(),
        variable_name: trimmedVariableName,
        units: param.units.trim(),
        value: normalizeValue(param.value.trim()),
        source: [filename],
        count: 1,
        id: 'id_' + availableParameters.value.size,
      }
      availableParameters.value.set(key, newParameterSet)
      if (!availableVariableNameIdMap.value.has(trimmedVariableName)) {
        availableVariableNameIdMap.value.set(trimmedVariableName, [])
      }
      availableVariableNameIdMap.value.get(trimmedVariableName).push(key)
    }
    return true
  }

  function assignInstanceVariableParameterValue(instanceVariableName, value, units, isGlobal = false) {
    instanceParameterAssignments.value.set(instanceVariableName, {
      variableName: instanceVariableName,
      value: value,
      units: units,
      isGlobal: isGlobal,
    })
  }

  function getAssignedParameterValueForInstanceVariable(instanceVariableName) {
    return instanceParameterAssignments.value.get(instanceVariableName)
  }

  function getParameterValuesForInstanceVariable(instanceVariable) {
    let results = []
    const paramKeys = availableVariableNameIdMap.value.get(instanceVariable)
    if (paramKeys) {
      results = paramKeys.map((key) => availableParameters.value.get(key))
    } else {
      results.push(undefined)
    }
    return results
  }

  function getAssignmentTypeForModule(moduleName) {
    return moduleAssignmentTypeMap.value.get(moduleName) || null
  }

  function assignAllParameterValuesForInstance(instanceName, sourceFile, componentName) {
    const module = getModulesModule(sourceFile, componentName)
    if (!module) return false

    const variablesAndUnits = module?.configs[0].variables_and_units ?? []
    if (variablesAndUnits.length === 0) {
      return false
    }
    const configMap = new Map(variablesAndUnits.map((arr) => [arr[0], arr]))

    const modelString = getModuleContent(sourceFile)
    const variables = Array.from(extractVariablesFromModule(modelString, componentName))

    for (const variable of variables) {
      const configEntry = configMap.get(variable.name)
      // Default to 'variable' if not found in config
      const initialType = configEntry ? configEntry[3] : 'variable'
      if (initialType !== 'variable' && initialType !== 'boundary_condition') {
        const lookupName = variable.name + (initialType === 'global_constant' ? '' : '_' + instanceName)
        const assignedValue = getParameterValuesForInstanceVariable(lookupName)
        if (assignedValue.length === 1) {
          assignInstanceVariableParameterValue(
            lookupName,
            assignedValue[0].value,
            assignedValue[0].units,
            initialType === 'global_constant'
          )
        }
      }
    }

    return true
  }

  function hasAllParameterValuesAssignedForInstance(instanceName, sourceFile, componentName) {
    // Implement the logic to check if parameter values are assigned for the given instance
    // This is a placeholder implementation and should be replaced with actual logic
    const module = getModulesModule(sourceFile, componentName)
    if (!module) return false

    const variablesAndUnits = module?.configs[0].variables_and_units ?? []
    if (variablesAndUnits.length === 0) {
      return false
    }
    const configMap = new Map(variablesAndUnits.map((arr) => [arr[0], arr]))

    const modelString = getModuleContent(sourceFile)
    const variables = Array.from(extractVariablesFromModule(modelString, componentName))

    for (const variable of variables) {
      const configEntry = configMap.get(variable.name)
      // Default to 'variable' if not found in config
      const initialType = configEntry ? configEntry[3] : 'variable'
      if (initialType !== 'variable' && initialType !== 'boundary_condition') {
        const lookupName = variable.name + (initialType === 'global_constant' ? '' : '_' + instanceName)

        const assignedValue = getAssignedParameterValueForInstanceVariable(lookupName)
        if (!assignedValue) {
          return false
        }
      }
    }

    return true
  }

  // --- SETTERS ---

  function setLastSaveName(name) {
    lastSaveName.value = name
  }

  function setLastExportName(name) {
    lastExportName.value = name
  }

  function addOrUpdateFile(collection, payload) {
    const existingFile = collection.value.find((f) => f.filename === payload.filename)

    if (existingFile) {
      // Replace existing file's data
      Object.assign(existingFile, payload)
    } else {
      // Add new file to the list
      collection.value.push(payload)
    }
  }

  /**
   * Adds configuration(s) to the appropriate module(s)
   */
  function addConfigFile(payload, filename) {
    const configs = payload
    const configFilename = filename

    configs.forEach((config) => {
      if (!config.module_file || typeof config.module_file !== 'string') {
        console.warn('[builderStore] Skipping config: missing module_file', config)
        return
      }

      let moduleFile = availableModules.value.find((f) => f.filename === config.module_file)

      if (!moduleFile) {
        moduleFile = {
          filename: config.module_file,
          modules: [],
          isStub: true,
        }
        availableModules.value.push(moduleFile)
      }

      let module = moduleFile.modules.find((m) => m.name === config.module_type || m.type === config.module_type)

      if (!module) {
        module = {
          name: config.module_type,
          componentName: config.module_type,
          configs: [],
        }
        moduleFile.modules.push(module)
      }

      if (!module.configs) {
        module.configs = []
      }

      const existingConfigIndex = module.configs.findIndex(
        (c) => c.BC_type === config.BC_type && c.vessel_type === config.vessel_type
      )

      const configWithMetadata = {
        ...config,
        _sourceFile: configFilename,
        _loadedAt: new Date().toISOString(),
      }

      if (existingConfigIndex !== -1) {
        module.configs[existingConfigIndex] = configWithMetadata
      } else {
        module.configs.push(configWithMetadata)
      }
    })
  }

  function addModuleFile(payload) {
    const existingFile = availableModules.value.find((f) => f.filename === payload.filename)

    if (existingFile) {
      if (existingFile.isStub) {
        delete existingFile.isStub
      }

      if (existingFile.modules) {
        payload.modules.forEach((newMod) => {
          const oldMod = existingFile.modules.find((m) => m.name === newMod.name)
          if (oldMod && oldMod.configs && oldMod.configs.length > 0) {
            newMod.configs = oldMod.configs
          }
        })
      }
    }

    addOrUpdateFile(availableModules, payload)
  }

  function addUnitsFile(payload) {
    addOrUpdateFile(availableUnits, payload)
  }

  function loadState(state) {
    mergeIntoStore(state.availableModules, availableModules.value)
    mergeIntoStore(state.availableUnits, availableUnits.value)
    fileAssignmentTypeMap.value = new Map(state.fileAssignmentTypeMap || [])
    fileParameterMap.value = new Map(state.fileParameterMap || [])
    lastSaveName.value = state.lastSaveName || 'phlynx-project'
    lastExportName.value = state.lastExportName || 'phlynx-export'
    moduleAssignmentTypeMap.value = new Map(state.moduleAssignmentTypeMap || [])
    moduleParameterMap.value = new Map(state.moduleParameterMap || [])
    parameterFiles.value = new Map(state.parameterFiles || [])
  }

  function removeFile(collection, filename) {
    const index = collection.value.findIndex((f) => f.filename === filename)
    if (index !== -1) {
      collection.value.splice(index, 1)
    }
  }

  /**
   * Removes a module file and its modules from the list.
   * @param {string} filename - The name of the file to remove.
   */
  function removeModuleFile(filename) {
    removeFile(availableModules, filename)
  }

  function getModuleContent(filename) {
    const index = availableModules.value.findIndex((f) => f.filename === filename)
    if (index !== -1) {
      return availableModules.value[index].model
    }
    return ''
  }

  function getModulesModule(filename, moduleName) {
    const file = availableModules.value.find((f) => f.filename === filename)
    if (!file) return null

    const module = file.modules.find((m) => m.name === moduleName)
    return module || null
  }

  /**
   * Adds a new units file and its model.
   * If the units file already exists it will be replaced.
   * @param {*} payload
   */
  function addUnitsFile(payload) {
    const existingFile = availableUnits.value.find((f) => f.filename === payload.filename)
    if (existingFile) {
      existingFile.model = payload.model
    } else {
      availableUnits.value.push(payload)
    }
  }

  /**
   * Checks if a module file is already loaded.
   * @param {string} filename - The name of the file to check.
   * @returns {boolean} - True if the file is loaded, false otherwise.
   */
  function hasModuleFile(filename) {
    return availableModules.value.some((f) => f.filename === filename)
  }

  function getConfigForVessel(vesselType, bcType) {
    for (const file of availableModules.value) {
      for (const module of file.modules) {
        if (module.configs) {
          const config = module.configs.find((c) => c.vessel_type === vesselType && c.BC_type === bcType)
          if (config) {
            return {
              config: config,
              module: module,
              filename: file.filename,
            }
          }
        }
      }
    }
    return null
  }

  function getConfig(moduleType, bcType) {
    for (const file of availableModules.value) {
      for (const module of file.modules) {
        if (module.name === moduleType || module.type === moduleType) {
          const config = module.configs?.find((c) => c.BC_type === bcType)
          if (config) return config
        }
      }
    }
    return null
  }

  function getSaveState() {
    return {
      availableModules: availableModules.value,
      availableUnits: availableUnits.value,
      lastExportName: lastExportName.value,
      lastSaveName: lastSaveName.value,
      moduleParameterMap: Array.from(moduleParameterMap.value.entries()),
      moduleAssignmentTypeMap: Array.from(moduleAssignmentTypeMap.value.entries()),
      fileParameterMap: Array.from(fileParameterMap.value.entries()),
      fileAssignmentTypeMap: Array.from(fileAssignmentTypeMap.value.entries()),
      parameterFiles: Array.from(parameterFiles.value.entries()),
    }
  }

  // --- GETTERS (computed) ---

  return {
    // State
    availableModules,
    availableUnits,
    lastExportName,
    lastSaveName,

    // Actions
    addConfigFile,
    addModuleFile,
    addParameterFile,
    addUnitsFile,
    assignAllParameterValuesForInstance,
    assignInstanceVariableParameterValue,
    loadState,
    removeModuleFile,
    setLastExportName,
    setLastSaveName,

    // Getters
    getAssignedParameterValueForInstanceVariable,
    getAssignmentTypeForModule,
    getConfig,
    getConfigForVessel,
    getModuleContent,
    getModulesModule,
    getParameterValuesForInstanceVariable,
    getSaveState,
    hasAllParameterValuesAssignedForInstance,
    hasModuleFile,

    // Debug
    listModules,
    listUnits,
  }
})
