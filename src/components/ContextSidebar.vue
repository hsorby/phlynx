<template>
  <div class="resizable-context-panel">
    <div
      class="resize-handle"
      :class="{ 'resize-handle--disabled': isCollapsed }"
      @mousedown="!isCollapsed && startResize($event)"
    >
      <button
        type="button"
        class="aside-collapse-toggle"
        @mousedown.stop
        @click="toggleCollapsed"
        v-tooltip.left="isCollapsed ? 'Show context panel' : 'Hide context panel'"
      >
        <i :class="isCollapsed ? 'pi pi-chevron-left' : 'pi pi-chevron-right'"></i>
      </button>
    </div>

    <aside
      :style="{ width: isCollapsed ? '0px' : width + 'px' }"
      class="context-aside"
      :class="{ 'context-aside--collapsed': isCollapsed }"
    >
      <div class="context-aside-content">
        <!-- ── Top subsection: global functions & constants ──────────────── -->
        <section class="context-section context-section--global">
          <button
            type="button"
            class="context-section-header"
            @click="isGlobalCollapsed = !isGlobalCollapsed"
            :aria-expanded="!isGlobalCollapsed"
          >
            <i :class="['pi', isGlobalCollapsed ? 'pi-chevron-right' : 'pi-chevron-down', 'context-section-caret']"></i>
            <h4 class="context-section-title">Global information</h4>
          </button>

          <div v-show="!isGlobalCollapsed" class="context-section-body">
            <Button
              label="New System Module"
              icon="pi pi-plus"
              size="small"
              outlined
              class="new-system-module-btn"
              @click="handleCreateSystemModule"
            />

            <div class="global-constants">
              <label class="context-subheading">
                Global Constants
                <span class="context-count">({{ globalConstantRows.length }})</span>
              </label>

              <div v-if="globalConstantRows.length === 0" class="empty-hint">
                No global constants defined yet.
              </div>

              <div v-else class="table-flex-wrapper" style="margin-top: 0.5rem;">
                <DataTable
                  :value="globalConstantRows"
                  dataKey="name"
                  scrollable
                  scrollHeight="flex"
                  class="p-datatable-sm parameters-table"
                  :rowClass="(row) => newlyAddedNames.has(row.name) ? 'global-constant-row--new' : ''"
                >
                  <Column field="name" bodyClass="small-text-col" header="Name" style="min-width: 90px">
                    <template #body="slotProps">
                      <span :title="slotProps.data.name">{{ slotProps.data.name }}</span>
                    </template>
                  </Column>
                  
                  <Column field="value" header="Value" style="width: 110px">
                    <template #body="slotProps">
                      <InputText
                        v-model="slotProps.data.value"
                        size="small"
                        class="w-full"
                        placeholder="Value..."
                        @change="handleGlobalConstantChange(slotProps.data)"
                      />
                    </template>
                  </Column>
                  
                  <Column field="units" bodyClass="small-text-col" header="Units" style="min-width: 80px">
                    <template #body="slotProps">
                      <span :title="slotProps.data.units">{{ slotProps.data.units || '—' }}</span>
                    </template>
                  </Column>
                </DataTable>
              </div>
            </div>
          </div>
        </section>

        <Divider class="context-divider" />

        <!-- ── Lower subsection: parameters of the selected node ──────────── -->
        <section class="context-section context-section--params">
          <template v-if="selectedNode">
            <h4 class="context-section-title">
              {{ `${selectedNode.data?.name}` || 'Selected Instance' }}
              <span class="context-count">({{ parameterRows.length }})</span>
            </h4>

            <div v-if="parameterRows.length === 0" class="empty-hint">
              This instance has no parameters.
            </div>

            <div v-else class="table-flex-wrapper">
              <DataTable
                :value="parameterRows"
                dataKey="name"
                scrollable
                scrollHeight="flex"
                class="p-datatable-sm parameters-table"
              >
                <Column field="name" bodyClass="small-text-col" header="Name" style="min-width: 90px" />
                <Column field="value" header="Value" style="width: 110px">
                  <template #body="slotProps">
                    <InputText
                      v-if="isEditableVariableType(slotProps.data.type)"
                      v-model="slotProps.data.value"
                      size="small"
                      placeholder="Enter value..."
                      class="w-full"
                      @change="handleParameterValueChange"
                    />
                    <span v-else class="text-muted">-</span>
                  </template>
                </Column>
                <Column field="units" bodyClass="small-text-col" header="Units" style="min-width: 80px" />
                <Column field="type" header="Type" style="width: 100px">
                  <template #body="slotProps">
                    <Select
                      v-model="slotProps.data.type"
                      :options="PARAMETER_TYPE_OPTIONS"
                      optionLabel="label"
                      optionValue="value"
                      size="small"
                      class="w-full"
                      @change="handleParameterTypeChange(slotProps.data)"
                    />
                  </template>
                </Column>
              </DataTable>
            </div>
          </template>

          <div v-else class="empty-state">
            <i class="pi pi-info-circle empty-state-icon"></i>
            <p>Select an instance to edit its parameters here.</p>
          </div>
        </section>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useVueFlow } from '@vue-flow/core'

