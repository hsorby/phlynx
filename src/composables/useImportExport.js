import { computed, h, markRaw, ref } from 'vue'
import { storeToRefs } from 'pinia'

import {
  DEFAULT_FILE_NAME,
  ZIP_FILE_TYPES,
  CELLML_FILE_TYPES,
  OMEX_FILE_TYPES,
  IMPORT_KEYS,
  EXPORT_KEYS,
} from '../utils/constants'

import CellMLIcon from '../components/icons/CellMLIcon.vue'
import { useSimSettingsStore } from '../stores/simSettingsStore'
import { useLibraryStore } from '../stores/libraryStore'
import { generateFlattenedModel } from '../utils/cellml'
import { createCellMLDataFragment } from '../services/cellml'
import { generateOmexArchive } from '../services/export/omexExport'
import { generateExportZip } from '../services/export/ca'

export function useImportExport({
  libcellml,
  somethingAvailable,
  nodes,
  edges,
  importDialogVisible,
  exportDialogVisible,
  currentImportConfig,
  getImportConfig,
  getFileHandle,
  onExportConfirm,
}) {

  const simSettingsStore = useSimSettingsStore()
  const libraryStore = useLibraryStore()

  const currentImportMode = ref(null)
  const currentExportKey = ref(EXPORT_KEYS.CELLML)

  const { simSettings, plotConfig, parameterScanConfig } = storeToRefs(simSettingsStore);

  const importOptions = computed(() => [
    {
      key: IMPORT_KEYS.INSTANCE_ARRAY,
      label: 'Instance Array',
      icon: 'pi pi-th-large',
      disabled: false,
    },
    {
      key: IMPORT_KEYS.CELLML_FILE,
      label: 'CellML File',
      icon: markRaw(CellMLIcon),
      disabled: libcellml.status !== 'ready',
    },
    {
      key: IMPORT_KEYS.MODULE_CONFIG,
      label: 'Module Config',
      icon: 'pi pi-wrench',
      disabled: libcellml.status !== 'ready',
    },
    {
      key: IMPORT_KEYS.PARAMETER,
      label: 'Parameters',
      icon: 'pi pi-sliders-h',
      disabled: false,
    },
  ])

  currentImportMode.value = importOptions.value[0]

  const exportOptions = computed(() => [
    {
      key: EXPORT_KEYS.CELLML,
      label: 'CellML',
      icon: markRaw(CellMLIcon),
      disabled: libcellml.status !== 'ready' || !somethingAvailable.value,
      suffix: '.cellml',
      fileTypes: CELLML_FILE_TYPES,
      message: 'Generating flattened CellML model.',
      action: () => generateFlattenedModel(nodes.value, edges.value, libraryStore),
      successMessage: async (blob, finalName) => {
        const dataUri = await createCellMLDataFragment(blob, finalName)
        return h('div', null, [
          'Model exported to CellML. Open this model directly in ',
          h(
            'a',
            {
              href: `https://opencor.ws/app/?opencor://openFile/#${dataUri}`,
              rel: 'noopener noreferrer',
              style: { color: 'var(--p-primary-color)', fontWeight: 'bold' },
              target: '_blank',
            },
            'OpenCOR'
          ),
        ])
      },
    },
    {
      key: EXPORT_KEYS.CA,
      label: 'Circulatory Autogen',
      icon: 'pi pi-box',
      disabled: !somethingAvailable.value,
      suffix: '.zip',
      fileTypes: ZIP_FILE_TYPES,
      message: 'Generating and zipping CA files.',
      action: (finalName) => generateExportZip(finalName, nodes.value, edges.value, libraryStore),
      successMessage: () => 'Circulatory Autogen export zip generated.',
    },
    {
      key: EXPORT_KEYS.OMEX,
      label: 'Web OpenCOR',
      icon: 'pi pi-box',
      disabled: libcellml.status !== 'ready' || !somethingAvailable.value,
      suffix: '.omex',
      fileTypes: OMEX_FILE_TYPES,
      message: 'Generating flattened CellML model.',
      action: async () => {
        const cellmlText = await generateFlattenedModel(nodes.value, edges.value, libraryStore)
        return generateOmexArchive(cellmlText, {
          simulationSettings: simSettings.value,
          plotConfig: plotConfig.value,
          parameterScanConfig: parameterScanConfig.value,
        })
      },
      successMessage: () => 'OMEX archive generated for Web OpenCOR.',
    },
    {
      key: EXPORT_KEYS.CUFLYNX,
      label: 'CUFLynx',
      icon: 'pi pi-box',
      disabled: true,
      suffix: '.omex',
      fileTypes: OMEX_FILE_TYPES,
      message: 'Generating flattened CellML model.',
    },
  ])

  const importMenuItems = computed(() =>
    importOptions.value.map((opt) => ({
      label: opt.label,
      icon: opt.icon,
      disabled: opt.disabled,
      command: () => handleImportCommand(opt),
    }))
  )

  const exportMenuItems = computed(() =>
    exportOptions.value.map((opt) => ({
      label: opt.label,
      icon: opt.icon,
      disabled: opt.disabled || !opt.action,
      command: () => handleExportCommand(opt),
    }))
  )

  const cellMlExportTooltip = computed(() => {
    const prefix = 'The CellML export option is disabled because '
    if (libcellml.status !== 'ready') {
      return prefix + 'the CellML library is not ready yet. Please wait a moment and try again.'
    }
    if (!somethingAvailable.value) {
      return prefix + 'there is nothing to export. Please add some modules to the workspace first.'
    }
    return 'This should not be shown when CellML export is enabled.'
  })

  const currentExportMode = computed(() => {
    const found = exportOptions.value.find((opt) => opt.key === currentExportKey.value)
    return found || exportOptions.value[0]
  })

  const currentExportDisabled = computed(() => currentExportMode.value.disabled || !currentExportMode.value.action)

  const performImport = (mode) => {
    currentImportConfig.value = getImportConfig(mode.key)

    if (currentImportConfig.value) {
      importDialogVisible.value = true
    }
  }

  const triggerCurrentImport = () => {
    performImport(currentImportMode.value)
  }

  const handleImportCommand = (option) => {
    currentImportMode.value = option
    performImport(option)
  }

  const performExport = async (modeOverride = currentExportMode.value) => {
    const mode = modeOverride || currentExportMode.value
    currentExportKey.value = mode.key

    const baseName = libraryStore.lastExportName || DEFAULT_FILE_NAME
    const fileTypes = mode.fileTypes || ZIP_FILE_TYPES

    const result = await getFileHandle(baseName, fileTypes, mode.suffix)
    if (result.success && result.handle) {
      onExportConfirm(result.cleanName, result.handle)
    } else if (result.needsLegacyDialog) {
      exportDialogVisible.value = true
    }
  }

  const triggerCurrentExport = () => {
    performExport(currentExportMode.value)
  }

  const handleExportCommand = (option) => {
    const mode = exportOptions.value.find((opt) => opt.key === option.key) || option
    performExport(mode)
  }

  return {
    currentImportMode,
    currentExportKey,
    importOptions,
    exportOptions,
    importMenuItems,
    exportMenuItems,
    cellMlExportTooltip,
    currentExportMode,
    currentExportDisabled,
    triggerCurrentImport,
    triggerCurrentExport,
    handleImportCommand,
    handleExportCommand,
    performImport,
    performExport,
  }
}
