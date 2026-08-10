<template>
  <div class="app-layout-container">
    <header class="app-header">
      <div class="file-uploads">
        <div class="file-io-buttons">
          <!-- Hidden File Input for Workspace Load -->
          <input
            ref="workspaceFileInput"
            type="file"
            accept=".json"
            style="display: none"
            @change="handleLoadWorkspace"
          />
          <Button
            icon="pi pi-folder-open"
            size="small"
            variant="text"
            @click="$refs.workspaceFileInput.click()"
          />

          <Button
            icon="pi pi-save"
            size="small"
            variant="text"
            @click="handleSaveWorkspace"
            style="margin-left: 10px"
            :disabled="!somethingAvailable"
          />

          <Divider layout="vertical" style="margin: 0 15px" />

          <Button
            icon="pi pi-sparkles"
            size="small"
            variant="text"
            severity="warn"
            @click="handleAutoLayout"
            :disabled="!somethingAvailable"
          />

          <Button
            icon="pi pi-eraser"
            size="small"
            variant="text"
            severity="danger"
            @click="handleClearWorkspace"
            style="margin-left: 10px"
            :disabled="!somethingAvailable"
          />

          <Divider layout="vertical" style="margin: 0 15px" />

          <Button
            iconOnly
            icon="pi pi-undo"
            size="small"
            variant="text"
            severity="secondary"
            @click="handleUndo"
            :disabled="!historyStore.canUndo"
          />

          <Button
            iconOnly
            icon="pi pi-refresh"
            size="small"
            variant="text"
            severity="secondary"
            @click="handleRedo"
            style="margin-left: 10px"
            :disabled="!historyStore.canRedo"
          />

          <Divider layout="vertical" style="margin: 0 15px" />

          <Button
            label="Macro Build"
            size="small"
            variant="text"
            severity="info"
            @click="onOpenMacroBuilderDialog"
          />

          <Divider layout="vertical" style="margin: 0 15px" />

          <!-- Import Dropdown / SplitButton -->
          <SplitButton
            :label="`Import ${currentImportMode.label}`"
            text
            size="small"
            :icon="typeof currentImportMode.icon === 'string' ? currentImportMode.icon : undefined"
            :model="importMenuItems"
            severity="secondary"
            @click="triggerCurrentImport"
            :disabled="currentImportMode.disabled"
            v-tooltip.bottom="
              currentImportMode.disabled ? 'The Import option is disabled because CellML library is not ready yet.' : ''
            "
          >
            <!-- Main Button Icon (for custom Vue component icons) -->
            <template #icon v-if="typeof currentImportMode.icon !== 'string'">
              <component :is="currentImportMode.icon" class="p-button-icon p-button-icon-left" />
            </template>

            <!-- Dropdown Menu Item Icons -->
            <template #item="{ item, props }">
              <a class="p-menuitem-link" v-ripple v-bind="props.action">
                <!-- If icon is a Vue component -->
                <component :is="item.icon" v-if="typeof item.icon !== 'string'" class="p-menuitem-icon" />
                <!-- If icon is a PrimeIcon class string -->
                <span v-else :class="[item.icon, 'p-menuitem-icon']"></span>

                <span class="p-menuitem-text">{{ item.label }}</span>
              </a>
            </template>
          </SplitButton>

          <!-- Export Dropdown / SplitButton -->
          <SplitButton
            :label="`Export ${currentExportMode.label}`"
            text
            size="small"
            :icon="typeof currentExportMode.icon === 'string' ? currentExportMode.icon : undefined"
            :model="exportMenuItems"
            severity="secondary"
            style="margin-left: 10px"
            @click="triggerCurrentExport"
            :disabled="!somethingAvailable || currentExportMode.disabled"
            v-tooltip.bottom="!somethingAvailable || currentExportMode.disabled ? cellMlExportTooltip : ''"
          >
            <!-- Main Button Icon (for custom Vue component icons) -->
            <template #icon v-if="typeof currentExportMode.icon !== 'string'">
              <component :is="currentExportMode.icon" class="p-button-icon p-button-icon-left" />
            </template>

            <!-- Dropdown Menu Item Icons -->
            <template #item="{ item, props }">
              <a class="p-menuitem-link" v-ripple v-bind="props.action">
                <!-- If icon is a Vue component -->
                <component :is="item.icon" v-if="typeof item.icon !== 'string'" class="p-menuitem-icon" />
                <!-- If icon is a PrimeIcon class string -->
                <span v-else :class="[item.icon, 'p-menuitem-icon']"></span>

                <span class="p-menuitem-text">{{ item.label }}</span>
              </a>
            </template>
          </SplitButton>
        </div>
      </div>

      <div class="header-right-actions">
        <a href="https://github.com/physiomelinks/phlynx/issues/new" style="font-size: 13px;" target="_blank" class="report-link">
          Report Issue
        </a>
        <!-- Light / Dark Mode Toggle Slider -->
        <div 
          class="theme-slider-container" 
          style="display: flex; align-items: center; margin-left: 20px; gap: 8px;"
          v-tooltip.bottom="isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        >
          <ToggleSwitch 
            :model-value="isDarkMode" 
            @change="toggleDarkMode" 
            aria-label="Toggle Theme"
          >
            <template #handle="{ checked }">
              <i :class="['pi', checked ? 'pi-moon' : 'pi-sun']" style="font-size: 0.75rem"></i>
            </template>
          </ToggleSwitch>
        </div>
      </div>
    </header>

    <div class="app-body-container">
      <ResizableLibraryPanel title="Available Modules" :initial-width="300" :min-width="150" :max-width="400">
        <LibraryArea />
      </ResizableLibraryPanel>

      <main class="workbench-main">
        <div class="workspace-search-container" :class="{ 'search-inactive': !searchBarFocused && !searchQuery }">
          <div class="workspace-search-input-wrapper">
            <IconField iconPosition="left" class="workspace-search-input">
              <InputIcon class="pi pi-search" />
              <InputText
                v-model="searchQuery"
                placeholder="Search modules..."
                @input="handleSearchInput"
                @focus="searchBarFocused = true"
                @blur="searchBarFocused = false"
              />
            </IconField>
            <i
              v-if="searchQuery"
              class="pi pi-times cursor-pointer search-clear-icon"
              @click="clearSearch"
            />
          </div>
          <div v-if="searchQuery" class="search-suffix-content">
            <div class="search-suffix-header">
              <span v-if="matchCount !== null" class="search-match-count">
                {{ matchCount }} match{{ matchCount !== 1 ? 'es' : '' }}
              </span>
              <div v-if="matchCount >= 1" class="search-nav-buttons">
                <Button
                  v-if="matchCount > 1"
                  icon="pi pi-chevron-up"
                  size="small"
                  text
                  @click="cycleToPreviousMatch"
                  title="Previous match (Shift+Enter)"
                />
                <Button
                  icon="pi pi-chevron-down"
                  size="small"
                  text
                  @click="cycleToNextMatch"
                  :title="matchCount === 1 ? 'Zoom to match (Enter)' : 'Next match (Enter)'"
                />
              </div>
            </div>
            <ul v-if="matchCount >= 1" class="search-match-list">
              <li
                v-for="(node, index) in matchingNodesList"
                :key="node.id"
                class="search-match-item"
                :class="{ active: index === currentMatchIndex }"
                @click="selectMatch(index)"
              >
                {{ node.data?.name || node.data?.moduleRef || node.id }}
              </li>
            </ul>
          </div>
        </div>

        <div class="dnd-flow" @drop="onDrop">
          <VueFlow
            :id="FLOW_IDS.MAIN"
            @dragover="onDragOver"
            @dragleave="onDragLeave"
            @nodes-change="onNodeChange"
            @edges-change="onEdgeChange"
            @edge-double-click="onEdgeDoubleClick"
            @pane-context-menu="onPaneContextMenu"
            @pane-click="onPaneClick"
            class="main-flow"
            :max-zoom="1.5"
            :min-zoom="0.1"
            :default-edge-options="edgeLineOptions"
            :connection-line-options="edgeLineOptions"
            :nodes="nodes"
            :delete-key-code="dialogVisible ? [] : ['Backspace', 'Delete']"
          >
            <HelperLines :horizontal="helperLineHorizontal" :vertical="helperLineVertical" :alignment="alignment" />
            <MiniMap :pannable="true" :zoomable="true" class="mini-map" />
            <Controls>
              <ControlButton :disabled="screenshotDisabled" title="PNG Screenshot" @click="doPngScreenshot">
                <i class="pi pi-image"></i>
              </ControlButton>
            </Controls>
            <template #node-instanceNode="props">
              <InstanceNode
                :id="props.id"
                :data="props.data"
                :selected="props.selected"
                :class="getNodeClass(props)"
                @open-port-editor-dialog="onOpenPortEditorDialog"
                @open-cellml-editor-dialog="onOpenCellMLEditorDialog"
                @open-parameter-editor-dialog="onOpenParameterEditorDialog"
                @open-context-menu="onNodeContextMenu"
                :ref="(el) => (nodeRefs[props.id] = el)"
              />
            </template>
            <Workbench>
              <p v-if="isDragOver">Drop here</p>
            </Workbench>
          </VueFlow>
        </div>
      </main>
    </div>
  </div>

  <!-- PrimeVue Confirmation Dialog Service component -->
  <ConfirmDialog />

  <PortEditorDialog
    v-model="portEditorDialogVisible"
    :id="currentEditingNode?.id"
    :initial-name="currentEditingNode?.initialName"
    :initial-ports="currentEditingNode?.initialPorts"
    :variables="currentEditingNode?.variables"
    :existing-names="allNodeNames"
    @confirm="onPortEditConfirm"
  />

  <CellMLEditorDialog
    v-model="cellMLEditorDialogVisible"
    :id="currentEditingNode?.id"
    :name="currentEditingNode?.name"
    :math-ref="currentEditingNode?.mathRef || ''"
    :variables="currentEditingNode?.variables"
    @save="handleCellMLSave"
  />

  <ParameterEditorDialog
    v-model="parameterEditorDialogVisible"
    :id="currentEditingNode?.id"
    :variables="currentEditingNode?.variables"
    @save="handleParameterSave"
  />

  <SaveDialog
    v-model="saveDialogVisible"
    :default-name="libraryStore.lastSaveName"
    @confirm="onSaveConfirm"
  />

  <SaveDialog
    v-model="exportDialogVisible"
    :title="`Export for ${currentExportMode.label}`"
    :default-name="libraryStore.lastExportName"
    :suffix="currentExportMode.suffix"
    @confirm="onExportConfirm"
  />

  <ModuleReplacementDialog
    v-model="replacementDialogVisible"
    :current-instance="currentEditingNode"
    @confirm="onReplaceConfirm"
  />

  <MacroBuilderDialog
    v-model="macroBuilderDialogVisible"
    @generate="onMacroBuilderGenerate"
    @edit-node="onOpenPortEditorDialog"
  />

  <ImportDialog
    ref="importDialogRef"
    v-model="importDialogVisible"
    :config="currentImportConfig"
    @confirm="onImportConfirm"
  />

  <PaneContextMenu
    ref="contextMenuRef"
    :items="contextMenuItems"
  />

  <EdgeConnectionDialog
    v-model="edgeConnectionDialogVisible"
    :source-node="edgeDialogSourceNode"
    :target-node="edgeDialogTargetNode"
    :active-edge="edgeDialogActiveEdge"
    :subgraph="edgeDialogSubgraph"
    @confirm="onEdgeConnectionConfirm"
  />