import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Divider from 'primevue/divider'

import { useResizableAside } from '../composables/useResizableAside'
import { useLibraryStore } from '../stores/libraryStore'
import { detachReactivity } from '../utils/reactivity'
import { isEditableVariableType } from '../utils/variables'
import { PARAMETER_TYPE_OPTIONS, FLOW_IDS } from '../utils/constants'
import { notify } from '../utils/notify'

const props = defineProps({
  initialWidth: {
    type: Number,
    default: 320,
  },
  minWidth: {
    type: Number,
    default: 260,
  },
  maxWidth: {
    type: Number,
    default: 480,
  },
})

const { width, startResize } = useResizableAside(props.initialWidth, props.minWidth, props.maxWidth, 'right')
const isCollapsed = ref(false)

function toggleCollapsed() {
  isCollapsed.value = !isCollapsed.value
}

const libraryStore = useLibraryStore()
const isGlobalCollapsed = ref(false)

const { getSelectedNodes, updateNodeData } = useVueFlow(FLOW_IDS.MAIN)

const selectedNode = computed(() => getSelectedNodes.value[0] || null)

// ── Global constants (top subsection) ───────────────────────────────────────
const globalConstantRows = ref([])
const newlyAddedNames = ref(new Set())

let hasInitialisedGlobalConstants = false
let highlightTimeoutId = null

watch(
  () => libraryStore.globalVariables,
  (map) => {
    const previousNames = new Set(globalConstantRows.value.map((row) => row.name))

    globalConstantRows.value = Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        value: data?.value,
        units: data?.units,
        data_reference: data?.data_reference,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    if (!hasInitialisedGlobalConstants) {
      hasInitialisedGlobalConstants = true
      return
    }

    const addedNames = Array.from(map.keys()).filter((name) => !previousNames.has(name))
    if (addedNames.length === 0) return

    isGlobalCollapsed.value = false
    newlyAddedNames.value = new Set(addedNames)

    clearTimeout(highlightTimeoutId)
    highlightTimeoutId = setTimeout(() => {
      newlyAddedNames.value = new Set()
    }, 2200)
  },
  { immediate: true, deep: true }
)

function handleGlobalConstantChange(row) {
  libraryStore.assignGlobalConstant(row.name, row.value, row.units, row.data_reference)
}

onUnmounted(() => {
  clearTimeout(highlightTimeoutId)
})

function handleCreateSystemModule() {
  // Placeholder only for now - system module creation isn't wired up yet.
  notify.success({ message: 'System module creation is coming soon.' })
}

// ── Selected node parameters (lower subsection) ─────────────────────────────
const parameterRows = ref([])

watch(
  selectedNode,
  (node) => {
    if (!node) {
      parameterRows.value = []
      return
    }

    parameterRows.value = detachReactivity(node.data?.variables || []).map((row) => ({
      name: row.name,
      value: row.type === 'global_constant' ? libraryStore.getGlobalConstant(row.name)?.value : row.value,
      units: row.units,
      type: row.type,
      access: row.access,
      data_reference: row.data_reference,
    }))
  },
  { immediate: true }
)

