import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useLibraryStore } from './libraryStore'
import { hasAll, hasAny } from '../utils/sets'

function parseMathRef(mathRef) {
  const [componentFile, componentName] = mathRef.split(':')
  return { componentFile, componentName }
}

function parseModuleRef(moduleRef) {
  const [moduleType, moduleSubtype] = moduleRef.split(':')
  return { moduleType, moduleSubtype }
}

export const useLibraryViewStore = defineStore('libraryView', () => {
  const library = useLibraryStore()

  const groups = computed(() => {
    const result = []
    for (const [mathRef, moduleRefs] of library.availableCollections) {
      const modules = []
      for (const ref of moduleRefs) {
        const module = library.availableModules.get(ref)
        if (module) {
          modules.push(module)
        }
      }
      result.push({
        mathRef,
        label: mathRef,
        modules
      })
    }
    return result
  })

  return { groups }
})