</template>

<script>
export default {
  name: 'WorkspaceArea',
}
</script>

<script setup>
import { computed, h, inject, markRaw, nextTick, onMounted, onUnmounted, ref, watch, watchPostEffect } from 'vue'
import { connectionExists, useVueFlow, VueFlow } from '@vue-flow/core'

import Button from 'primevue/button'
import SplitButton from 'primevue/splitbutton'
import Divider from 'primevue/divider'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import ConfirmDialog from 'primevue/confirmdialog'
import ToggleSwitch from 'primevue/toggleswitch'

import { Controls, ControlButton } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'

import { useLibraryStore } from '../stores/libraryStore'
import { useFlowHistoryStore } from '../stores/historyStore'
import useDragAndDrop from '../composables/useDnD'
import { useHandleManagement } from '../composables/useHandleManagement'
import { useLoadFromInstanceArray } from '../composables/useLoadFromInstanceArray'
import { useLoadFromCellML } from '../composables/useLoadFromCellml'
import { parseCellMLConnections } from '../services/import/parseCellmlConnections'
import { useColorScheme } from '../composables/useColorScheme'
import { useGtm } from '../composables/useGtm'
import LibraryArea from '../components/LibraryArea.vue'
import ResizableLibraryPanel from '../components/ResizableLibraryPanel.vue'
import Workbench from '../components/WorkbenchArea.vue'
import InstanceNode from '../components/InstanceNode.vue'
import ImportDialog from '../components/ImportDialog.vue'
import ModuleReplacementDialog from '../components/ModuleReplacementDialog.vue'
import SaveDialog from '../components/SaveDialog.vue'
import MacroBuilderDialog from '../components/MacroBuilderDialog.vue'
import EdgeConnectionDialog from '../components/EdgeConnectionDialog.vue'
import HelperLines from '../components/HelperLines.vue'
import PaneContextMenu from '../components/PaneContextMenu.vue'
import { useScreenshot } from '../services/useScreenshot'
import { generateExportZip } from '../services/caExport'
import { createCellMLDataFragment } from '../services/cellml'
import { useMacroGenerator } from '../services/generate/generateWorkflow'
import { migrateWorkspace } from '../services/workspaceMigrator'
import { notify } from '../utils/notify'
import { resolvePortCouplings } from '../utils/edges'
import { getHelperLines } from '../utils/helperLines'
import { getPurgedUrlForResource, getUrlForResource, loadManifest } from '../utils/resources'
import { useClearWorkspace } from '../utils/workspace'
import { useConfirmDialog } from '../composables/useConfirmDialog'
import { relayoutNodes } from '../services/layouts/physics'
import {
  generateFlattenedModel,
  initLibCellML,
  processCellMLData,
  extractVariablesFromMath,
  extractComponentsFromCellmlString,
} from '../utils/cellml'
import {
  edgeLineOptions,
  CELLML_FILE_TYPES,
  FLOW_IDS,
  IMPORT_KEYS,
  EXPORT_KEYS,
  JSON_FILE_TYPES,
  ZIP_FILE_TYPES,
  DEFAULT_FILE_NAME,
  NEW_INSTANCE_MODULE_REF,
  FORMAT_VERSION,
  DEFAULT_PROJECT_TYPE,
} from '../utils/constants'
import { getId as getNextNodeId, generateUniqueInstanceName } from '../utils/nodes'
import { getId as getNextEdgeId } from '../utils/edges'
import { getImportConfig, parseParametersFile } from '../utils/import'
import { detachReactivity } from '../utils/reactivity'
import {
  saveFileHandle,
  saveWithDialog,
  getFileHandle,
  writeFileHandle,
  ensureExtension,
  legacyDownload,
} from '../utils/save'
import CellMLEditorDialog from '../components/CellMLEditorDialog.vue'
import ParameterEditorDialog from '../components/ParameterEditorDialog.vue'
import PortEditorDialog from '../components/PortEditorDialog.vue'
import CellMLIcon from '../components/icons/CellMLIcon.vue'
import { getHandleId, getHandleUidFromHandleId } from '../utils/handles'

const workspaceFileInput = ref(null)

const { isDarkMode, toggleDarkMode } = useColorScheme()

const {
  addEdges,
  addNodes,
  applyNodeChanges,
  applyEdgeChanges,
  dimensions,
  edges,
  findEdge,
  findNode,
  fitView,
  fromObject,
  getSelectedNodes,
  getSelectedEdges,
  nodes,
  onConnect,
  onConnectEnd,
  removeEdges,
  removeNodes,
  screenToFlowCoordinate,
  setViewport,
  toObject,
  updateNodeData,
  viewport,
  vueFlowRef,
} = useVueFlow(FLOW_IDS.MAIN)
const { processMacroGeneration } = useMacroGenerator()
const { confirm } = useConfirmDialog()

const pendingHistoryNodes = new Set()

const {
  onDragOver: onDragOverModule,
  onDrop: onDropModule,
  onDragLeave,
  isDragOver,
  createInstanceNode,
} = useDragAndDrop(pendingHistoryNodes)

const {
  activateHandle,
  confirmActivation,
  revertPendingGhostIfUnused,
  revertHandlesForEdge,
  reactivateEdgeHandles,
  revertHandleIfUnused,
} =
  useHandleManagement()

const dialogVisible = computed(() => {
  return (
    portEditorDialogVisible.value ||
    cellMLEditorDialogVisible.value ||
    parameterEditorDialogVisible.value ||
    saveDialogVisible.value ||
    importDialogVisible.value ||
    exportDialogVisible.value ||
    replacementDialogVisible.value ||
    macroBuilderDialogVisible.value ||
    edgeConnectionDialogVisible.value
  )
})

/**
 * Shared multi-file notification helper.
 * `results` must be an array of `{ ok, summary }` objects where `summary` is a
 * human-readable description of what was loaded (e.g. "3 modules and 2 units").
 * Titles are customisable so each import type can use its own wording.
 */
const notifyMultiFileResults = (
  results,
  { successTitle, partialTitle = 'Partial Import', failTitle = 'Import Failed' }
) => {
  const succeeded = results.filter((r) => r.ok)
  const failed = results.length - succeeded.length
  const fileWord = (n) => `${n} file${n !== 1 ? 's' : ''}`

  if (succeeded.length > 0 && failed === 0) {
    notify.success({ title: successTitle, message: `Loaded from ${fileWord(succeeded.length)}.` })
  } else if (succeeded.length > 0) {
    notify.warning({
      title: partialTitle,
      message: `Loaded from ${fileWord(succeeded.length)}. ${fileWord(failed)} failed.`,
    })
  } else {
    notify.error({ title: failTitle, message: `Failed to load all ${fileWord(failed)}.` })
  }
}

/**
 * Read a File object as text.
 */
const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsText(file)
  })

/**
 * Load an array of CellML entries, each being either a browser File object or a
 * plain `{ name, content }` object (used when content is already in memory).
 *
 * If a single file contains inter-component connections it is treated as a
 * connection graph and loaded into the workspace via loadFromCellML.
 * Otherwise (or for multiple files) the files are registered as module/unit
 * libraries via loadCellMLData as usual.
 *
 * Shows per-file notifications for a single file; a combined summary for multiple.
 */
const loadCellMLFiles = async (entries) => {
  // Single-file fast path: check for connections and load as a graph if present
  if (entries.length === 1) {
    const entry = entries[0]
    const content = entry instanceof File ? await readFileAsText(entry) : entry.content
    const cellmlPayload = parseCellMLConnections(content, entry.name)

    if (cellmlPayload.edges.length > 0) {
      if (nodes.value.length > 0) {
        const overwrite = await confirm({
          header: 'Workspace Not Empty',
          message: 'The workspace already contains nodes. What would you like to do?',
          severity: 'warning',
          acceptLabel: 'Overwrite',
          rejectLabel: 'Add to Workspace',
        })

        if (!overwrite) {
          // Snapshot current workspace before wiping it
          const snapshot = toObject()

          // Load new graph into clean workspace using the normal path
          const result = await loadCellMLData(content, entry.name, { notify: false })
          await loadFromCellML(cellmlPayload, entry.name)

          // Remap snapshotted node IDs to avoid clashes with newly loaded nodes
          const existingIds = new Set(nodes.value.map((n) => n.id))
          const idRemap = new Map()

          const restoredNodes = snapshot.nodes.map((n) => {
            let newId = n.id
            let counter = 1
            while (existingIds.has(newId)) {
              newId = `${n.id}_${counter++}`
            }
            existingIds.add(newId)
            idRemap.set(n.id, newId)

            return {
              ...n,
              id: newId,
              position: { x: n.position.x + 1500, y: n.position.y },
              data: { ...n.data, name: newId },
            }
          })

          // Remap edge source/target to use new IDs
          const restoredEdges = snapshot.edges.map((e) => ({
            ...e,
            id: `${e.id}_restored_${crypto.randomUUID()}`,
            source: idRemap.get(e.source) ?? e.source,
            target: idRemap.get(e.target) ?? e.target,
          }))

          addNodes(restoredNodes)
          addEdges(restoredEdges)

          return [result]
        }
      }

      // Register modules/units in the store first, then build the graph.
      const result = await loadCellMLData(content, entry.name, { notify: false })
      await loadFromCellML(cellmlPayload, entry.name)
      rebuildNodeEdgeIndex()

      return [result]
    }
    // No connections — fall through to the standard module-registration path - TODO - might be nice to still drop single modules into workspace
    try {
      const result = await loadCellMLData(content, entry.name)
      return [result]
    } catch {
      return [{ ok: false, moduleCount: 0, unitsCount: 0 }]
    }
  }

  // Multi-file path: always register as module/unit libraries
  const multiFile = entries.length > 1
  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        const content = entry instanceof File ? await readFileAsText(entry) : entry.content
        return loadCellMLData(content, entry.name, { notify: !multiFile })
      } catch {
        return { ok: false, moduleCount: 0, unitsCount: 0 }
      }
    })
  )

  if (multiFile) {
    const succeeded = results.filter((r) => r.ok)
    const failed = results.length - succeeded.length
    const totalModules = succeeded.reduce((sum, r) => sum + r.moduleCount, 0)
    const totalUnits = succeeded.reduce((sum, r) => sum + r.unitsCount, 0)
    const fileWord = (n) => `${n} file${n !== 1 ? 's' : ''}`
    const summary = [
      totalModules > 0 ? `${totalModules} module${totalModules !== 1 ? 's' : ''}` : '',
      totalUnits > 0 ? `${totalUnits} unit${totalUnits !== 1 ? 's' : ''}` : '',
    ]
      .filter(Boolean)
      .join(' and ')
    if (succeeded.length > 0 && failed === 0) {
      notify.success({ title: 'CellML Files Loaded', message: `Loaded ${summary} from ${fileWord(succeeded.length)}.` })
    } else if (succeeded.length > 0) {
      notify.warning({
        title: 'Partial Import',
        message: `Loaded ${summary} from ${fileWord(succeeded.length)}. ${fileWord(failed)} failed.`,
      })
    } else {
      notify.error({ title: 'Import Failed', message: `Failed to load all ${fileWord(failed)}.` })
    }
  }

  return results
}

