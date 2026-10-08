<template>
  <div class="theme-editor">
    <div class="field">
      <label :for="`${uid}-name`">Theme name</label>
      <InputText :id="`${uid}-name`" v-model="draft.name" size="small" :maxlength="THEME_LIMITS.name" />
    </div>
    <div class="field">
      <label :for="`${uid}-author`">Author <span class="optional">(optional)</span></label>
      <InputText :id="`${uid}-author`" v-model="draft.author" size="small" :maxlength="THEME_LIMITS.author" />
    </div>
    <div class="field">
      <label :for="`${uid}-description`">Description <span class="optional">(optional)</span></label>
      <Textarea
        :id="`${uid}-description`"
        v-model="draft.description"
        rows="2"
        autoResize
        :maxlength="THEME_LIMITS.description"
      />
    </div>

    <div class="categories-header">
      <span class="field-label">Categories</span>
      <Button
        label="Add"
        icon="pi pi-plus"
        size="small"
        text
        :disabled="draft.categories.length >= THEME_LIMITS.categories"
        @click="addCategory"
      />
    </div>

    <ul class="category-rows">
      <li v-for="(category, index) in draft.categories" :key="category._rowId" class="category-row">
        <input
          type="color"
          class="colour-input"
          :value="safeColour(category.color)"
          v-tooltip.top="'Colour'"
          :aria-label="`${category.label || 'Category'} colour`"
          @input="category.color = $event.target.value"
        />
        <div class="category-text">
          <InputText
            v-model="category.label"
            size="small"
            placeholder="Label"
            :maxlength="THEME_LIMITS.label"
            @update:modelValue="syncKey(category)"
          />
          <span class="category-key" v-tooltip.top="category._isNew ? 'Key follows the label until saved' : 'Saved nodes refer to this key, so it cannot change'">
            {{ category.key || '—' }}
          </span>
        </div>
        <input
          v-if="category.dark !== undefined"
          type="color"
          class="colour-input colour-input--dark"
          :value="safeColour(category.dark)"
          v-tooltip.top="'Dark mode colour'"
          :aria-label="`${category.label || 'Category'} dark mode colour`"
          @input="category.dark = $event.target.value"
        />
        <Button
          icon="pi pi-moon"
          size="small"
          :text="category.dark === undefined"
          rounded
          v-tooltip.top="category.dark !== undefined ? 'Use automatic dark mode colour' : 'Set a dark mode colour'"
          @click="toggleDark(category)"
        />
        <Button
          icon="pi pi-trash"
          size="small"
          text
          rounded
          severity="danger"
          :disabled="draft.categories.length <= 1"
          v-tooltip.top="'Remove category'"
          @click="draft.categories.splice(index, 1)"
        />
      </li>
    </ul>

    <Message v-if="warnings.length" severity="warn" size="small" class="editor-message">
      Text may be hard to read on:
      <span v-for="(warning, i) in warnings" :key="`${warning.key}-${warning.scheme}`">
        {{ labelFor(warning.key) }} ({{ warning.scheme }}, {{ warning.ratio.toFixed(1) }}:1){{ i < warnings.length - 1 ? ', ' : '' }}
      </span>
    </Message>
    <Message v-if="errors.length" severity="error" size="small" class="editor-message">
      <div v-for="error in errors" :key="error">{{ error }}</div>
    </Message>

    <div class="editor-actions">
      <Button label="Cancel" size="small" text @click="emit('cancel')" />
      <Button label="Save" icon="pi pi-check" size="small" @click="save" />
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, useId } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'

import { THEME_LIMITS, contrastWarnings, isValidColour, normaliseColour, slugify } from '../utils/nodeThemes'

const props = defineProps({
  theme: {
    type: Object,
    required: true,
  },
  /** Errors from the last save attempt, reported by the parent. */
  errors: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['save', 'cancel'])

const uid = useId()
let nextRowId = 0

const draft = reactive({
  ...JSON.parse(JSON.stringify(props.theme)), // props.theme is a reactive proxy, which structuredClone rejects
  author: props.theme.author ?? '',
  description: props.theme.description ?? '',
  categories: props.theme.categories.map((category) => ({ ...category, _rowId: nextRowId++, _isNew: false })),
})

const warnings = computed(() => contrastWarnings(draft))

function safeColour(value) {
  return isValidColour(value) ? normaliseColour(value) : '#000000'
}

function labelFor(key) {
  return draft.categories.find((category) => category.key === key)?.label || key
}

function uniqueKey(stem, self) {
  const taken = new Set(draft.categories.filter((category) => category !== self).map((category) => category.key))
  let key = stem || 'category'
  for (let n = 2; taken.has(key); n++) key = `${stem || 'category'}-${n}`
  return key
}

/** New categories take their key from the label; saved ones keep theirs because nodes refer to it. */
function syncKey(category) {
  if (category._isNew) category.key = uniqueKey(slugify(category.label), category)
}

function addCategory() {
  const category = { key: '', label: '', color: '#cccccc', _rowId: nextRowId++, _isNew: true }
  category.key = uniqueKey('category', category)
  draft.categories.push(category)
}

function toggleDark(category) {
  if (category.dark === undefined) category.dark = '#333333'
  else delete category.dark
}

function save() {
  const theme = {
    ...draft,
    categories: draft.categories.map(({ _rowId, _isNew, ...category }) => category),
  }
  if (!theme.author) delete theme.author
  if (!theme.description) delete theme.description
  emit('save', theme)
}
</script>

<style scoped>
.theme-editor {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 600;
}

.optional {
  color: var(--p-text-muted-color);
  font-weight: normal;
}

.categories-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.category-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.category-text {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
}

.category-text :deep(input) {
  width: 100%;
}

.category-key {
  font-family: monospace;
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  overflow: hidden;
  text-overflow: ellipsis;
}

.colour-input {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  background: none;
  cursor: pointer;
  flex-shrink: 0;
}

.colour-input--dark {
  outline: 2px solid color-mix(in srgb, var(--p-text-color) 40%, transparent);
  outline-offset: 1px;
}

.editor-message {
  font-size: 0.75rem;
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
