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
    if (!val || val === '-') return val 

    const num = parseFloat(val)

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
      addModule(module)
      totalAdded++
    })
    return totalAdded
  }

  function addModule(module) {
    if(!(availableMath.value.has(module.mathRef))) {
      module.isStub = true
    }

    if(!(availableModules.value.has(module.moduleRef))) {
      availableModules.value.set(module.moduleRef, module)
    } 

    // SMELL - still only really using cellml file origin, but now extensible if we include other metadata
    updateCollections(module.mathRef, module.moduleRef)
  }

  function ensureSet(key) {
    if (!availableCollections.value.has(key)) {
      availableCollections.value.set(key, new Set())
    }
    return availableCollections.value.get(key)
  }

  function updateCollections(tag, moduleRef) {
    ensureSet(tag).add(moduleRef)
  }

  function addMathFile(filename, components) {
    components.forEach((component) => {
      const mathRef = `${filename}:${component.name}`
      addMath(mathRef, component.math)
    })
  }

  function addMath(mathRef, math, isOverwrite = true) {
    if (!availableMath.value.has(mathRef) || isOverwrite) {
      availableMath.value.set(mathRef, math)
      updateStubStatus(mathRef)
    }
  }

  // Move one moduleRef from one mathRef's Set to another
  function moveModule(moduleRef, fromMathRef, toMathRef) {
    const fromSet = availableCollections.value.get(fromMathRef)
    if (!fromSet?.has(moduleRef)) return

    fromSet.delete(moduleRef)
    if (fromSet.size === 0) availableCollections.value.delete(fromMathRef)

    ensureSet(toMathRef).add(moduleRef)
  }

  // Replace a mathRef key, carrying its entire Set over
  function updateMathRef(oldMathRef, newMathRef) {
    if (!availableCollections.value.has(oldMathRef)) return

    const existingSet = availableCollections.value.get(oldMathRef)
    availableCollections.value.delete(oldMathRef)
    availableCollections.value.set(newMathRef, existingSet)
  }

  // Remove a specific moduleRef from a mathRef's Set
  function removeModule(mathRef, moduleRef) {
    const set = availableCollections.value.get(mathRef)
    if (!set) return

    set.delete(moduleRef)
    if (set.size === 0) availableCollections.value.delete(mathRef)
  }

  function updateStubStatus(mathRef) {
    if (!availableMath.value.has(mathRef)) return

    availableCollections.value.get(mathRef)?.forEach((moduleRef) => {
      const module = availableModules.value.get(moduleRef)
      if (module && module.isStub) {
        delete module.isStub
      }
    })
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

  function removeCollection(componentFile) {
    delete availableCollections.value.get(componentFile)
  }

  function addUnitsFile(payload) {
    const existingFile = availableUnits.value.find((f) => f.componentFile === payload.componentFile) // SMELL - units files also called component files
    if (existingFile) {
      existingFile.model = payload.model
    } else {
      availableUnits.value.push(payload)
    }
  }

  // ---- GETTERS ----

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

  return {
    // State
    availableCollections,
    availableMath,
    availableModules,
    availableUnits,
    lastExportName,
    lastSaveName,

    // Derived State
    globalVariables,

    // Actions
    addConfigFile,
    addMathFile,
    addMath,
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
    getParameterValueForInstanceVariable,
    getState,

    // Debug
    listCollections,
    listUnits,
  }
})