/**
 * Unified dragover handler — accepts both module drags (internal) and file drops (.cellml from OS).
 */
const onDragOver = (event) => {
  const hasFiles = event.dataTransfer?.types?.includes('Files')
  if (hasFiles) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  } else {
    onDragOverModule(event)
  }
}

/**
 * Unified drop handler — routes OS file drops to CellML import, internal drags to the module DnD handler.
 */
const onDrop = async (event) => {
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    event.preventDefault()

    const cellmlFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.cellml'))

    if (cellmlFiles.length === 0) {
      notify.warning({
        title: 'Unsupported File Type',
        message: 'Only .cellml files can be dropped onto the workspace.',
      })
      return
    }

    if (libcellml.status !== 'ready') {
      notify.warning({
        title: 'CellML Library Not Ready',
        message: 'Please wait for the CellML library to finish loading and try again.',
      })
      return
    }

    await loadCellMLFiles(cellmlFiles)
  } else {
    onDropModule(event)
  }
}

const historyStore = useFlowHistoryStore()
const { loadFromInstanceArray } = useLoadFromInstanceArray()
const { loadFromCellML } = useLoadFromCellML()
const { capture } = useScreenshot()
const { trackEvent } = useGtm()
const helperLineHorizontal = ref(null)
const helperLineVertical = ref(null)
const alignment = ref('edge')

const libraryStore = useLibraryStore()

const libcellmlReadyPromise = inject('$libcellml_ready')
const libcellml = inject('$libcellml')
const parameterEditorDialogVisible = ref(false)
const portEditorDialogVisible = ref(false)
const cellMLEditorDialogVisible = ref(false)
const saveDialogVisible = ref(false)
const importDialogVisible = ref(false)
const exportDialogVisible = ref(false)
const replacementDialogVisible = ref(false)
const macroBuilderDialogVisible = ref(false)
const edgeConnectionDialogVisible = ref(false)
const edgeDialogSourceNode = ref({})
const edgeDialogTargetNode = ref({})
const edgeDialogActiveEdge = ref({})
const edgeDialogSubgraph = ref(new Map())
const importDialogRef = ref(null)

const currentEditingNode = ref({
  name: '',
  variables: [],
  mathRef: '',
  moduleRef: '',
  id: '',
  ports: [],
})
const currentImportMode = ref(null)
const currentImportConfig = ref({})

const currentExportKey = ref(EXPORT_KEYS.CELLML)
const activeExportNotification = ref(null)

const activeInteractionBuffer = new Map()
const undoRedoSelection = false

const clipboard = ref({ nodes: [], edges: [] })
const mousePosition = ref({ x: 0, y: 0 })

// Search functionality
const searchQuery = ref('')
const matchCount = ref(null)
const matchingNodeIds = ref(new Set())
const searchBarFocused = ref(false)

const currentMatchIndex = ref(0)

const allNodeNames = computed(() => nodes.value.map((n) => n.data.name))
const somethingAvailable = computed(() => nodes.value.length > 0)

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
    icon: 'pi pi-sliders-v',
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
    suffix: '.cellml',
    disabled: libcellml.status !== 'ready' || !somethingAvailable.value,
  },
  {
    key: EXPORT_KEYS.CA,
    label: 'Circulatory Autogen',
    icon: 'pi pi-box',
    disabled: !somethingAvailable.value,
    suffix: '.zip',
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
    disabled: opt.disabled,
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
  // Find the selected option in the current list
  const found = exportOptions.value.find((opt) => opt.key === currentExportKey.value)
  // Fallback to the first option if nothing is found
  return found || exportOptions.value[0]
})

onConnectEnd(() => {
  revertPendingGhostIfUnused()
})

onConnect(async (connection) => {
  const sourceNode = findNode(connection.source)
  const targetNode = findNode(connection.target)

  if (!sourceNode || !targetNode) return
  if (sourceNode === targetNode) return

  const duplicate = edges.value.find(
    (e) => e.source === connection.source && e.target === connection.target
  )

  const duplicateSnapshot = duplicate ? detachReactivity(duplicate) : null

  const sourceHandleUid = connection.sourceHandle
    ? getHandleUidFromHandleId(connection.sourceHandle)
    : null
  const targetHandleUid = connection.targetHandle
    ? getHandleUidFromHandleId(connection.targetHandle)
    : null

  confirmActivation()

  if (sourceHandleUid) {
    activateHandle(connection.source, sourceHandleUid, { trackHistory: false })
  }
  if (targetHandleUid) {
    activateHandle(connection.target, targetHandleUid, { trackHistory: false })
  }

  if (duplicate) {
    const pendingEdge = {
      ...connection,
      id: `pending--${connection.source}--${connection.target}`,
      style: { strokeDasharray: '8 8', opacity: 0.4 }, // visually mark "unconfirmed"
    }

    // Prevents addition to history store.
    suppressedEdgeIds.add(pendingEdge.id)
    addEdges(pendingEdge)

    const shouldReplace = await confirm({
      header: 'Connection already exists',
      message:
        'A connection already exists between these instances. Do you wish to replace it?\n\n' +
        'If you select Cancel, the new connection will be discarded and the existing connection will remain.',
      severity: 'warning',
      acceptLabel: 'Replace',
      rejectLabel: 'Cancel',
    })

    removeEdges(pendingEdge.id)
    suppressedEdgeIds.delete(pendingEdge.id)

    if (!shouldReplace) {
      if (sourceHandleUid) revertHandleIfUnused(connection.source, sourceHandleUid, { trackHistory: false })
      if (targetHandleUid) revertHandleIfUnused(connection.target, targetHandleUid, { trackHistory: false })
      return
    }

    suppressedEdgeIds.add(duplicate.id)
    removeEdges(duplicate.id)
    revertHandlesForEdge(duplicateSnapshot)
  }

  // Derive ordinal indices from the existing edge graph:
  //   sourceIndex = how many edges already leave from this source node
  //                 (i.e. this is the Nth output being connected)
  //   targetIndex = how many edges already arrive at this target node
  //                 (i.e. this is the Nth input being connected)
  // These mirror the positional semantics of out_modules / inp_modules.
  const sourceIndex = edges.value.filter((e) => e.source === connection.source).length
  const targetIndex = edges.value.filter((e) => e.target === connection.target).length

  // Resolve which port labels are coupled across this conduit, using ordinal
  // indices to select the correct slot when a label appears multiple times.
  const couplings = resolvePortCouplings(
    sourceNode.data.ports ?? [],
    targetNode.data.ports ?? [],
    sourceIndex,
    targetIndex
  )

  const newEdge = {
    ...connection,
    ...edgeLineOptions,
    id: `${connection.source}--${connection.target}`,
    // The resolved port-label couplings for this conduit.
    // Downstream consumers (CellML export, validation) read from here.
    data: {
      couplings,
    },
  }

  if (duplicateSnapshot) {
    suppressedEdgeIds.add(newEdge.id)
    addEdges(newEdge)
    suppressedEdgeIds.delete(duplicateSnapshot.id)
    suppressedEdgeIds.delete(newEdge.id)

    // A single undo step for the whole replace: undo brings the old edge
    // (and its handle activation) back and removes the new one; redo does
    // the reverse. No pending edge involved on either side.
    historyStore.addCommand({
      type: 'replace-edge',
      undo: () => {
        removeEdges(newEdge.id)
        revertHandlesForEdge(newEdge, [newEdge.id], { trackHistory: false })
        addEdges(duplicateSnapshot)
        reactivateEdgeHandles(duplicateSnapshot, { trackHistory: false })
      },
      redo: () => {
        removeEdges(duplicateSnapshot.id)
        revertHandlesForEdge(duplicateSnapshot, [duplicateSnapshot.id], { trackHistory: false })
        addEdges(newEdge)
        reactivateEdgeHandles(newEdge, { trackHistory: false })
      },
    })
  } else {
    addEdges(newEdge)
  }
})

const createSelectCommand = (changes, findFn) => {
  return {
    type: 'select',
    undo: () => {
      changes.forEach((s) => {
        const item = findFn(s.id)
        if (item) item.selected = s.from
      })
    },
    redo: () => {
      changes.forEach((s) => {
        const item = findFn(s.id)
        if (item) item.selected = s.to
      })
    },
  }
}

function selectAllNodes() {
  nodes.value.forEach((node) => {
    node.selected = true
  })
}

const clearSearch = () => {
  searchQuery.value = ''
  handleSearchInput()
}

const onPaneClick = () => {
  if (searchQuery.value) {
    clearSearch()
  }
}

const handleSearchInput = () => {
  if (!searchQuery.value.trim()) {
    matchingNodeIds.value.clear()
    matchCount.value = null
    currentMatchIndex.value = 0
    return
  }

  const query = searchQuery.value.toLowerCase()
  const matches = new Set()

  nodes.value.forEach((node) => {
    // Search in all relevant name fields
    const moduleRef = node.data?.moduleRef?.toLowerCase() || ''
    const name = node.data?.name?.toLowerCase() || ''
    const mathRef = node.data?.mathRef?.toLowerCase() || ''

    if (moduleRef.includes(query) || name.includes(query) || mathRef.includes(query)) {
      matches.add(node.id)
    }
  })

  matchingNodeIds.value = matches
  matchCount.value = matches.size
  currentMatchIndex.value = 0
}

const matchingNodesList = computed(() =>
  Array.from(matchingNodeIds.value)
    .map((id) => findNode(id))
    .filter(Boolean)
)

const selectMatch = (index) => {
  const matchArray = Array.from(matchingNodeIds.value)
  if (index < 0 || index >= matchArray.length) return

  currentMatchIndex.value = index
  zoomToNode(matchArray[index])
}