function persistParameterRows() {
  if (!selectedNode.value) return

  parameterRows.value.forEach((row) => {
    if (row.type === 'global_constant') {
      libraryStore.assignGlobalConstant(row.name, row.value, row.units, row.data_reference)
    }
  })

  updateNodeData(selectedNode.value.id, { variables: detachReactivity(parameterRows.value) })
}

function handleParameterValueChange() {
  persistParameterRows()
}

function handleParameterTypeChange(row) {
  // If a row just became a global constant, pull in whatever value is
  // already shared globally for that name instead of keeping the stale one.
  if (row.type === 'global_constant') {
    row.value = libraryStore.getGlobalConstant(row.name)?.value ?? row.value
  }
  persistParameterRows()
}
</script>

<style scoped>
.resizable-context-panel {
  display: flex;
  flex-shrink: 0;
  min-height: 0;
  height: 100%;
}

.resize-handle {
  position: relative;
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  background-color: var(--p-content-border-color);
  transition: background-color 120ms ease;
}

.resize-handle:hover {
  background-color: var(--p-primary-color);
}

.resize-handle--disabled {
  cursor: default;
}

.aside-collapse-toggle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--p-content-border-color);
  border-radius: 50%;
  background: var(--p-content-background);
  color: var(--p-text-muted-color);
  font-size: 10px;
  cursor: pointer;
  z-index: 2;
  transition: color 120ms ease, border-color 120ms ease;
}

.aside-collapse-toggle:hover {
  color: var(--p-primary-color);
  border-color: var(--p-primary-color);
}

.context-aside {
  background-color: var(--p-content-background);
  border-left: 1px solid var(--p-content-border-color);
  padding: 1rem;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--p-text-color) 15%, transparent);
  transition: width 160ms ease, padding 160ms ease;
}

.context-aside--collapsed {
  padding: 0;
  border-left: none;
}

.context-aside-content {
  height: 100%;
  min-height: 0;
  min-width: v-bind('props.minWidth + "px"');
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.context-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.context-section--global {
  flex-shrink: 0;
  max-height: 45%;
}

.context-section--params {
  flex: 1 1 auto;
  min-height: 0;
}

.context-section-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0; 
}

.context-section-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding-bottom: 0.75rem; 
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  color: inherit;
  font: inherit;
}

.context-section-header .context-section-title {
  margin: 0; 
}

.context-section-caret {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  transition: color 120ms ease;
}

.context-section-header:hover .context-section-caret {
  color: var(--p-primary-color);
}

.context-section-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.context-count {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--p-text-muted-color);
}

.context-divider {
  margin: 1rem 0;
  flex-shrink: 0;
}

.new-system-module-btn {
  width: 100%;
  padding: 3%;
  margin-bottom: 0.85rem;
}

.new-system-module-btn :deep(.p-button-label) {
  transform: translateY(1px); 
}

.context-subheading {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  margin-bottom: 0.4rem;
}

.global-constants {
  min-height: 0;
  overflow-y: auto;
}

:deep(.global-constant-row--new > td) {
  animation: global-constant-row-highlight 2.2s ease;
}

@keyframes global-constant-row-highlight {
  0% {
    background-color: color-mix(in srgb, var(--p-primary-color) 25%, transparent);
  }
  100% {
    background-color: transparent;
  }
}

.empty-hint {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex: 1 1 auto;
  text-align: center;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  padding: 1rem 0.5rem;
}

.empty-state-icon {
  font-size: 1.5rem;
  opacity: 0.6;
}

.table-flex-wrapper {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}

.parameters-table {
  width: 100%;
  font-size: 0.78rem;
}

.parameters-table :deep(.p-datatable-wrapper) {
  height: 100%;
}

.parameters-table :deep(.p-datatable-thead > tr > th) {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.4rem 0.5rem;
}

.parameters-table :deep(.p-datatable-tbody > tr > td) {
  font-size: 0.78rem;
  padding: 0.3rem 0.5rem;
}

.parameters-table :deep(.p-inputtext),
.parameters-table :deep(.p-select-label) {
  font-size: 0.78rem;
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}

.w-full {
  width: 100%;
}

.text-muted {
  color: var(--p-text-muted-color);
}
</style>
