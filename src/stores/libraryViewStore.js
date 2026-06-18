import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useLibraryStore } from './libraryStore'
import { hasAll, hasAny } from '../utils/sets'

export const useLibraryViewStore = defineStore('libraryView', () => {
  const library = useLibraryStore()

  function tagsFor(module, componentFile) {
    return new Set(module.tags ?? [componentFile])
  }

  const categories = ref([])

  const groups = computed(() => {
    const result = []
    for (const [componentFile, moduleRefs] of library.availableCollections) {
      const modules = []
      for (const ref of moduleRefs) {
        const module = library.availableModules.get(ref)
        if (module) {
          modules.push(module)
        }
      }
      result.push({
        componentFile,
        label: componentFile,
        modules
      })
    }
    return result
  })

  function setCategories(defs) {
    categories.value = defs
  }

  return { categories, groups, setCategories }
})