const cycleToNextMatch = () => {
  if (matchCount.value === 0) return

  const matchArray = Array.from(matchingNodeIds.value)

  if (matchCount.value === 1) {
    // If only one match, just zoom to it
    zoomToNode(matchArray[0])
  } else {
    // Multiple matches, cycle through them
    currentMatchIndex.value = (currentMatchIndex.value + 1) % matchArray.length
    zoomToNode(matchArray[currentMatchIndex.value])
  }
}

const cycleToPreviousMatch = () => {
  if (matchCount.value <= 1) return

  const matchArray = Array.from(matchingNodeIds.value)
  currentMatchIndex.value = (currentMatchIndex.value - 1 + matchArray.length) % matchArray.length
  zoomToNode(matchArray[currentMatchIndex.value])
}

const zoomToNode = (nodeId) => {
  const node = findNode(nodeId)
  if (!node) return

  const x = node.position.x + (node.dimensions?.width || 0) / 2
  const y = node.position.y + (node.dimensions?.height || 0) / 2
  const zoom = 1.2

  setViewport(
    {
      x: dimensions.value.width / 2 - x * zoom,
      y: dimensions.value.height / 2 - y * zoom,
      zoom: zoom,
    },
    { duration: 300 }
  )
}

const getNodeClass = (props) => {
  if (!searchQuery.value.trim()) {
    return ''
  }
  return matchingNodeIds.value.has(props.id) ? 'node-search-match' : 'node-search-dimmed'
}

function handleClearWorkspace() {
  const { clearWorkspace } = useClearWorkspace()
  clearWorkspace()
}

function updateHelperLines(changes, nodes) {
  helperLineHorizontal.value = undefined
  helperLineVertical.value = undefined

  if (changes.length === 1 && changes[0].type === 'position' && changes[0].dragging && changes[0].position) {
    const helperLines = getHelperLines(changes[0], nodes)

    // if we have a helper line, we snap the node to the helper line position
    // this is being done by manipulating the node position inside the change object
    changes[0].position.x = helperLines.snapPosition.x ?? changes[0].position.x
    changes[0].position.y = helperLines.snapPosition.y ?? changes[0].position.y

    // if helper lines are returned, we set them so that they can be displayed
    helperLineHorizontal.value = helperLines.horizontal
    helperLineVertical.value = helperLines.vertical
    alignment.value = helperLines.alignment
  }
}

const snapshotEdge = (change) => {
  if (change.type === 'add') {
    return detachReactivity(change.item)
  }

  const edge = findEdge(change.id)
  if (!edge) return null

  // Create a deep copy to break reactivity references
  return detachReactivity(edge)
}

const snapshotNode = (change) => {
  if (change.type === 'add') {
    // For added nodes, snapshot is the node itself
    return detachReactivity(change.item)
  }

  const node = findNode(change.id)
  if (!node) return null

  // Create a deep copy to break reactivity references
  return detachReactivity(node)
}

const processPositionChange = (c, buffer, moveChanges) => {
  if (c.position === undefined && c.from && buffer.has(c.id)) {
    // Drag End
    const start = buffer.get(c.id)
    const end = snapshotNode({ id: c.id })

    if (end && (start.position.x !== end.position.x || start.position.y !== end.position.y)) {
      moveChanges.push({ start, end })
    }
    buffer.delete(c.id)
  } else if (c.position && !buffer.has(c.id)) {
    // Drag Start
    const snap = snapshotNode({ id: c.id })
    if (snap) buffer.set(c.id, snap)
  }
}

const processDimensionChange = (c, buffer) => {
  if (historyStore.lastChangeWasAdd) {
    historyStore.lastChangeWasAddSetter(false)
    if (!historyStore.lastCommandHadOffsetApplied) {
      const node = snapshotNode(c)
      node.position = {
        x: node.position.x - node.dimensions.width / 2,
        y: node.position.y - node.dimensions.height / 2,
      }
      historyStore.replaceLastCommand({
        type: 'add',
        offset: 'applied',
        undo: () => removeNodes(node.id),
        redo: () => addNodes(node),
      })
    }
  } else if (c.dimensions === undefined && buffer.has(c.id)) {
    const startSnapshot = buffer.get(c.id)
    const endSnapshot = snapshotNode({ id: c.id })

    // Only add command if dimensions actually changed
    if (
      endSnapshot &&
      (startSnapshot.dimensions.width !== endSnapshot.dimensions.width ||
        startSnapshot.dimensions.height !== endSnapshot.dimensions.height)
    ) {
      historyStore.addCommand({
        type: 'resize',
        undo: () => {
          const n = findNode(startSnapshot.id)
          if (n) {
            n.dimensions = startSnapshot.dimensions
            n.position = startSnapshot.position
            n.style = { ...startSnapshot.style }
          }
        },
        redo: () => {
          const n = findNode(endSnapshot.id)
          if (n) {
            n.dimensions = endSnapshot.dimensions
            n.position = endSnapshot.position
            n.style = { ...endSnapshot.style }
          }
        },
      })
    }
    buffer.delete(c.id)
  } else if (c.dimensions) {
    if (!buffer.has(c.id)) {
      const snap = snapshotNode({ id: c.id })
      if (snap) {
        buffer.set(c.id, snap)
      }
    }
  }
}

const onNodeChange = (changes) => {
  if (historyStore.isUndoRedoing) {
    // If we are currently undoing/redoing, bypass history tracking
    return applyNodeChanges(changes)
  }

  // Add node and dimension changes are single node events.
  // All other changes can be performed on multiple nodes in a change set.

  const addChanges = []
  const removeChanges = []
  const moveChanges = []
  const selectChanges = []
  changes.forEach((c) => {
    // Deal with the changes that we need to buffer first, which are the posiiton and dimension type changes.
    if (c.type === 'position') {
      processPositionChange(c, activeInteractionBuffer, moveChanges)
    } else if (c.type === 'dimensions') {
      processDimensionChange(c, activeInteractionBuffer)
    } else {
      // Non-active interaction buffer changes.
      activeInteractionBuffer.delete(c.id)
      if (c.type === 'add') {
        addChanges.push({ node: snapshotNode(c) })
      } else if (c.type === 'remove') {
        removeChanges.push({ node: snapshotNode(c) })
      } else if (c.type === 'select' && undoRedoSelection) {
        const node = findNode(c.id)
        if (node) {
          selectChanges.push({ id: c.id, from: node.selected, to: c.selected })
        }
      }
    }
  })

  if (moveChanges.length) {
    historyStore.addCommand({
      type: 'move',
      undo: () => {
        moveChanges.forEach((m) => {
          const n = findNode(m.start.id)
          if (n) n.position = m.start.position
        })
      },
      redo: () => {
        moveChanges.forEach((m) => {
          const n = findNode(m.end.id)
          if (n) n.position = m.end.position
        })
      },
    })
  }
  if (addChanges.length) {
    const nodesToAdd = addChanges.map((c) => c.node)
    const idsToRemove = addChanges.map((c) => c.node.id)

    historyStore.lastChangeWasAddSetter(true)
    historyStore.addCommand({
      type: 'add',
      offset: 'not-applied',
      undo: () => removeNodes(idsToRemove),
      redo: () => addNodes(nodesToAdd),
    })
  }
  if (removeChanges.length) {
    const nodesToRestore = removeChanges.map((change) => change.node)
    const idsToRemove = removeChanges.map((change) => change.node.id)
    historyStore.addCommand({
      type: 'remove',
      undo: () => addNodes(nodesToRestore),
      redo: () => removeNodes(idsToRemove),
    })
  }
  if (selectChanges.length) {
    historyStore.addCommand(createSelectCommand(selectChanges, findNode))
  }

  updateHelperLines(changes, nodes.value)

  // Have Vue Flow update the graph
  applyNodeChanges(changes)
}

const suppressedEdgeIds = new Set()

const onEdgeChange = (changes) => {
  if (historyStore.isUndoRedoing) {
    // If we are currently undoing/redoing, bypass history tracking
    return applyEdgeChanges(changes)
  }

  const removeChanges = []
  const addChanges = []
  const selectChanges = []
  changes.forEach((c) => {
    if (c.type === 'remove') {
      indexRemoveEdge(c)
      if (!suppressedEdgeIds.has(c.id)) {
        removeChanges.push({ edge: snapshotEdge(c) })
      }
    } else if (c.type === 'add') {
      indexAddEdge(c.item)
      if (!suppressedEdgeIds.has(c.item.id)) {
        addChanges.push({ edge: snapshotEdge(c) })
      }
    } else if (c.type === 'select' && undoRedoSelection) {
      const edge = findEdge(c.id)
      selectChanges.push({ id: c.id, from: edge.selected, to: c.selected })
    }
  })

  if (addChanges.length) {
    const edgesToRestore = addChanges.map((change) => change.edge)
    const idsToRemove = addChanges.map((change) => change.edge.id)
    historyStore.addCommand({
      undo: () => {
        removeEdges(idsToRemove)
        edgesToRestore.forEach((edge) =>
          revertHandlesForEdge(edge, idsToRemove, { trackHistory: false })
        )
      },
      redo: () => {
        addEdges(edgesToRestore)
        edgesToRestore.forEach((edge) => reactivateEdgeHandles(edge, { trackHistory: false }))
      },
    })
  }

  if (removeChanges.length) {
    const edgesToRestore = removeChanges.map((change) => change.edge)
    const idsToRemove = removeChanges.map((change) => change.edge.id)

    // Ghost out any handle that no longer has an edge attached to it. 
    // excludeEdgeIds is passed because edges.value hasn't actually 
    // dropped these ids yet at this point.
    edgesToRestore.forEach((edge) => revertHandlesForEdge(edge, idsToRemove))

    historyStore.addCommand({
      undo: () => {
        addEdges(edgesToRestore)
        edgesToRestore.forEach((edge) => reactivateEdgeHandles(edge, { trackHistory: false }))
      },
      redo: () => {
        removeEdges(idsToRemove)
        edgesToRestore.forEach((edge) =>
          revertHandlesForEdge(edge, idsToRemove, { trackHistory: false })
        )
      },
    })
  }

  if (selectChanges.length) {
    historyStore.addCommand(createSelectCommand(selectChanges, findEdge))
  }

  applyEdgeChanges(changes)
}

const screenshotDisabled = computed(() => nodes.value.length === 0 && vueFlowRef.value !== null)

