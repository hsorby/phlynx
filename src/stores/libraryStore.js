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

  function clearGlobalConstants() {
    globalConstants.value.clear()
  }

  function assignGlobalConstant(variableName, value, units, data_reference) {
    globalConstants.value.set(variableName, { value, units, data_reference })
  }

  function getGlobalConstant(variableName) {
    return globalConstants.value.get(variableName)
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
    existingSet.forEach((moduleRef) => {
      availableModules.value.get(moduleRef).mathRef = newMathRef
    })
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
      availableUnits: availableUnits.value,
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
    addModule,
    addMathFile,
    addMath,
    addUnitsFile,
    assignGlobalConstant,
    clearGlobalConstants,
    loadState,
    removeCollection,
    setLastExportName,
    setLastSaveName,

    // Query
    getGlobalConstant,
    getState,

    // Debug
    listCollections,
    listUnits,
  }
})