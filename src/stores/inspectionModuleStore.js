import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useInspectionModuleStore = defineStore('inspectionModules', () => {
  const modules = ref([])

  /**
   * @param {{ name: string, units: string, variables: Array<{ key: string, nodeId: string, nodeName: string, variableName: string, units: string }> }} payload
   */
  function addModule({ name, units, variables }) {
    const module = {
      id: `inspection-${crypto.randomUUID()}`,
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

  return { modules, addModule, removeModule, renameModule }
})