const loadCellMLData = (content, filename, { notify: shouldNotify = true, trackEvents = true } = {}) => {
  return new Promise((resolve) => {
    const result = processCellMLData(content)

    if (result.type === 'success') {
      const componentCount = result.components?.length ?? 0
      const unitsCount = result.units.count

      // Register math with the store
      if (componentCount > 0) {
        libraryStore.addMathFile(filename, result.components)
      }

      // Register units with the store
      if (unitsCount > 0) {
        libraryStore.addUnitsFile({
          componentFile: filename,
          model: result.units.model,
        })
      }

      if (trackEvents) {
        trackEvent('cellml_load_action', {
          category: 'CellML',
          action: 'load_cellml_file',
          label: `Modules: ${componentCount}, Units: ${unitsCount}`,
          file_type: 'cellml',
        })
      }

      if (shouldNotify) {
        if (componentCount > 0 && unitsCount > 0) {
          notify.success({
            title: 'CellML File Loaded',
            message: `Loaded ${componentCount} component${componentCount !== 1 ? 's' : ''} and ${unitsCount} unit${
              unitsCount !== 1 ? 's' : ''
            } from ${filename}.`,
          })
        } else if (componentCount > 0) {
          notify.success({
            title: 'CellML Components Loaded',
            message: `Loaded ${componentCount} component${componentCount !== 1 ? 's' : ''} from ${filename}.`,
          })
        } else if (unitsCount > 0) {
          notify.success({
            title: 'CellML Units Loaded',
            message: `Loaded ${unitsCount} unit${unitsCount !== 1 ? 's' : ''} from ${filename}.`,
          })
        } else {
          notify.info({
            title: 'CellML File Loaded',
            message: `${filename} contained no components or unit definitions.`,
          })
        }
      }

      resolve({ ok: true, componentCount: componentCount, unitsCount: unitsCount })
    } else {
      if (trackEvents) {
        trackEvent('cellml_load_action', {
          category: 'CellML',
          action: 'load_cellml_file',
          label: `Error: encountered ${result.issues.length} error(s)`,
          file_type: 'cellml',
        })
      }
      if (shouldNotify) {
        notify.error({
          title: 'CellML Load Error',
          message: `${result.issues.length} issue${result.issues.length !== 1 ? 's' : ''} found in ${filename}.`,
        })
      }
      console.error('CellML import issues:', result.issues)
      resolve({ ok: false, componentCount: 0, unitsCount: 0 })
    }
  })
}

const loadParametersData = async (content, filename, { notify: shouldNotify = true, trackEvents = true } = {}) => {
  try {
    const variableCatalogue = new Set()
    const nodeMap = new Map(nodes.value.map((n) => [n.data.name, n]))
    let totalLocal = 0

    for (const [instance, node] of nodeMap) {
      for (const variable of node.data.variables) {
        variableCatalogue.add(variable.name.trim())
      }

      const instanceParameters = Array.from(content)
        .filter((entry) => entry.variable_name.trimEnd().endsWith(instance))
        .map((entry) => ({
          ...entry,
          name: entry.variable_name.trimEnd().slice(0, -instance.length).replace(/_+$/, ''),
        }))

      const paramsByName = new Map(instanceParameters.map((p) => [p.name.trim(), p]))
      let updatedCount = 0
      node.data.variables = node.data.variables.map((variable) => {
        const match = paramsByName.get(variable.name.trim())
        if (!match) return variable
        updatedCount++

        const matchedUnit = match.units.trim()
        const currentUnit = variable.units.trim()

        if (matchedUnit !== currentUnit) {
          console.warn(
            `Unit mismatch for "${variable.name}": node has "${currentUnit}", parameter has "${matchedUnit}"`
          )
        }

        return {
          ...variable,
          value: match.value.trim(),
          data_reference: match.data_reference.trim(),
          type: 'constant',
        }
      })
      totalLocal += updatedCount
    }

    const globalConstants = Array.from(content)
      .filter((entry) => variableCatalogue.has(entry.variable_name.trimEnd()))
      .map((entry) => ({
        ...entry,
        name: entry.variable_name.trimEnd(),
      }))

    globalConstants.forEach((p) => {
      libraryStore.assignGlobalConstant(p.name, p.value, p.units, p.data_reference)
    })

    const totalGlobal = globalConstants.length

    const totalUpdated = totalLocal + totalGlobal

    if (shouldNotify && totalUpdated > 0) {
      if (trackEvents) {
        trackEvent('parameters_load_action', {
          category: 'Parameters',
          action: 'load_parameters',
          label: `Parameters: ${totalUpdated}`,
          file_type: 'csv',
        })
      }
      notify.success({
        title: 'Parameters Loaded',
        message: `Loaded ${totalUpdated} parameters from ${filename}.`,
      })
    } else if (shouldNotify && totalUpdated === 0) {
      notify.info({
        title: 'Parameters Not Loaded',
        message: `No new parameters were added from ${filename}.`,
      })
    }
    return { ok: totalUpdated > 0, count: totalUpdated }
  } catch (err) {
    if (shouldNotify) {
      if (trackEvents) {
        trackEvent('parameters_load_action', {
          category: 'Parameters',
          action: 'load_parameters',
          label: `Error: ${err.message}`,
          file_type: 'csv',
        })
      }
      notify.error({
        title: 'Loading Parameters Error',
        message: `Failed to load parameters from ${filename}.`,
      })
    }
    return { ok: false, count: 0 }
  }
}

const loadConfigData = async (content, filename, { notify: shouldNotify = true } = {}) => {
  try {
    const added = libraryStore.addConfigFile(filename, content)
    if (shouldNotify && added > 0) {
      notify.success({
        title: 'Configurations Loaded',
        message: `Loaded ${content.length} configurations from ${filename}.`,
      })
    } else if (shouldNotify && added === 0) {
      notify.info({
        title: 'Configurations Not Loaded',
        message: `No new configurations were added from ${filename}.`,
      })
    }
    return { ok: added > 0, count: added }
  } catch (err) {
    if (shouldNotify) {
      notify.error({
        title: 'Loading Configuration Error',
        message: `Failed to load configurations from ${filename}.`,
      })
    }
    return { ok: false, count: 0 }
  }
}

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

async function onImportConfirm(importPayload, updateProgress) {
  if (currentImportMode.value.key === IMPORT_KEYS.INSTANCE_ARRAY) {
    const instanceArrayFiles = importPayload.get(IMPORT_KEYS.INSTANCE_ARRAY)
    const [[, instanceData]] = instanceArrayFiles
    const instances = instanceData.payload
    const parametersFiles = importPayload.get(IMPORT_KEYS.PARAMETER)

    if (!instances || instances.length === 0) {
      notify.warning({
        title: 'Import Aborted',
        message: 'No instance data provided',
      })
      return
    }

    try {
      await loadFromInstanceArray({ instances }, (current, total, statusMessage) => {
        if (updateProgress) {
          updateProgress(`${statusMessage || 'Loading instance array...'} (${current}/${total})`)
        }
      })

      if (parametersFiles) {
        for (const [filename, data] of parametersFiles) {
          loadParametersData(data.payload, filename, { notify: false })
        }
      }
      rebuildNodeEdgeIndex()

      notify.success({
        title: 'Import Complete',
        message: 'Workflow built successfully!',
      })
    } catch (error) {
      notify.error({
        title: 'Import Failed',
        message: error.message,
      })
    }
  } else if (currentImportMode.value.key === IMPORT_KEYS.CELLML_FILE) {
    const entries = [...importPayload.get(IMPORT_KEYS.CELLML_FILE)].map(([name, data]) => ({
      name,
      content: data?.payload,
    }))
    await loadCellMLFiles(entries)
  } else if (currentImportMode.value.key === IMPORT_KEYS.MODULE_CONFIG) {
    const multiFile = importPayload.size > 1
    const results = await Promise.all(
      [...importPayload.get(IMPORT_KEYS.MODULE_CONFIG)].map(([filename, data]) =>
        loadConfigData(data?.payload, filename, { notify: !multiFile })
      )
    )
    if (multiFile) {
      notifyMultiFileResults(results, { successTitle: 'Configurations Loaded' })
    }
  } else if (currentImportMode.value.key === IMPORT_KEYS.PARAMETER) {
    const multiFile = importPayload.get(IMPORT_KEYS.PARAMETER).size > 1
    const results = await Promise.all(
      [...importPayload.get(IMPORT_KEYS.PARAMETER)].map(([filename, data]) =>
        loadParametersData(data?.payload, filename, { notify: !multiFile })
      )
    )
    if (multiFile) {
      notifyMultiFileResults(results, { successTitle: 'Parameters Loaded' })
    }
  }

  if (importDialogRef.value) {
    importDialogRef.value.finishLoading()
  }
}

const performExport = async () => {
  currentExportKey.value = currentExportMode.value.key

  const baseName = libraryStore.lastExportName || DEFAULT_FILE_NAME
  const fileTypes = currentExportKey.value === EXPORT_KEYS.CELLML ? CELLML_FILE_TYPES : ZIP_FILE_TYPES

  // Get handle first
  const result = await getFileHandle(baseName, fileTypes, currentExportMode.value.suffix)
  if (result.success && result.handle) {
    onExportConfirm(result.cleanName, result.handle)
  } else if (result.needsLegacyDialog) {
    // Show custom dialog for legacy browsers
    exportDialogVisible.value = true
  }
}

const triggerCurrentExport = () => {
  performExport()
}

const handleExportCommand = (option) => {
  currentExportKey.value = option.key
  performExport(option)
}

function onOpenPortEditorDialog(eventPayload) {
  currentEditingNode.value = {
    ...eventPayload,
  }
  portEditorDialogVisible.value = true
}

function onOpenCellMLEditorDialog(eventPayload) {
  currentEditingNode.value = {
    ...eventPayload,
  }
  cellMLEditorDialogVisible.value = true
}

function onOpenParameterEditorDialog(eventPayload) {
  currentEditingNode.value = {
    ...eventPayload,
  }
  parameterEditorDialogVisible.value = true
}

function filterConfig(config, validPortNames, validVariableNames, updatedModule) {
  const portFields = ['entrance_ports', 'exit_ports', 'general_ports']
  portFields.forEach((field) => {
    if (config[field]) {
      config[field] = config[field].map((port) => ({
        ...port,
        variables: (port.variables || []).filter((name) => validPortNames.has(name)),
      }))
    }
  })

  if (config.variables_and_units) {
    const existingNames = new Set(config.variables_and_units.map((e) => e[0]))

    // Use validVariableNames here, not validPortNames
    config.variables_and_units = config.variables_and_units.filter((entry) => validVariableNames.has(entry[0]))

    if (updatedModule?.variables) {
      const newEntries = updatedModule.variables
        .filter((v) => !existingNames.has(v.name))
        .map((v) => [v.name, v.units ?? 'dimensionless', 'access', 'variable'])

      config.variables_and_units.push(...newEntries)
    }
  }
}

