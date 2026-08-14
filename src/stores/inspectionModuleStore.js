import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useInspectionModuleStore = defineStore('inspectionModules', () => {
  const modules = ref([])

  /**
   * @param {{ id?: string, name: string, units: string, variables: Array<{ key: string, nodeId: string, nodeName: string, variableName: string, units: string }> }} payload
   */
  function addModule({ id, name, units, variables }) {
    const module = {
      id: id || `inspection-${crypto.randomUUID()}`,
      name,
      units: units || '',
      variables,
    }
    modules.value.push(module)
    return module
  }

  function removeModule(id) {
    modules.value = modules.value.filter((module) => module.id !== id)
  }

  function renameModule(id, name) {
    const module = modules.value.find((module) => module.id === id)
    if (module) module.name = name
  }

  function clearModules() {
    modules.value = []
  }

  function getState() {
    return modules.value
  }

  function loadState(availableModules) {
    clearModules()
    for (const module of availableModules || []) {
      addModule(module)
    }
  }

  return { modules, addModule, removeModule, renameModule, clearModules, getState, loadState }
})
