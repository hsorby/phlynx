<template>
  <div class="mlc" :class="{ 'is-dragging': isDragging }">

    <!-- Sticky search -->
    <div class="mlc__search">
      <el-input
        v-model="filterText"
        placeholder="Search Library…"
        clearable
        :prefix-icon="Search"
        size="default"
      />
    </div>

    <!-- Collections -->
    <div ref="scrollEl" class="mlc__scroll">
      <template v-if="filteredCollections.length > 0">
        <div
          v-for="collection in filteredCollections"
          :key="collection.componentFile"
          class="mlc__group"
        >
          <!-- Group header -->
          <button
            class="mlc__group-header"
            :class="{ 'is-open': activeCollapseNames.includes(collection.componentFile) }"
            @click="toggleGroup(collection.componentFile)"
          >
            <el-icon class="mlc__group-chevron"><ArrowRight /></el-icon>
            <span class="mlc__group-name"><span class="mlc__group-name-text">{{ collection.label }}</span></span>
            <el-tag size="small" type="info" effect="plain" round class="mlc__group-count">
              {{ collection.cards.length }}
            </el-tag>
          </button>

          <!-- Module cards -->
          <transition name="slide">
            <div v-show="activeCollapseNames.includes(collection.componentFile)" class="mlc__group-body">
              <el-card
                v-for="card in collection.cards"
                :key="card.cardKey"
                class="mlc__card"
                :class="{
                  'mlc__card--selectable': selectable,
                  'mlc__card--stub': activeModule(card).isStub,
                  'mlc__card--draggable': !selectable && !activeModule(card).isStub,
                }"
                shadow="never"
                :body-style="{ padding: '0' }"
                :draggable="!selectable && !activeModule(card).isStub"
                @dragstart="handleDragStart($event, activeModule(card))"
                @dragend="handleDragEnd"
                @click="selectable && handleSelect(activeModule(card))"
              >
                <div class="mlc__card-inner">
                  <div class="mlc__card-body">
                    <!-- Name + actions row -->
                    <div class="mlc__card-header">
                      <span class="mlc__card-name">{{ card.label }}</span>
                      <div class="mlc__card-actions">
                        <el-tag
                          size="small"
                          type="primary"
                          effect="light"
                          round
                          class="mlc__badge"
                        >
                          {{ card.modules?.length }} module{{ card.modules?.length !== 1 ? 's' : '' }}
                        </el-tag>
                        <el-tooltip
                          v-if="activeModule(card).moduleRef"
                          content="Preview configuration"
                          placement="top"
                          :auto-close="TOOLTIP_AUTO_CLOSE"
                        >
                          <el-button
                            class="mlc__preview-btn"
                            size="small"
                            circle
                            :icon="View"
                            @click.stop="openPreview(activeModule(card))"
                          />
                        </el-tooltip>
                      </div>
                    </div>

                    <!-- Subtype selector - switches which module this card currently represents -->
                    <div
                      class="mlc__config-row"
                      @click.stop
                    >
                      <el-select
                        :model-value="selectedModuleIndex[card.cardKey] ?? 0"
                        @update:model-value="(val) => selectedModuleIndex[card.cardKey] = val"
                        size="small"
                        class="mlc__config-select"
                      >
                        <el-option
                          v-for="(module, index) in card.modules"
                          :key="module.moduleRef"
                          :label="module.moduleRef"
                          :value="index"
                        />
                      </el-select>
                    </div>

                    <!-- Config selector - configs belonging to whichever module is currently active -->
                    <div
                      v-if="!selectable && activeModule(card).configs && activeModule(card).configs.length > 1"
                      class="mlc__config-row"
                      @click.stop
                    >
                      <el-select
                        v-model="selectedConfigs[activeModule(card).moduleRef]"
                        size="small"
                        class="mlc__config-select"
                      >
                        <el-option
                          v-for="(config, index) in activeModule(card).configs"
                          :key="index"
                          :label="configLabel(config) || `Config ${index + 1}`"
                          :value="index"
                        />
                      </el-select>
                    </div>
                  </div>
                </div>
              </el-card>
            </div>
          </transition>
        </div>
      </template> 

      <!-- Empty state -->
      <el-empty
        v-else
        :description="filterText ? `No modules match '${filterText}'` : 'No modules found'"
        :image-size="72"
      /> 
    </div> 

    <ModulePreviewDialog v-model="showPreview" :module-data="previewTarget" />
  </div>
</template>

