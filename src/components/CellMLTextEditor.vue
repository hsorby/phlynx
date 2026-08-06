<template>
  <div class="container" ref="rootRef">
    <div class="panel">
      <div v-if="errors.length > 0" class="error-banner">
        <div v-for="(err, index) in errors" :key="index">
          <strong>Line {{ err.line }}:</strong> {{ err.message }}
        </div>
      </div>
      <div v-else class="preview-pane" ref="latexContainer"></div>

      <div class="panel">
        <h3>CellML Text</h3>
        <codemirror
          v-model="cellmlText"
          :style="{ height: '400px' }"
          :autofocus="true"
          :indent-with-tab="true"
          :tab-size="2"
          :extensions="extensions"
          @update="handleStateUpdate"
        >
        </codemirror>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark' 
import 'katex/dist/katex.min.css'

import { CellMLTextGenerator } from 'cellml-text-editor'
import { CellMLTextParser } from 'cellml-text-editor'
import { CellMLLatexGenerator } from 'cellml-text-editor'
import { cellml } from 'cellml-text-editor'

const katexPromise = import('katex')

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:code', 'save', 'ready'])

const generator = new CellMLTextGenerator()
const parser = new CellMLTextParser()
const latexGen = new CellMLLatexGenerator()

const cellmlText = ref(generator.generate(props.modelValue))
const errors = ref([])
const latexContainer = ref(null)
const rootRef = ref(null)

let debouncer = null
let currentDoc = null
let resizeObserver = null
let resizeRaf = null
const cursorLine = ref(1)
const latexPreview = ref('')

const MIN_FIT_SCALE = 0.55

// ── Dynamic Dark Mode Detection ─────────────────────────────────────────────
const isDarkMode = ref(false)
let observer = null

const checkDarkMode = () => {
  isDarkMode.value = document.documentElement.classList.contains('p-dark')
}

const handleStateUpdate = (viewUpdate) => {
  if (viewUpdate.selectionSet || viewUpdate.docChanged) {
    const state = viewUpdate.state
    const pos = state.selection.main.head
    const line = state.doc.lineAt(pos)

    cursorLine.value = line.number
    updatePreview()
  }
}

const shiftSpaceKeymap = keymap.of([
  {
    key: 'Shift-Space',
    run: (view) => {
      view.dispatch(view.state.replaceSelection(' '))
    },
  },
])

// Dynamically inject theme extensions based on light vs. dark mode
const extensions = computed(() => {
  const base = [basicSetup, cellml(), shiftSpaceKeymap]
  return isDarkMode.value ? [...base, oneDark] : base
})

const applyFitScale = () => {
  const container = latexContainer.value
  if (!container) return

  const content = container.querySelector('.katex-html')
  if (!content) return

  const containerWidth = container.clientWidth - 30
  if (containerWidth <= 0) return

  const contentWidth = content.scrollWidth

  if (contentWidth > containerWidth) {
    const rawScale = containerWidth / contentWidth
    const scale = Math.max(rawScale * 0.95, MIN_FIT_SCALE)
    content.style.transform = `scale(${scale})`
    content.style.transformOrigin = 'center center'
  } else {
    content.style.transform = 'none'
  }
}

const scheduleFitScale = () => {
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  resizeRaf = requestAnimationFrame(applyFitScale)
}

const updatePreview = async () => {
  if (!currentDoc) return

  const katex = (await katexPromise).default
  const equations = Array.from(currentDoc.getElementsByTagNameNS('*', 'apply'))

  let bestMatch = null

  for (let i = 0; i < equations.length; i++) {
    const eq = equations[i]
    if (!eq) continue

    const loc = eq.getAttribute('data-source-location')
    if (!loc) continue

    const [startStr, endStr] = loc.split('-')
    const start = parseInt(startStr || '0', 10)
    const end = endStr ? parseInt(endStr, 10) : start

    if (start > cursorLine.value) break

    if (cursorLine.value >= start && cursorLine.value <= end) {
      bestMatch = eq
      break
    }
  }

  if (bestMatch) {
    const latex = latexGen.convert(bestMatch)
    latexPreview.value = latex
    if (latexContainer.value) {
      katex.render(latex, latexContainer.value, { throwOnError: false, displayMode: true })
      nextTick(applyFitScale)
    }
  } else {
    latexPreview.value = ''
    if (latexContainer.value) latexContainer.value.innerHTML = "<span class='placeholder'>No equation selected</span>"
  }
}

const handleKeyDown = (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault()
    handleSave()
  }
}

const handleSave = () => {
  emit('save')
}

watch(cellmlText, (newText) => {
  if (debouncer) clearTimeout(debouncer)
  debouncer = setTimeout(async () => {
    try {
      const parsed = parser.parse(newText)
      errors.value = parsed.errors
      if (errors.value.length === 0 && parsed.xml) {
        currentDoc = parser['doc']
        emit('update:code', parsed.xml)
        await nextTick()
        updatePreview()
      }
    } catch (e) {
      // Do nothing for invalid syntax while typing.
    }
  }, 500)
})