function updateVariablesFromMath(node, updatedMath) {
  const existingVariables = new Map(node.data.variables.map((v) => [v.name, v]))
  const updatedVariables = extractVariablesFromMath(updatedMath)

  node.data.variables = updatedVariables.map((updated) => {
    const variableExists = existingVariables.get(updated.name)

    if (variableExists) {
      return {
        ...variableExists,
        units: updated.units,
      }
    } else {
      return {
        name: updated.name,
        units: updated.units,
        access: 'access',
        value: null,
        type: null,
      }
    }
  })
}

function cleanPorts(currentNode) {
  const validVariables = new Set(currentNode.data.variables.map((v) => v.name))
  currentNode.data.ports = currentNode.data.ports.filter((port) =>
    (port.variables || []).every((v) => validVariables.has(v))
  )
}

/**
 * Handler for both Saving (Updating) and Forking CellML modules.
 * Handles:
 * 1. Loading the new/updated CellML data.
 * 2. Migrating configs if the name changed.
 * 3. updating graph nodes to match new ports.
 */
async function handleCellMLSave(saveData) {
  const { id, updateAll, mathRef, math, siblings } = saveData

  // Update math references
  updateNodeData(id, { mathRef })
  let updatedCount = 1
  if (updateAll) {
    siblings.forEach((siblingId) => {
      updateNodeData(siblingId, { mathRef })
      updatedCount++
    })
  }

  // Update variables and ports
  const currentNode = findNode(id)
  updateVariablesFromMath(currentNode, math)
  cleanPorts(currentNode)
  if (updateAll) {
    siblings.forEach((siblingId) => {
      const siblingNode = findNode(siblingId)
      updateVariablesFromMath(siblingNode, math)
      cleanPorts(siblingNode)
    })
  }

  // Update edge couplings
  recomputeEdgeCouplings(id)

  notify.success({
    title: 'CellML Updated',
    message: `Updated ${updatedCount} node${updatedCount !== 1 ? 's' : ''} to ${mathRef.split(':').pop()}.`,
  })
}

async function handleParameterSave(saveData) {
  const { id, variables } = saveData
  updateNodeData(id, { variables })
}

function onOpenMacroBuilderDialog() {
  macroBuilderDialogVisible.value = true
}

/**
 * Recomputes couplings on every edge touching a given node, using the node's
 * current ports. Call this after any operation that changes ports on
 * one or more nodes.
 */
function recomputeEdgeCouplings(nodeId) {
  const outgoing = edges.value.filter((e) => e.source === nodeId)
  outgoing.forEach((edge) => {
    const sourceNode = findNode(edge.source)
    const targetNode = findNode(edge.target)
    if (!sourceNode || !targetNode) return

    const sourceIndex = outgoing.indexOf(edge)
    const edgesIntoTarget = edges.value.filter((e) => e.target === edge.target)
    const targetIndex = edgesIntoTarget.indexOf(edge)

    edge.data = {
      ...edge.data,
      couplings: resolvePortCouplings(
        sourceNode.data.ports ?? [],
        targetNode.data.ports ?? [],
        sourceIndex,
        targetIndex
      ),
    }
  })

  const incoming = edges.value.filter((e) => e.target === nodeId)
  incoming.forEach((edge) => {
    const sourceNode = findNode(edge.source)
    const targetNode = findNode(edge.target)
    if (!sourceNode || !targetNode) return

    const edgesFromSource = edges.value.filter((e) => e.source === edge.source)
    const sourceIndex = edgesFromSource.indexOf(edge)
    const targetIndex = incoming.indexOf(edge)

    edge.data = {
      ...edge.data,
      couplings: resolvePortCouplings(
        sourceNode.data.ports ?? [],
        targetNode.data.ports ?? [],
        sourceIndex,
        targetIndex
      ),
    }
  })
}

async function onPortEditConfirm(updatedData) {
  const { id } = currentEditingNode.value
  if (!id) return

  updateNodeData(id, updatedData)
  recomputeEdgeCouplings(id)
}

const nodeRefs = ref({})

async function onMacroBuilderGenerate(data) {
  handleMacroGeneration(data)
  macroBuilderDialogVisible.value = false
}

function handleMacroGeneration(macroPayload) {
  // Insert at the center of the current view.
  const screenCenterX = dimensions.value.width / 2
  const screenCenterY = dimensions.value.height / 2

  // We approximate the center by negating the viewport x/y.
  const centerX = (screenCenterX - viewport.value.x) / viewport.value.zoom
  const centerY = (screenCenterY - viewport.value.y) / viewport.value.zoom

  processMacroGeneration(macroPayload, { x: centerX, y: centerY })
}

const nodeEdgeIndex = ref(new Map())

function rebuildNodeEdgeIndex() {
  const map = new Map()

  for (const edge of edges.value) {
    if (!map.has(edge.source)) map.set(edge.source, new Set())
    if (!map.has(edge.target)) map.set(edge.target, new Set())

    map.get(edge.source).add(edge.id)
    map.get(edge.target).add(edge.id)
  }

  nodeEdgeIndex.value = map
}

function indexAddEdge(edge) {
  const index = nodeEdgeIndex.value

  if (!index.has(edge.source)) index.set(edge.source, new Set())
  if (!index.has(edge.target)) index.set(edge.target, new Set())

  index.get(edge.source).add(edge.id)
  index.get(edge.target).add(edge.id)
}

function indexRemoveEdge(change) {
  const edge = findEdge(change.id)
  const source = edge?.source ?? change.source
  const target = edge?.target ?? change.target
  const index = nodeEdgeIndex.value

  index.get(source)?.delete(change.id)
  index.get(target)?.delete(change.id)

  if (index.get(source)?.size === 0) index.delete(source)
  if (index.get(target)?.size === 0) index.delete(target)
}

// Extract subgraph (1 degree of separation from the active edge).
function buildEdgeSubgraph(activeEdge) {
  const adjacentIds = new Set([
    ...(nodeEdgeIndex.value.get(activeEdge.source) || []),
    ...(nodeEdgeIndex.value.get(activeEdge.target) || []),
  ])

  const edgeSubgraph = new Map()
  for (const edgeId of adjacentIds) {
    const edge = findEdge(edgeId)
    if (edge) edgeSubgraph.set(edgeId, detachReactivity(edge))
  }
  return edgeSubgraph
}

function onEdgeDoubleClick({ edge }) {
  const sourceNode = findNode(edge.source)
  const targetNode = findNode(edge.target)

  if (!sourceNode || !targetNode) return

  edgeDialogSubgraph.value = buildEdgeSubgraph(edge)
  edgeDialogSourceNode.value = detachReactivity(sourceNode)
  edgeDialogTargetNode.value = detachReactivity(targetNode)
  edgeDialogActiveEdge.value = detachReactivity(edge)
  edgeConnectionDialogVisible.value = true
}

function onEdgeConnectionConfirm({
  sourceNodeId,
  targetNodeId,
  sourcePorts,
  targetPorts,
  couplings,
  foreignCouplings,
}) {
  // Update ports on both nodes
  updateNodeData(sourceNodeId, { ports: sourcePorts })
  updateNodeData(targetNodeId, { ports: targetPorts })

  // Write the new couplings directly onto the active edge
  const activeEdge = findEdge(edgeDialogActiveEdge.value?.id)
  if (activeEdge) {
    activeEdge.data = { ...activeEdge.data, couplings }
  }

  // Apply any coupling changes to sibling edges that were displaced by the user
  // swapping a "taken elsewhere" port. The dialog tracks these explicitly in
  // foreignCouplings so we write them directly.
  if (foreignCouplings) {
    for (const [edgeId, updatedCouplings] of Object.entries(foreignCouplings)) {
      const edge = findEdge(edgeId)
      if (edge) {
        edge.data = { ...edge.data, couplings: updatedCouplings }
      }
    }
  }
}

function onOpenReplacementDialog(eventPayload) {
  currentEditingNode.value = {
    ...eventPayload,
  }
  replacementDialogVisible.value = true
}

async function onReplaceConfirm(updatedData) {
  const { id } = currentEditingNode.value
  if (!id) return
  updateNodeData(id, updatedData)
  replacementDialogVisible.value = false
}

const contextMenuRef = ref(null)

const paneContextMenuItems = [
  {
    label: 'Create Module',
    action: () => createNewInstanceAtPosition(mousePosition.value.x, mousePosition.value.y),
  },
  {
    label: 'Select All',
    action: () => selectAllNodes(),
  },
  {
    label: 'Fit View',
    action: () => fitView(),
  },
  {
    label: 'Clear Workspace',
    action: () => handleClearWorkspace(),
  },
]

const contextMenuItems = ref(paneContextMenuItems)

function onPaneContextMenu(event) {
  event.preventDefault()
  contextMenuItems.value = paneContextMenuItems
  contextMenuRef.value.open(event.clientX, event.clientY)
}

function onNodeContextMenu({ clientX, clientY, id }) {
  contextMenuItems.value = [
    {
      label: 'Replace Module',
      action: () => {
        const node = findNode(id)
        if (!node) return
        onOpenReplacementDialog(node)
      },
    },
  ]
  contextMenuRef.value.open(clientX, clientY)
}

function createNewInstanceAtPosition(clientX, clientY) {
  const module = libraryStore.availableModules.get(NEW_INSTANCE_MODULE_REF)

  const position = screenToFlowCoordinate({ x: clientX, y: clientY })
  createInstanceNode(module, position)
}

function handleAutoLayout() {
  relayoutNodes(nodes.value, edges.value)
}

async function handleSaveWorkspace() {
  const safeName = ensureExtension(libraryStore.lastSaveName, '.json')
  const result = await saveFileHandle(safeName, JSON_FILE_TYPES)
  if (result.status) {
    if (result.handle) {
      const blob = createSaveBlob()
      try {
        writeFileHandle(result.handle, blob)
        libraryStore.setLastSaveName(result.handle.name)
        trackEvent('save_action', {
          category: 'Save',
          action: 'save_workflow',
          label: `File: ${result.handle.name}`,
          file_type: 'json',
        })
        notify.success({ title: 'Workflow saved!' })
      } catch (err) {
        trackEvent('save_action', {
          category: 'Save',
          action: 'save_workflow',
          label: `Error: ${err.message}`,
          file_type: 'json',
        })
        notify.error({
          title: 'Error Saving Workflow',
          message: err.message,
        })
      }
    }
  } else {
    saveDialogVisible.value = true
  }
}

/**
 * Collects all state and processes it into the current export format.
 */