<script setup>
import { computed, ref, watch, reactive, onMounted, onBeforeUnmount } from 'vue'
import { View, Search, ArrowRight } from '@element-plus/icons-vue'
import { useLibraryProxyStore } from '../stores/libraryProxyStore'
import { useLibraryStore } from '../stores/libraryStore'
import useDragAndDrop from '../composables/useDnD'
import ModulePreviewDialog from './ModulePreviewDialog.vue'
import { TOOLTIP_AUTO_CLOSE } from '../utils/constants'

const props = defineProps({
  selectable: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

const view = useLibraryProxyStore()
const store = useLibraryStore()
const { onDragStart } = useDragAndDrop()

const filterText = ref('')
const activeCollapseNames = ref([])
const selectedModuleIndex = reactive({})
const selectedConfigs = reactive({})
const showPreview = ref(false)
const previewTarget = ref(null)
const isDragging = ref(false)
const scrollEl = ref(null)

function blockScroll(e) {
  if (isDragging.value) e.preventDefault()
}

onMounted(() => {
  scrollEl.value?.addEventListener('wheel', blockScroll, { passive: false })
})

onBeforeUnmount(() => {
  scrollEl.value?.removeEventListener('wheel', blockScroll)
})

// ─── Filtering ────────────────────────────────────────────────────────────────

const filteredCollections = computed(() => {
  const q = filterText.value.toLowerCase().trim()
  if (!q) return view.groups

  return view.groups
    .map((group) => ({
      ...group,
      cards: group.cards.filter((card) => group.label.toLowerCase().includes(q) || cardMatches(card, q)),
    }))
    .filter((group) => group.cards.length > 0)
})

function cardMatches(card, q) {
  if (card.label.toLowerCase().includes(q)) return true
  return card.modules.some(
    (module) =>
      (module.moduleSubtype ?? '').toLowerCase().includes(q) || module.moduleRef.toLowerCase().includes(q)
  )
}

// ─── Accordion ───────────────────────────────────────────────────────────────

function toggleGroup(componentFile) {
  const idx = activeCollapseNames.value.indexOf(componentFile)
  if (idx === -1) activeCollapseNames.value.push(componentFile)
  else activeCollapseNames.value.splice(idx, 1)
}

// ─── Config helpers ───────────────────────────────────────────────────────────

function configLabel(config) {
  if (!config) return ''
  return [config.module_type, config.module_subtype].filter(Boolean).join(' - ')
}

// ─── Module helpers ────────────────────────────────────────────────────────────

// Each card can represent several moduleRef "subtype" siblings (e.g. elastance:linear,
// elastance:polynomial). This resolves which one is currently selected for the card,
// defaulting to the first module until the user picks otherwise.
function activeModule(card) {
  const index = selectedModuleIndex[card.cardKey] ?? 0
  return card.modules[index] ?? card.modules[0]
}

// ─── Drag & Drop ──────────────────────────────────────────────────────────────

function handleDragStart(event, module) {
  if (props.selectable) return
  isDragging.value = true
  event.dataTransfer.effectAllowed = 'copy'
  const configIndex = selectedConfigs[module.moduleRef] ?? 0
  onDragStart(event, { ...module, configIndex })
}

function handleDragEnd() {
  isDragging.value = false
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function openPreview(module) {
  previewTarget.value = {
    moduleRef: module.moduleRef,
    ports: module.ports,
    variables: module.variables,
  }
  showPreview.value = true
}

// ─── Selection ────────────────────────────────────────────────────────────────

function handleSelect(module) {
  if (props.selectable) emit('select', module)
}
</script>

<style scoped>
/* ── Tokens ──────────────────────────────────────────────────────────────────── */
.mlc {
  --mlc-bg:           #f5f7fa;
  --mlc-surface:      #ffffff;
  --mlc-border:       #e4e7ed;
  --mlc-border-hover: #c0c4cc;
  --mlc-accent:       var(--el-color-primary, #409eff);
  --mlc-accent-light: var(--el-color-primary-light-9, #ecf5ff);
  --mlc-text-primary: #303133;
  --mlc-text-regular: #606266;
  --mlc-text-muted:   #c0c4cc;
  --mlc-radius:       6px;
  --mlc-transition:   140ms ease;
}

/* ── Layout ──────────────────────────────────────────────────────────────────── */
.mlc {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--mlc-bg);
}

/* During drag, block pointer interactions on the list but keep overflow-y unchanged
   (toggling overflow-y causes a layout shift as the scrollbar appears/disappears).
   Scroll is blocked via a wheel event listener in script instead. */
.mlc.is-dragging .mlc__scroll {
  pointer-events: none;
}
.mlc.is-dragging .mlc__card--draggable {
  pointer-events: auto;
}

/* ── Search bar ──────────────────────────────────────────────────────────────── */
.mlc__search {
  padding: 10px 10px 8px;
  border-bottom: 1px solid var(--mlc-border);
  flex-shrink: 0;
  background: var(--mlc-surface);
}

/* ── Scroll container ────────────────────────────────────────────────────────── */
.mlc__scroll {
  flex: 1 1 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 0 12px;
  scrollbar-width: thin;
  scrollbar-color: var(--mlc-border) transparent;
}
.mlc__scroll::-webkit-scrollbar { width: 4px; }
.mlc__scroll::-webkit-scrollbar-thumb {
  background: var(--mlc-border);
  border-radius: 2px;
}

/* ── Group ───────────────────────────────────────────────────────────────────── */
.mlc__group { margin-bottom: 2px; }

.mlc__group-header {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  width: calc(100% - 12px);
  margin: 0 6px;
  padding: 5px 8px;
  background: none;
  border: none;
  border-radius: var(--mlc-radius);
  cursor: pointer;
  color: var(--mlc-text-regular);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: left;
  transition: color var(--mlc-transition), background var(--mlc-transition);
}
.mlc__group-header:hover {
  color: var(--mlc-text-primary);
  background: var(--mlc-border);
}
.mlc__group-header.is-open {
  color: var(--mlc-accent);
  background: var(--mlc-accent-light);
}

.mlc__group-chevron {
  flex-shrink: 0;
  font-size: 12px;
  margin-top: 1px;
  transform: rotate(0deg);
  transition: transform var(--mlc-transition);
}
.mlc__group-header.is-open .mlc__group-chevron {
  transform: rotate(90deg);
}

.mlc__group-name {
  flex: 1;
  min-width: 0;
}

.mlc__group-name-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
  overflow-wrap: normal;
  word-break: normal;
  line-height: 1.4;
}

.mlc__group-count {
  flex-shrink: 0;
  margin-top: 2px; /* optical alignment with first text line */
  font-variant-numeric: tabular-nums;
  /* Ensure the badge always has room and is never overlapped by the name */
  align-self: flex-start;
}

/* ── Slide transition ────────────────────────────────────────────────────────── */
.mlc__group-body {
  padding: 4px 8px 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.slide-enter-active,
.slide-leave-active { transition: opacity 130ms ease, transform 130ms ease; }
.slide-enter-from,
.slide-leave-to     { opacity: 0; transform: translateY(-4px); }

/* ── Module card ─────────────────────────────────────────────────────────────── */
.mlc__card {
  border: 1px solid var(--mlc-border) !important;
  border-radius: var(--mlc-radius) !important;
  background: var(--mlc-surface) !important;
  transition: border-color var(--mlc-transition), box-shadow var(--mlc-transition) !important;
  user-select: none;
}

.mlc__card--draggable { cursor: grab; }
.mlc__card--draggable:active { cursor: grabbing; }
.mlc__card--selectable { cursor: pointer; }
.mlc__card--stub { opacity: 0.45; cursor: not-allowed; pointer-events: none; }

.mlc__card--draggable:hover,
.mlc__card--selectable:hover {
  border-color: var(--mlc-accent) !important;
  box-shadow: 0 0 0 2px var(--mlc-accent-light), 0 2px 6px rgba(0,0,0,0.06) !important;
}

/* ── Card inner layout ───────────────────────────────────────────────────────── */
.mlc__card-inner {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

/* ── Grip ────────────────────────────────────────────────────────────────────── */
.mlc__grip {
  padding: 9px 0 9px 8px;
  color: var(--mlc-text-muted);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--mlc-transition);
}
.mlc__card--draggable:hover .mlc__grip { opacity: 1; }

/* ── Card body ───────────────────────────────────────────────────────────────── */
.mlc__card-body {
  flex: 1;
  min-width: 0;
  padding: 8px 8px 8px 0;
}
.mlc__card-inner:not(:has(.mlc__grip)) .mlc__card-body { padding-left: 10px; }

.mlc__card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.mlc__card-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  color: var(--mlc-text-primary);
}

.mlc__card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

/* Preview button always visible */
.mlc__preview-btn {
  opacity: 1;
}

/* ── Config row ──────────────────────────────────────────────────────────────── */
.mlc__config-row { margin-top: 6px; }

.mlc__config-select { width: 100%; }
</style>