onMounted(() => {
  checkDarkMode()
  observer = new MutationObserver(checkDarkMode)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  try {
    const parsed = parser.parse(cellmlText.value)
    errors.value = parsed.errors
    if (errors.value.length === 0 && parsed.xml) {
      currentDoc = parser['doc']
      updatePreview()
      emit('ready', parsed.xml)
    }
  } catch (e) {
    // Do nothing for initial syntax load
  }

  window.addEventListener('keydown', handleKeyDown)
  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(scheduleFitScale)
    resizeObserver.observe(rootRef.value)
  }
})

onUnmounted(() => {
  if (observer) observer.disconnect()
  if (resizeObserver) resizeObserver.disconnect()
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
/* Main layout container */
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  font-family: sans-serif;
  box-sizing: border-box;
  position: relative;
  background-color: var(--p-content-background, transparent);
  color: var(--p-text-color);
}

/* Panel structure for Editor */
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 12px;
  --eq-preview-height: clamp(170px, 24vh, 280px);
}

.panel h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color);
}

/* CodeMirror Base Styling */
:deep(.cm-editor) {
  flex: 1;
  border-radius: 6px;
  font-size: 14px;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background-color: var(--p-content-background);
  color: var(--p-text-color);
  border: 1px solid var(--p-content-border-color);
}

:deep(.cm-scroller) {
  border-radius: 6px;
}

/* CodeMirror Gutters */
:deep(.cm-gutters) {
  background-color: color-mix(in srgb, var(--p-content-background) 92%, var(--p-text-color));
  color: var(--p-text-muted-color);
  border-right: 1px solid var(--p-content-border-color);
}

:deep(.cm-activeLine) {
  background-color: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
}

:deep(.cm-activeLineGutter) {
  background-color: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  color: var(--p-text-color);
}

:deep(.cm-cursor) {
  border-left-color: var(--p-text-color);
}

:deep(.cm-content) {
  tab-size: 4;
}

.cm-line {
  white-space: pre-wrap !important;
}

/* LaTeX Preview Area - Adapts to Dark Mode */
.preview-pane {
  height: var(--eq-preview-height);
  padding: 15px;
  background-color: color-mix(in srgb, var(--p-content-background) 96%, var(--p-text-color));
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4em;
  overflow: auto;
  color: var(--p-text-color);
  scrollbar-width: thin;
}

.preview-pane::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.preview-pane::-webkit-scrollbar-thumb {
  background-color: var(--p-content-border-color);
  border-radius: 4px;
}

.preview-pane::-webkit-scrollbar-track {
  background: transparent;
}

.preview-pane :deep(.katex) {
  color: var(--p-text-color) !important;
}

.preview-pane :deep(.katex-display) {
  margin: 0;
}

.preview-pane :deep(.katex-html) {
  display: inline-block;
}

.placeholder {
  color: var(--p-text-muted-color);
  font-style: italic;
  font-size: 0.85em;
}

/* Error Banner styling for Light/Dark Mode */
.error-banner {
  background-color: color-mix(in srgb, var(--p-red-500, #ef4444) 15%, var(--p-content-background));
  color: var(--p-red-400, #f87171);
  padding: 10px 15px;
  border: 1px solid color-mix(in srgb, var(--p-red-500, #ef4444) 35%, transparent);
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85em;
  height: var(--eq-preview-height);
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow-y: auto;
}

/* ==========================================================================
   CodeMirror Dark Mode Overrides (Selection, Gutters, Tokens)
   ========================================================================== */

:root.p-dark :deep(.cm-editor),
:root.dark :deep(.cm-editor) {
  background-color: #1e1e2e !important;
  color: #cdd6f4 !important;
}

:root.p-dark :deep(.cm-focused .cm-selectionBackground),
:root.p-dark :deep(.cm-selectionBackground),
:root.dark :deep(.cm-selectionBackground) {
  background-color: rgba(69, 71, 90, 0.7) !important;
}

:root.p-dark :deep(.cm-gutters),
:root.dark :deep(.cm-gutters) {
  background-color: #181825 !important;
  color: #6c7086 !important;
  border-right: 1px solid #313244 !important;
}

:root.p-dark :deep(.cm-cursor),
:root.dark :deep(.cm-cursor) {
  border-left-color: #f5e0dc !important;
}

/* Syntax Highlighting Token Overrides */
:root.p-dark :deep(.cm-editor),
:root.dark :deep(.cm-editor) {
  .tok-keyword, .cm-keyword { color: #f38ba8 !important; font-weight: 600; }
  .tok-string, .cm-string { color: #a6e3a1 !important; }
  .tok-number, .cm-number, .tok-atom, .cm-atom { color: #fab387 !important; }
  .tok-comment, .cm-comment { color: #6c7086 !important; font-style: italic; }
  .tok-operator, .cm-operator, .tok-punctuation, .cm-punctuation { color: #89dceb !important; }
  .tok-variableName, .cm-variableName { color: #cdd6f4 !important; }
  .tok-typeName, .cm-typeName, .tok-className, .cm-className { color: #94e2d5 !important; }
  .tok-propertyName, .cm-propertyName, .tok-attributeName, .cm-attributeName { color: #89b4fa !important; }
}
</style>
