import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import { isEditableVariableType } from '../utils/variables'
import { normaliseConfig } from '../utils/config'

function mergeIntoStore(newModules, target) {
  const moduleMap = new Map(target.map((mod) => [mod.componentFile, mod]))

  if (newModules) {
    for (const newModule of newModules) {
      if (newModule && newModule.componentFile) {
        // Safety check
        moduleMap.set(newModule.componentFile, newModule)
      }
    }
  }

  target.length = 0
  target.push(...moduleMap.values())
}

function mergeIn(sourceMap, targetMap) {
  for (const [key, value] of sourceMap) {
    targetMap.set(key, value)
  }
}

// 'library' is the store's ID
export const useLibraryStore = defineStore('library', () => {
  // --- STATE ---
  const availableCollections = ref(new Map())
  const availableModules = ref(new Map())
  const availableMath = ref(new Map())
  const availableUnits = ref([])
  const currentStubs = ref(new Map())
  const availableParameters = ref(new Map())
  const availableVariableNameIdMap = ref(new Map())
  const lastSaveName = ref('phlynx-project')
  const lastExportName = ref('phlynx-export')
  const globalConstants = ref(new Map())

  // --- DEBUG ---

  function listCollections() {
    availableCollections.value.forEach((e) => console.log(e.componentFile))
  }

  function listUnits() {
    availableUnits.value.forEach((e) => {
      console.log(e.componentFile)
      console.log(e.model.substring(0, 200))
    })
  }

  // --- ACTIONS ---
  function normaliseValue(val) {
    if (!val || val === '-') return val // Ignore placeholders

    const num = parseFloat(val)

    // If it's not a number, return original string (e.g. text values)
    if (isNaN(num)) return val

    return String(num)
  }

  function createParameterKey(parameter) {
    return `${parameter.variable_name.trim()}||${parameter.units.trim()}||${normaliseValue(
      parameter.value.trim()
    )}||${parameter.data_reference.trim()}`
  }

  // SMELL - should parameters even be in the library store?
  function addParameterFile(filename, data) {
    if (!data || !Array.isArray(data)) return false

    for (const param of data) {
      const key = createParameterKey(param)
      if (availableParameters.value.has(key)) {
        availableParameters.value.get(key).count += 1
        availableParameters.value.get(key).source.push(filename)
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
        value: normaliseValue(param.value.trim()),
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

  function clearGlobalConstants() {
    globalConstants.value.clear()
  }

  function assignGlobalConstant(variableName, value, units) {
    globalConstants.value.set(variableName, { value, units })
  }

  function getGlobalConstant(variableName) {
    return globalConstants.value.get(variableName)
  }

  // SMELLY
  function getParameterValueForInstanceVariable(instanceVariable) {
    let results = []
    const paramKeys = availableVariableNameIdMap.value.get(instanceVariable)
    if (paramKeys) {
      results = paramKeys.map((key) => availableParameters.value.get(key))
    }

    return results
  }

  // SMELLY 
  function setParameterValuesForInstance(instanceName, variables, collectionFile, componentType, configIndex) {
    const modules = findModulesByComponentName(collectionFile, componentType)
    let variablesAndUnits = []
    if (modules?.configs && configIndex !== undefined && modules.configs[configIndex]) {
      variablesAndUnits = modules.configs[configIndex]?.variables_and_units ?? []
    }
    const configMap = new Map(variablesAndUnits.map((arr) => [arr[0], arr]))
    for (const variable of variables) {
      const configEntry = configMap.get(variable.name)
      // Default to 'variable' if not found in config
      const variableType = configEntry ? configEntry[3] : 'variable'
      variable.type = variableType
      if (isEditableVariableType(variableType)) {
        const lookupName = variable.name + (variableType === 'global_constant' ? '' : '_' + instanceName)
        const parameterValues = getParameterValueForInstanceVariable(lookupName)
        if (parameterValues.length === 1 && parameterValues[0].units === variable.units) {
          if (variableType === 'global_constant') {
            assignGlobalConstant(variable.name, parameterValues[0].value, parameterValues[0].units)
          } else {
            variable.value = parameterValues[0].value
          }
        }
      }
    }
  }

  // --- SETTERS ---

  function setLastSaveName(name) {
    lastSaveName.value = name
  }

  function setLastExportName(name) {
    lastExportName.value = name
  }

  function addOrUpdateFile(collection, payload) {
    const existingFile = collection.value.find((f) => f.componentFile === payload.componentFile)

    if (existingFile) {
      // Replace existing file's data
      Object.assign(existingFile, payload)
    } else {
      // Add new file to the list
      collection.value.push(payload)
    }
  }

  /**
   * Extract module definitions from config file
   */
  function addConfigFile(filename, configs) {
    let totalAdded = 0

    if (!configs || !Array.isArray(configs)) {
      return totalAdded
    }

    configs.forEach((config) => {
      if (!config.component_file || typeof config.component_file !== 'string') {
        return totalAdded
      }

      const module = normaliseConfig(config)
      const moduleRef = module.id

      if(!(availableMath.value.has(module.mathRef))) {
        module.isStub = true
        if (!currentStubs.value.has(module.mathRef)) {
          currentStubs.value.set(module.mathRef, [])
        }
        currentStubs.value.get(module.mathRef).push(moduleRef)
      }

      if(!(availableModules.value.has(moduleRef))) {
        availableModules.value.set(moduleRef, module)
        if (!availableCollections.value.has(config.component_file)) {
          availableCollections.value.set(config.component_file, [])
        }
        availableCollections.value.get(config.component_file).push(moduleRef)
      } 

      totalAdded++
    })
    return totalAdded
  }

  function addOrUpdateCollection(payload) {
    const existingCollection = availableCollections.value.find((f) => f.componentFile === payload.componentFile)

    if (existingCollection) {
      // SMELL: collection shouldn't be a stub, only a module.
      if (existingCollection.isStub) {
        delete existingCollection.isStub
      }

      if (existingCollection.modules) {
        payload.modules.forEach((newMod) => {
          const oldMod = existingCollection.modules.find((m) => m.name === newMod.name)
          if (oldMod && oldMod.configs && oldMod.configs.length > 0) {
            newMod.configs = oldMod.configs
          }
        })
      }
    }

    addOrUpdateFile(availableCollections, payload)
  }

  function loadState(state) {
    mergeIntoStore(state.availableCollections, availableCollections.value)
    mergeIntoStore(state.availableUnits, availableUnits.value)
    if (state.availableParameters) {
      mergeIn(new Map(state.availableParameters), availableParameters.value)
    }
    if (state.availableVariableNameIdMap) {
      mergeIn(new Map(state.availableVariableNameIdMap), availableVariableNameIdMap.value)
    }
    if (state.globalConstants) {
      mergeIn(new Map(state.globalConstants), globalConstants.value)
    }
    lastSaveName.value = state.lastSaveName || 'phlynx-project'
    lastExportName.value = state.lastExportName || 'phlynx-export'
  }

  /**
   * Removes a componentFile and the associated modules from the list.
   * @param {string} componentFile - The componentFile to remove.
   */
  function removeCollection(componentFile) {
    const index = availableCollections.value.findIndex((f) => f.componentFile === componentFile)
    if (index !== -1) {
      availableCollections.value.splice(index, 1)
    }
  }

  /**
   * Adds a new units file and its model.
   * If the units file already exists it will be replaced.
   * @param {*} payload
   */
  function addUnitsFile(payload) {
    const existingFile = availableUnits.value.find((f) => f.componentFile === payload.componentFile) // SMELL - units files also called component files
    if (existingFile) {
      existingFile.model = payload.model
    } else {
      availableUnits.value.push(payload)
    }
  }

  /**
   * Checks if a collection is already loaded.
   * @param {string} filename - The name of the collection to check.
   * @returns {boolean} - True if the collection is loaded, false otherwise.
   */
  function hasCollection(filename) {
    return availableCollections.value.some((f) => f.componentFile === filename)
  }

  // ---- GETTERS ----

  /**
   * Returns the cellml content of a collection.
   */
  function getModelByCollectionName(filename) {
    const index = availableCollections.value.findIndex((f) => f.componentFile === filename)
    if (index !== -1) {
      return availableCollections.value[index].model
    }
    return ''
  }

  /**
   * Returns modules associated with a componentType within the given collection file.
   */
  function findModulesByComponentName(componentFile, componentType) {
    if (!hasCollection(componentFile)) return null
    const collection = collectionsByName.value.get(componentFile)

    return collection.modules.find((m) => m.name === componentType) || null
  }

  function findConfigByName(moduleType, moduleSubtype) {
    const key = `${moduleType}||${moduleSubtype}`
    return configsByTypeAndSubtype.value.get(key) || null
  }

  function findConfigByIndex(componentFile, componentType, configIndex) {
    const modules = findModulesByComponentName(componentFile, componentType)
    return modules.configs[configIndex]
  }

  function findConfigsForModule(moduleName) {
    return configsByModuleName.value.get(moduleName) || []
  }

  function getState() {
    return {
      availableCollections: availableCollections.value,
      availableParameters: Array.from(availableParameters.value.entries()),
      availableUnits: availableUnits.value,
      availableVariableNameIdMap: Array.from(availableVariableNameIdMap.value.entries()),
      globalConstants: Array.from(globalConstants.value.entries()),
      lastExportName: lastExportName.value,
      lastSaveName: lastSaveName.value,
    }
  }

  const globalVariables = computed(() => globalConstants.value)

  const allModules = computed(() => 
    availableCollections.value.flatMap((collection => collection.modules || []))
  )

  // SMELL - what do we mean by name?
  const modulesByName = computed(() => {
    const map = new Map()
    for (const collection of availableCollections.value) {
      for (const module of collection.modules || []) {
        map.set(module.name, module)
      }
    }
    return map
  })

  const collectionsByName = computed(() => {
    const map = new Map()
    for (const collection of availableCollections.value) {
      map.set(collection.componentFile, collection)
    }
    return map
  })

  const configsByTypeAndSubtype = computed(() => {
    const map = new Map()
    for (const collection of availableCollections.value) {
      for (const module of collection.modules || []) {
        (module.configs || []).forEach((config, configIndex) => {
          const key = `${config.module_type}||${config.module_subtype}`
          map.set(key, { 
            config, 
            module, 
            configIndex,
            componentFile: collection.componentFile,
          })
        })
      }
    }
    return map
  })

  const configsByModuleName = computed(() => {
    const map = new Map()

    for (const module of allModules.value) {
      map.set(module.name, module.configs || [])
    }

    return map
  })

  return {
    // State
    availableCollections,
    availableUnits,
    lastExportName,
    lastSaveName,

    // Derived State
    collectionsByName,
    modulesByName,
    configsByTypeAndSubtype,
    configsByModuleName,
    allModules,
    globalVariables,

    // Actions
    addConfigFile,
    addOrUpdateCollection,
    addParameterFile,
    addUnitsFile,
    assignGlobalConstant,
    clearGlobalConstants,
    loadState,
    removeCollection,
    setLastExportName,
    setLastSaveName,
    setParameterValuesForInstance,

    // Query
    getGlobalConstant,
    getModelByCollectionName,
    findModulesByComponentName,
    findConfigByName,
    findConfigByIndex,
    findConfigsForModule,
    getParameterValueForInstanceVariable,
    getState,
    hasCollection,

    // Debug
    listCollections,
    listUnits,
  }
})