async function onExportConfirm(fileName, handle) {
  if (activeExportNotification.value) {
    activeExportNotification.value.close()
    activeExportNotification.value = null
  }

  const caExport = currentExportMode.value.key === EXPORT_KEYS.CA
  const message = caExport ? 'Generating and zipping CA files.' : 'Generating flattened CellML model.'
  const notification = notify.info({
    title: 'Exporting...',
    message: message,
    duration: 0,
  })

  try {
    const finalName = fileName || libraryStore.lastExportName || DEFAULT_FILE_NAME

    const blob = caExport
      ? await generateExportZip(finalName, nodes.value, edges.value, libraryStore)
      : generateFlattenedModel(nodes.value, edges.value, libraryStore)

    const result = await saveWithDialog(blob, handle, finalName, currentExportMode.value.suffix)

    libraryStore.setLastExportName(result.savedName)
    notification.close()

    let exportMessage = ''
    if (caExport) {
      exportMessage = 'Circulatory Autogen export zip generated.'
    } else {
      const dataUri = await createCellMLDataFragment(blob, finalName)
      exportMessage = h('div', null, [
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
    }

    trackEvent('export_action', {
      category: 'Export',
      action: 'export_model',
      label: `File: ${finalName}`,
      file_type: currentExportMode.value.key,
    })

    activeExportNotification.value = notify.success({
      title: 'Export successful!',
      message: exportMessage,
      duration: 0,
    })
  } catch (error) {
    notification.close()
    trackEvent('export_action', {
      category: 'Export',
      action: 'export_model',
      label: `Error: ${error.message}`,
      file_type: currentExportMode.value.key,
    })

    notify.error({ title: 'Export failed', message: `${error.message}` })
  }
}

/**
 * Recomputes port-label couplings for edges that have none — e.g. files saved
 * before couplings were introduced, or where edge data was lost on serialisation.
 * Uses the same ordinal-index logic as the live onConnect handler so results
 * are identical to a freshly drawn connection. Might not need in future.
 */
function recomputeMissingCouplings() {
  const nodeMap = new Map(nodes.value.map((n) => [n.id, n]))

  // Normalise ports on every node: migrate legacy field names.
  for (const node of nodes.value) {
    if (!node.data?.ports) continue
    node.data.ports = node.data.ports.map((p) => ({
      ...p,
      multiportType: p.multiportType ?? 'None',
    }))
  }

  // Track inbound/outbound ordinal counts per node, matching buildEdges semantics.
  const sourceOutCount = new Map()
  const targetInCount = new Map()

  for (const edge of edges.value) {
    if (edge.data?.couplings?.length) continue // already has valid couplings

    const sourceNode = nodeMap.get(edge.source)
    const targetNode = nodeMap.get(edge.target)
    if (!sourceNode || !targetNode) continue

    const sourceIndex = sourceOutCount.get(edge.source) ?? 0
    const targetIndex = targetInCount.get(edge.target) ?? 0

    const couplings = resolvePortCouplings(
      sourceNode.data.ports ?? [],
      targetNode.data.ports ?? [],
      sourceIndex,
      targetIndex
    )

    if (couplings.length) {
      edge.data = { ...edge.data, couplings }
    }

    sourceOutCount.set(edge.source, sourceIndex + 1)
    targetInCount.set(edge.target, targetIndex + 1)
  }
}

/**
 * Collects all state and creates blob from it.
 */
function createSaveBlob() {
  const saveState = {
    info: {
      format_version: FORMAT_VERSION,
      project: DEFAULT_PROJECT_TYPE,
    },
    flow: toObject(),
    store: libraryStore.getState(),
  }

  const jsonString = JSON.stringify(saveState, null, 2)
  return new Blob([jsonString], { type: 'application/json' })
}

/**
 * Collects all state and downloads it as a JSON file.
 */
const onSaveConfirm = async (fileName) => {
  const baseName = fileName || libraryStore.lastSaveName || DEFAULT_FILE_NAME
  const finalName = ensureExtension(baseName, '.json')
  const blob = createSaveBlob()

  legacyDownload(finalName, blob)

  libraryStore.setLastSaveName(fileName)
  notify.success({ title: 'Workflow saved!' })
}

/**
 * Reads a JSON file and restores the application state.
 */
function handleLoadWorkspace(event) {
  const file = event.target?.files?.[0] || event.raw || event
  if (!file) return

  const reader = new FileReader()
  const { clearWorkspace } = useClearWorkspace()

  reader.onload = async (e) => {
    try {
      const loadedState = JSON.parse(e.target.result)

      // Validate the loaded file
      if (!loadedState.flow || !loadedState.store) {
        throw new Error('Invalid workflow file format.')
      }

      // Handles legacy formats if needed
      const migratedState = migrateWorkspace(loadedState)

      // Clear the current Vue Flow state.
      await clearWorkspace()

      setViewport(migratedState.flow.viewport)
      fromObject(migratedState.flow)

      // Rebuild the edge index so the EdgeConnectionDialog subgraph is correct.
      rebuildNodeEdgeIndex()
      recomputeMissingCouplings()

      // Restore Pinia store state.
      libraryStore.loadState(migratedState.store)

      trackEvent('workflow_load_action', {
        category: 'Workflow',
        action: 'load_workflow',
        label: `Nodes: ${nodes.value.length}, Edges: ${edges.value.length}`,
        file_type: 'json',
      })
      notify.success({
        title: 'Workflow loaded successfully!',
      })
    } catch (error) {
      trackEvent('workflow_load_action', {
        category: 'Workflow',
        action: 'load_workflow',
        label: `Error: ${error.message}`,
        file_type: 'json',
      })
      notify.error({ title: 'Failed to load workflow', message: `${error.message}` })
    }
  }

  reader.readAsText(file)
}

const handleUndo = () => {
  historyStore.undo()
}

const handleRedo = () => {
  historyStore.redo()
}

function doPngScreenshot() {
  capture(vueFlowRef.value, { shouldDownload: true })
}

const getBoundingCenter = (nodes) => {
  if (nodes.length === 0) return { x: 0, y: 0 }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity

  nodes.forEach((n) => {
    const pos = {
      x: n.position.x + n.dimensions.width / 2,
      y: n.position.y + n.dimensions.height / 2,
    }
    if (pos.x < minX) minX = pos.x
    if (pos.y < minY) minY = pos.y
    if (pos.x > maxX) maxX = pos.x
    if (pos.y > maxY) maxY = pos.y
  })

  return {
    x: minX + (maxX - minX) / 2,
    y: minY + (maxY - minY) / 2,
  }
}

const copySelection = async () => {
  const nodes = getSelectedNodes.value
  const edges = getSelectedEdges.value

  if (nodes.length === 0) return

  const storeSnapshot = {}
  for (const node of nodes) {
    const { moduleRef, mathRef } = node.data
    if (!moduleRef || !mathRef) continue

    if (!libraryStore.availableMath.has(mathRef) || !libraryStore.availableModules.has(moduleRef)) continue
    const math = libraryStore.availableMath.get(mathRef)
    const module = libraryStore.availableModules.get(moduleRef)
    if (!math || !module) continue

    const key = `${moduleRef}::${mathRef}`
    if (storeSnapshot[key]) {
      continue
    }

    storeSnapshot[key] = {
      mathRef,
      math,
      moduleRef,
      module,
    }
  }

  const payload = {
    nodes: detachReactivity(nodes),
    edges: detachReactivity(edges),
    storeSnapshot,
  }

  clipboard.value = payload

  try {
    await navigator.clipboard.writeText(JSON.stringify(payload))
  } catch (err) {
    console.warn('Clipboard write failed', err)
  }
}

const pasteSelection = async (atMouse = false) => {
  let sourceClipboard = clipboard.value

  // Try reading from system clipboard (for cross-window paste)
  try {
    const text = await navigator.clipboard.readText()
    const parsed = JSON.parse(text)
    if (parsed?.nodes && parsed?.edges) {
      sourceClipboard = parsed
    }
  } catch (err) {
    // Ignore clipboard read errors
  }

  if (!sourceClipboard.nodes || sourceClipboard.nodes.length === 0) return

  if (sourceClipboard.storeSnapshot) {
    for (const entry of Object.values(sourceClipboard.storeSnapshot)) {
      if (!libraryStore.availableModules.has(entry.moduleRef)) {
        libraryStore.addModule(entry.module)
      }
      if (!libraryStore.availableMath.has(entry.mathRef)) {
        libraryStore.addMath(entry.mathRef, entry.math)
      }
    }
  }

  const newNodes = []
  const newEdges = []

  let dx = 50
  let dy = 50

  if (atMouse) {
    // Convert screen mouse pixels to graph coordinates (handling zoom/pan)
    const mouseFlowPos = screenToFlowCoordinate(mousePosition.value)
    const clipboardCenter = getBoundingCenter(sourceClipboard.nodes)

    // Calculate difference to move center -> mouse
    dx = mouseFlowPos.x - clipboardCenter.x
    dy = mouseFlowPos.y - clipboardCenter.y
  }

  const idMap = {}
  const nodeIdSet = nodes.value.map((n) => n.id)
  const edgeIdSet = edges.value.map((e) => e.id)

  const namesSet = new Set()
  allNodeNames.value.forEach((name) => namesSet.add(name))

  sourceClipboard.nodes.forEach((node) => {
    const newId = getNextNodeId(nodeIdSet)
    idMap[node.id] = newId
    nodeIdSet.push(newId)

    const finalName = generateUniqueInstanceName(node.data.name, namesSet)
    namesSet.add(finalName)

    // Create the new node with offset position.
    newNodes.push({
      id: newId,
      type: node.type,
      data: {
        ...node.data,
        name: finalName,
      },
      position: {
        x: node.position.x + dx,
        y: node.position.y + dy,
      },
      // Reset selection state so we focus on the new copy.
      selected: true,
    })
  })

  sourceClipboard.edges.forEach((edge) => {
    const newSource = idMap[edge.source]
    const newTarget = idMap[edge.target]

    // If both endpoints exist in our new set, recreate the connection.
    if (newSource && newTarget) {
      const newEdgeId = getNextEdgeId(edgeIdSet)
      edgeIdSet.push(newEdgeId)

      newEdges.push({
        ...edge,
        id: newEdgeId,
        source: newSource,
        target: newTarget,
        selected: true,
      })
    }
  })

  getSelectedNodes.value.forEach((n) => (n.selected = false))
  getSelectedEdges.value.forEach((e) => (e.selected = false))

  addNodes(newNodes)
  addEdges(newEdges)
}

const handleKeyDown = (event) => {
  // Check if user is typing in an input field (don't trigger copy/paste then)
  if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
    // Allow Enter/Shift+Enter/Escape in search input for navigation
    if (event.target.closest('.workspace-search-input')) {
      if (event.key === 'Enter') {
        event.preventDefault()
        if (event.shiftKey) {
          cycleToPreviousMatch()
        } else {
          cycleToNextMatch()
        }
      } else if (event.key === 'Escape' && searchQuery.value) {
        event.preventDefault()
        clearSearch()
        event.target.blur?.()
      }
    }
    return
  }

  // Don't intercept shortcuts when the CellML text editor dialog is open.
  // CodeMirror uses contenteditable divs rather than INPUT/TEXTAREA, so the
  // check above doesn't catch it. We guard on both the dialog-open state and
  // on whether focus is inside any CodeMirror editor element.
  if (cellMLEditorDialogVisible.value) return
  if (event.target.closest('.cm-editor')) return

  const isCtrl = event.ctrlKey || event.metaKey
  const isShift = event.shiftKey

  if (isCtrl && event.key.toLowerCase() === 'c') {
    event.preventDefault()
    copySelection()
  }

  if (isCtrl && event.key.toLowerCase() === 'v') {
    event.preventDefault()
    pasteSelection(true)
  }

  if (isCtrl && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    copySelection()
    pasteSelection()
  }

  if (isCtrl && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    selectAllNodes()
  }

  if (isCtrl && event.key.toLowerCase() === 's' && !somethingAvailable) {
    event.preventDefault()
    handleSaveWorkspace()
  }

  if (isCtrl && !isShift && event.key === 'z' && historyStore.canUndo) {
    event.preventDefault()
    handleUndo()
  }
  if (isCtrl && isShift && event.key === 'z' && historyStore.canRedo) {
    event.preventDefault()
    handleRedo()
  }
  if (isCtrl && event.key.toLowerCase() === 'y' && historyStore.canRedo) {
    event.preventDefault()
    handleRedo()
  }

  if (isCtrl && event.key.toLowerCase() === 'e' && !currentExportMode.disabled) {
    event.preventDefault()
    triggerCurrentExport()
  }

  if (isCtrl && event.key.toLowerCase() === 'i' && !currentImportMode.disabled) {
    event.preventDefault()
    triggerCurrentImport()
  }

  // Search shortcuts
  if ((isCtrl && event.key === 'f') || event.key === '/') {
    event.preventDefault()
    document.querySelector('.workspace-search-input input')?.focus()
  }

  if (event.key === 'Escape' && searchQuery.value) {
    clearSearch()
  }
}

async function fetchAndLoadResource(entry, resourceType) {
  try {
    const url = getUrlForResource(entry.path)

    // Fetch resource content
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch ${entry.name}`)

    // Process the response
    const content = await response.text()

    // Load the content
    if (resourceType === 'cellml module' || resourceType === 'cellml units') {
      await loadCellMLData(content, entry.file ?? entry.name, { notify: false })
    } else if (resourceType === 'module config') {
      await loadConfigData(content, entry.name, false)
      // const jsonContent = JSON.parse(content)
      // libraryStore.addConfigFile(jsonContent, entry.name, false)
    } else if (resourceType === 'parameter file') {
      const parsed = await parseParametersFile(content)
      await loadParametersData(parsed, entry.name, { notify: false })
    }

    return true
  } catch (err) {
    return false
  }
}

const cellmlModules = import.meta.glob('../assets/modules/*.cellml', {
  query: 'raw',
  eager: true,
})

const cellmlUnits = import.meta.glob('../assets/units/*.cellml', {
  query: 'raw',
  eager: true,
})

const moduleConfigs = import.meta.glob('../assets/module_configs/*.json', {
  eager: true,
})

onMounted(async () => {
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('mousemove', onMouseMove)

  // Load the manifest and the libCellML WebAssembly module.
  const [manifest, instance] = await Promise.all([loadManifest(), libcellmlReadyPromise])
  initLibCellML(instance)

  // const printPurgeUrl = false
  // if (printPurgeUrl) {
  //   console.log(getPurgedUrlForResource())
  // }

  const promises = []
  for (const [path, content] of Object.entries(cellmlModules)) {
    promises.push(loadCellMLData(content.default, path.split('/').pop(), { notify: false }))
  }

  for (const [path, content] of Object.entries(cellmlUnits)) {
    promises.push(loadCellMLData(content.default, path.split('/').pop(), { notify: false }))
  }

  // if (manifest?.modules) {
  //   for (const entry of manifest.modules) {
  //     if (printPurgeUrl) {
  //       console.log(getPurgedUrlForResource(entry.path))
  //     }
  //     promises.push(fetchAndLoadResource(entry, 'cellml module'))
  //   }
  // }

  // if (manifest?.units) {
  //   for (const entry of manifest.units) {
  //     if (printPurgeUrl) {
  //       console.log(getPurgedUrlForResource(entry.path))
  //     }
  //     promises.push(fetchAndLoadResource(entry, 'cellml units'))
  //   }
  // }

  // if (manifest?.parameters) {
  //   for (const entry of manifest.parameters) {
  //     if (printPurgeUrl) {
  //       console.log(getPurgedUrlForResource(entry.path))
  //     }
  //     promises.push(fetchAndLoadResource(entry, 'parameter file'))
  //   }
  // }

  // if (manifest?.configs) {
  //   for (const entry of manifest.configs) {
  //     if (printPurgeUrl) {
  //       console.log(getPurgedUrlForResource(entry.path))
  //     }
  //     promises.push(fetchAndLoadResource(entry, 'module config'))
  //   }
  // }

  const results = await Promise.all(promises)
  const successCount = results.filter((result) => result?.ok).length
  const failCount = results.length - successCount

  if (successCount > 0) {
    notify.success({
      title: 'Resource Loading',
      message: `Successfully loaded ${successCount} file${successCount > 1 ? 's' : ''}.`,
    })
  }

  if (failCount > 0) {
    if (successCount > 0) await nextTick()
    notify.warning({
      title: 'Resource Loading',
      message: `${failCount} file${failCount > 1 ? 's' : ''} failed to load.`,
    })
  }

  for (const [path, content] of Object.entries(moduleConfigs)) {
    libraryStore.addConfigFile(path.split('/').pop(), content.default)
  }
})

const onMouseMove = (event) => {
  mousePosition.value = { x: event.clientX, y: event.clientY }
}

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('mousemove', onMouseMove)
})

watch(
  nodes,
  () => {
    if (searchQuery.value.trim()) {
      handleSearchInput()
    }
  },
  { deep: true }
)
</script>

<style>
/* ==========================================================================
   1. App Layout, Header & Sidebar
   ========================================================================== */
.app-layout-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  background-color: var(--p-content-background);
  color: var(--p-text-color);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--p-content-border-color);
  background-color: var(--p-content-background);
}

.p-dark .app-header {
  background-color: var(--p-surface-900);
  border-bottom-color: var(--p-surface-800);
}

.file-uploads,
.file-io-buttons,
.header-right-actions {
  display: flex;
  align-items: center;
}

.report-link {
  color: var(--p-primary-color);
  font-weight: 500;
  text-decoration: none;
}

.report-link:hover {
  text-decoration: underline;
}

.app-body-container {
  display: flex;
  flex-grow: 1;
  min-height: 0;
}

/* ==========================================================================
   2. Workbench Main Canvas
   ========================================================================== */
.workbench-main {
  position: relative;
  overflow: hidden;
  padding: 0;
  flex-grow: 1;
}

/* Tutorial Slate Background for Dark Mode */
.p-dark .workbench-main {
  background-color: #2d3748;
  color: #fffffb;
}

/* Vue Flow Edges */
.vue-flow__connection-path,
.vue-flow__edge-path {
  stroke-width: 5px;
}

.vue-flow__edge.selected .vue-flow__edge-path {
  stroke: var(--p-primary-color);
  stroke-width: 7px;
}

/* ==========================================================================
   3. Vue Flow Elements (Tutorial Dark Colors)
   ========================================================================== */
/* Controls Toolbar Container */
.p-dark .vue-flow__controls {
  background-color: #333;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

/* Controls Buttons */
.p-dark .vue-flow__controls-button {
  background-color: #333;
  color: #fffffb;
  fill: #fffffb;
  border: none;
}

/* Hover & Active States (Prevents white background) */
.p-dark .vue-flow__controls-button:hover,
.p-dark .vue-flow__controls-button:active,
.p-dark .vue-flow__controls-button.active {
  background-color: #4d4d4d;
  color: #fffffb;
  fill: #fffffb;
}

/* Disabled Controls Button */
.p-dark .vue-flow__controls-button:disabled {
  background-color: #333;
  color: #fffffb;
  fill: #fffffb;
  opacity: 0.4;
}

/* Nodes */
.p-dark .vue-flow__node {
  background-color: #4a5568;
  color: #fffffb;
}

.p-dark .vue-flow__node.selected {
  background-color: #333;
  box-shadow: 0 0 0 2px #2563eb;
}

/* Edge Labels */
.p-dark .vue-flow__edge-textbg {
  fill: #292524;
}

.p-dark .vue-flow__edge-text {
  fill: #fffffb;
}

/* ==========================================================================
   4. Search Bar & Highlights
   ========================================================================== */
.workspace-search-container {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  width: 300px;
  transition: opacity 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.workspace-search-container.search-inactive {
  opacity: 0.5;
}

.workspace-search-container:hover {
  opacity: 1;
}

.workspace-search-input-wrapper {
  position: relative;
  width: 100%;
}

.workspace-search-input {
  width: 100%;
}

.workspace-search-input :deep(.p-inputtext) {
  padding-right: 28px;
}

.search-clear-icon {
  position: absolute;
  top: 50%;
  right: 0.75rem;
  transform: translateY(-50%);
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
  z-index: 1;
}

.search-clear-icon:hover {
  color: var(--p-text-color);
}

.search-match-count {
  font-size: 12px;
  color: var(--p-text-muted-color);
  padding-right: 8px;
}

.search-suffix-content {
  display: flex;
  flex-direction: column;
  background: var(--p-content-background);
  border-radius: 4px;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--p-text-color) 15%, transparent);
  overflow: hidden;
}

.search-suffix-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 4px 8px;
}

.search-nav-buttons {
  display: flex;
  gap: 2px;
}

.search-match-list {
  list-style: none;
  margin: 0;
  padding: 4px;
  max-height: 168px;
  overflow-y: auto;
  border-top: 1px solid var(--p-content-border-color, color-mix(in srgb, var(--p-text-color) 10%, transparent));
}

.search-match-item {
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--p-text-color);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-match-item:hover {
  background: color-mix(in srgb, var(--p-text-color) 6%, transparent);
}

.search-match-item.active {
  background: color-mix(in srgb, var(--p-primary-color) 15%, transparent);
  color: var(--p-primary-color);
  font-weight: 600;
}

.cursor-pointer {
  cursor: pointer;
}

.node-search-match {
  opacity: 1 !important;
  transition: opacity 0.2s ease;
  outline: 3px solid var(--p-primary-color);
  outline-offset: 2px;
  border-radius: 4px;
}

.node-search-dimmed {
  opacity: 0.25 !important;
  transition: opacity 0.2s ease;
}
</style>
