<template>
  <Dialog
    :visible="modelValue"
    :header="config.title || 'Import File'"
    :style="{ width: '500px' }"
    :modal="true"
    :closable="!isLoading"
    :draggable="false"
    @update:visible="
      (visible) => {
        if (!visible) closeDialog()
      }
    "
  >
    <div class="dialog-content">
      <div v-if="isLoading" class="loading-overlay">
        <ProgressSpinner />
        <span class="loading-text">{{ loadingText }}</span>
      </div>

      <form class="import-form" :class="{ 'is-loading-content': isLoading }">
        <div class="form-header" v-if="requiredFieldsCount > 0">
          <span class="required-asterisk">*</span> Indicates required field
        </div>

        <div v-for="field in displayFields" :key="field.key" class="field-container">
          <div class="form-item" :class="{ 'is-info': field.limit }">
            <label class="field-label">
              <span>{{ field.label }}</span>
              <span v-if="field?.required ?? true" class="required-asterisk">*</span>
            </label>

            <div class="upload-row">
              <div class="file-input-box" :class="{ 'is-valid': isFieldReady(field.key) }">
                <div class="file-names-area" @click.stop>
                  <span
                    v-if="!formState[field.key]?.files || formState[field.key]?.files.size === 0"
                    class="empty-text"
                  >
                    No file(s) selected
                  </span>
                  <template v-else>
                    <Tag
                      v-for="[filename, fileData] in [...formState[field.key].files].slice(
                        0,
                        isFieldExpanded(field.key) ? formState[field.key].files.size : MAX_VISIBLE_TAGS
                      )"
                      :key="filename"
                      :severity="fileData.isValid ? 'success' : 'warning'"
                      closable
                      @close="removeFile(field.key, filename)"
                      class="file-tag"
                    >
                      <span class="tag-content">
                        <i v-if="fileData.isValid" class="pi pi-check tag-icon" />
                        <i v-else class="pi pi-exclamation-triangle tag-icon" />
                        <span>{{ filename }}</span>
                      </span>
                    </Tag>

                    <Button
                      v-if="formState[field.key].files.size > MAX_VISIBLE_TAGS"
                      class="overflow-tag"
                      text
                      size="small"
                      severity="secondary"
                      @click.stop="toggleExpandedField(field.key)"
                    >
                      {{
                        isFieldExpanded(field.key)
                          ? 'Show less'
                          : `+${formState[field.key].files.size - MAX_VISIBLE_TAGS} more`
                      }}
                    </Button>
                  </template>
                </div>

                <div class="upload-trigger">
                  <input
                    :ref="(el) => setFileInputRef(el, field.key)"
                    type="file"
                    :multiple="!(field?.limit === 1)"
                    :accept="field.accept"
                    class="hidden-file-input"
                    @change="(event) => handleFileChange(event, field)"
                  />
                  <Button
                    :severity="isFieldReady(field.key) ? 'success' : 'primary'"
                    outlined
                    class="browse-button"
                    @click="triggerFileInput(field.key)"
                  >
                    <i class="pi" :class="isFieldReady(field.key) ? 'pi-check' : 'pi-upload'" />
                    Select
                  </Button>
                </div>
              </div>
            </div>

            <div v-if="field.limit" class="field-hint">
              <i class="pi pi-info-circle" />
              Up to {{ field.limit }} file{{ field.limit === 1 ? '' : 's' }} allowed
            </div>
          </div>
        </div>

        <div v-if="importReadiness && formState[IMPORT_KEYS.INSTANCE_ARRAY]?.readiness" class="validation-status">
          <Message v-if="importReadiness.resourcesAreLoaded" severity="success" :closable="false">
            <div class="message-title">All Required Resources Available</div>
            <div class="message-content">All necessary components and configurations are available.</div>
          </Message>

          <Message v-else severity="warn" :closable="false">
            <div class="message-title">Additional Files Required</div>
            <div class="message-content">
              <div>Please provide the following files to complete the import:</div>
              <ul class="missing-resources">
                <li v-if="importReadiness.missingResources?.math.size > 0" class="config-note">
                  <strong>CellML Component File</strong>
                  <div class="component-type-list">
                    Required components: {{ [...importReadiness.missingResources.math].join(', ') }}
                  </div>
                </li>
                <li v-if="importReadiness.missingResources?.modules.size > 0" class="config-note">
                  <strong>Module Configurations</strong> for module_types:module_subtypes:
                  {{ [...importReadiness.missingResources.modules].join(',') }} and possibly CellML components.
                </li>
              </ul>
              <div v-if="importReadiness.missingResources?.modules.size > 0" class="config-note">
                <strong>NOTE:</strong> CellML Component File(s) may be required after providing the configurations.
              </div>
            </div>
          </Message>
        </div>
      </form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Cancel" severity="secondary" text :disabled="isLoading" @click="closeDialog" />
        <Button
          label="Import"
          severity="primary"
          :disabled="!isFormValid || isLoading || !importReadiness?.resourcesAreLoaded"
          :loading="isLoading"
          @click="handleConfirm"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch, toRaw } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'

import { useLibraryStore } from '../stores/libraryStore'
import { useGtm } from '../composables/useGtm'
import { notify } from '../utils/notify'
import { IMPORT_KEYS, MAX_VISIBLE_TAGS } from '../utils/constants'
import { createDynamicFields, checkResourcesAreLoaded } from '../utils/import'
import { normaliseConfig } from '../utils/config'
import { processCellMLData } from '../utils/cellml'

const props = defineProps({
  modelValue: Boolean,
  config: {
    type: Object,
    required: true,
    default: () => ({ title: '', fields: [] }),
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])
const { trackEvent } = useGtm()
const libraryStore = useLibraryStore()

// --- State Management ---
const formState = reactive({})
const fileInputRefs = ref({})
const dynamicFields = ref([])
const importReadiness = ref(null)
const isLoading = ref(false)
const loadingText = ref('Loading...')
const expandedFields = ref(new Set())
const stagedFiles = ref({
  mathFiles: [], // { filename: string, payload: object }
  configFiles: [], // { filename: string, payload: object }
})

function handleExceed(field) {
  nextTick(() => {
    notify.warning({
      title: 'Too Many Files',
      message: `The limit is ${field.limit}.`,
    })
  })
}

function setFileInputRef(el, fieldKey) {
  if (el) {
    fileInputRefs.value[fieldKey] = el
  }
}

function triggerFileInput(fieldKey) {
  fileInputRefs.value[fieldKey]?.click()
}

function toggleExpandedField(fieldKey) {
  if (expandedFields.value.has(fieldKey)) {
    expandedFields.value.delete(fieldKey)
  } else {
    expandedFields.value.add(fieldKey)
  }
}

function isFieldExpanded(fieldKey) {
  return expandedFields.value.has(fieldKey)
}

// Handler for removing a file via the tag's close button
const removeFile = (fieldKey, filename) => {
  const fieldState = formState[fieldKey]
  if (fieldState && fieldState.files.has(filename)) {
    // Remove from local form state
    fieldState.files.delete(filename)

    // Remove from staged files if applicable
    stagedFiles.value.mathFiles = stagedFiles.value.mathFiles.filter((f) => f.filename !== filename)
    stagedFiles.value.configFiles = stagedFiles.value.configFiles.filter((f) => f.filename !== filename)

    // Re-evaluate overall module dependencies
    const instanceArrayPayload = getInstanceArrayPayload()
    if (instanceArrayPayload) {
      const resourcesLoadStatus = checkReadiness(instanceArrayPayload)
      updateDynamicFields(resourcesLoadStatus)
    } else if (fieldKey === IMPORT_KEYS.INSTANCE_ARRAY) {
      // If the user deletes the instance array file, wipe completion status
      resetForm()
    }
  }
}

function deepToRaw(value) {
  const raw = toRaw(value)
  if (raw instanceof Map) {
    return new Map([...raw].map(([k, v]) => [deepToRaw(k), deepToRaw(v)]))
  }
  if (raw instanceof Set) {
    return new Set([...raw].map(deepToRaw))
  }
  if (Array.isArray(raw)) {
    return raw.map(deepToRaw)
  }
  if (raw && typeof raw === 'object') {
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, deepToRaw(v)]))
  }
  return raw
}

const detachReactivity = (obj) => {
  return deepToRaw(obj)
}

function initFormFromConfig(fields = []) {
  fields.forEach((field) => {
    if (!formState[field.key]) {
      formState[field.key] = createEmptyFieldState()
    }
  })
}

const unstageFiles = () => {
  stagedFiles.value = {
    mathFiles: [],
    configFiles: [],
  }
}

const resetForm = (keepInstanceArray = false) => {
  resetFormState(keepInstanceArray)
  unstageFiles()

  Object.entries(fileInputRefs.value).forEach(([, input]) => {
    if (input) input.value = ''
  })
  expandedFields.value = new Set()
}

// Initialize formState when config changes
watch(
  () => props.config?.fields,
  (fields) => {
    resetFormState()
    initFormFromConfig(fields)
  },
  { immediate: true }
)

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      resetFormState()
      initFormFromConfig(props.config?.fields)
      unstageFiles()
    }
  }
)

// --- Dynamic Fields Handling ---
const displayFields = computed(() => {
  const baseFields = props.config.fields || []
  return [...baseFields, ...dynamicFields.value]
})

const requiredFieldsCount = computed(() => {
  return displayFields.value.filter((field) => field.required !== false).length
})

const syncDynamicFields = async (completionStatus) => {
  try {
    const newFields = createDynamicFields(completionStatus)
    const existingKeys = new Set(dynamicFields.value.map((f) => f.key))

    for (const newField of newFields) {
      if (!existingKeys.has(newField.key)) {
        dynamicFields.value.push(newField)
        if (!formState[newField.key]) {
          formState[newField.key] = createEmptyFieldState()
        }
      }
    }
  } catch (error) {
    console.error('Failed to create dynamic fields:', error)
  }
}

function createEmptyFieldState() {
  return {
    files: new Map(), //  [ key: filename, object: {isValid: boolean, payload: raw file contents} ]
    readiness: null, // Selected files contain enough information to complete the import
    warnings: [],
  }
}

function resetFormState(keepInstanceArray = false) {
  dynamicFields.value = []
  Object.keys(formState).forEach((key) => {
    if (!(keepInstanceArray && key === IMPORT_KEYS.INSTANCE_ARRAY)) {
      formState[key] = createEmptyFieldState()
    }
  })
  importReadiness.value = null
}

const getInstanceArrayPayload = () => {
  const instanceFiles = formState[IMPORT_KEYS.INSTANCE_ARRAY]?.files
  if (!instanceFiles || instanceFiles.size === 0) return null
  for (const fileData of instanceFiles.values()) {
    if (fileData.payload) return fileData.payload
  }
  return null
}

// Create a temporary store-like object for validation that includes staged files
const createTemporaryStore = () => {
  const availableModules = detachReactivity(libraryStore.availableModules)
  const availableMath = detachReactivity(libraryStore.availableMath)
  const availableCollections = detachReactivity(libraryStore.availableCollections)

  // Apply staged module config files
  for (const { filename, payload: configs } of stagedFiles.value.configFiles) {
    configs.forEach((config) => {
      const module = normaliseConfig(config)
      if (!availableMath.has(module.mathRef)) {
        module.isStub = true
      }
      if (!availableModules.has(module.moduleRef)) {
        availableModules.set(module.moduleRef, module)
        if (!availableCollections.has(module.mathRef)) {
          availableCollections.set(module.mathRef, new Set())
        }
        availableCollections.get(module.mathRef).add(module.moduleRef)
      }
    })
  }

  // Apply staged math files
  for (const { filename, payload } of stagedFiles.value.mathFiles) {
    payload.forEach((component) => {
      const mathRef = `${filename}:${component.name}`
      if (!availableMath.has(mathRef)) {
        availableMath.set(mathRef, component.math)
        availableCollections.get(mathRef)?.forEach((moduleRef) => {
          const moduleToUpdate = availableModules.get(moduleRef)
          if (moduleToUpdate && moduleToUpdate.isStub) {
            delete availableModules.get(moduleRef).isStub
          }
        })
      }
    })
  }

  return {
    availableModules,
    availableMath,
    availableCollections,
  }
}

const checkReadiness = (instanceArrayPayload) => {
  if (!instanceArrayPayload) return null

  const temporaryStore = createTemporaryStore()

  const resourcesLoadStatus = checkResourcesAreLoaded(instanceArrayPayload, temporaryStore)

  importReadiness.value = resourcesLoadStatus
  if (formState[IMPORT_KEYS.INSTANCE_ARRAY]) {
    formState[IMPORT_KEYS.INSTANCE_ARRAY].readiness = resourcesLoadStatus
  }

  return resourcesLoadStatus
}

const isFieldReady = (fieldKey) => {
  const fieldState = formState[fieldKey]
  if (!fieldState || fieldState.files.size === 0) return false

  const filesAllValid = Array.from(fieldState.files.values()).every((f) => f?.isValid)
  if (!filesAllValid) return false

  // Instance array field is ready if all its files are valid
  if (fieldKey === IMPORT_KEYS.INSTANCE_ARRAY) {
    return true
  }

  // Module config field is ready if all required configs have been supplied
  if (fieldKey === IMPORT_KEYS.MODULE_CONFIG) {
    return !(importReadiness.value?.missingResources?.modules.size > 0 ?? true)
  }

  // Math field is ready if all required math have been supplied - TODO - could be orange if all configs aren't yet provided
  if (fieldKey === IMPORT_KEYS.CELLML_FILE) {
    return !(importReadiness.value?.missingResources?.math.size > 0 ?? true)
  }

  return true
}

// --- Computed Validation ---
const isFormValid = computed(() => {
  if (!displayFields.value || displayFields.value.length === 0) return false

  // Strictly check if all required fields have successfully parsed their files
  return displayFields.value.every((field) => {
    if (field.required === false) return true

    const fieldState = formState[field.key]
    if (!fieldState || fieldState.files.size === 0) return false

    return Array.from(fieldState.files.values()).every((file) => file?.isValid)
  })
})

// --- Handlers ---
async function parseFile(field, rawFile) {
  if (field.requiresStore && libraryStore) {
    return field.parser(rawFile, libraryStore)
  }
  return field.parser(rawFile)
}

const handleFileChange = async (event, field) => {
  const selectedFiles = Array.from(event.target.files || [])
  if (!selectedFiles.length) return

  const limit = field?.limit
  if (limit && selectedFiles.length > limit) {
    handleExceed(field)
    selectedFiles.splice(limit)
  }

  for (const rawFile of selectedFiles) {
    const filename = rawFile.name

    if (field.processUpload === 'cellml' && !validateCellMLFilename(rawFile)) {
      continue
    }

    if (field.key === IMPORT_KEYS.INSTANCE_ARRAY) {
      const existingFiles = formState[IMPORT_KEYS.INSTANCE_ARRAY]?.files
      if (existingFiles?.size > 0 && !existingFiles.has(filename)) {
        resetForm(/* keepInstanceArray */ true)
      }
    }

    const state = formState[field.key]
    state.files.set(filename, { isValid: false, payload: null })

    try {
      const parsed = await parseFile(field, rawFile)

      state.files.get(filename).payload = parsed?.data ?? parsed // parameter files have different structure
      state.readiness = parsed?.completionStatus ?? null
      state.warnings = parsed?.completionStatus?.warnings ?? []

      if (field.processUpload) {
        stageValidatedFile(field, parsed, filename)
      }

      state.files.get(filename).isValid = true

      const instanceArrayPayload = getInstanceArrayPayload()
      if (instanceArrayPayload) {
        const status = checkReadiness(instanceArrayPayload)

        if (status && !status.resourcesAreLoaded) {
          await syncDynamicFields(status)
        }

        if (field.processUpload) {
          notifyAfterStaging(field, filename, status)
        }
      } else {
        importReadiness.value = {
          resourcesAreLoaded: true,
          errors: [],
          warnings: [],
        }
      }

      if (state.warnings.length) {
        await nextTick()
        for (const w of state.warnings) {
          notify.warning({
            title: 'Import Warning',
            message: w,
          })
        }
      }
    } catch (error) {
      const fileEntry = state.files.get(filename)
      if (fileEntry) {
        fileEntry.isValid = false
        fileEntry.payload = null
      }
      state.warnings = []

      trackEvent('import_action', {
        category: 'Import',
        action: 'import_error',
        label: field.key || 'unknown_field',
        file_type: 'various',
      })
      notify.error({
        title: 'Import Error',
        message: error.message || 'Failed to parse file.',
      })
    }
  }

  event.target.value = ''
}

async function updateDynamicFields(completionStatus) {
  importReadiness.value = completionStatus
  if (completionStatus.resourcesAreLoaded) {
    return
  }
  await syncDynamicFields(completionStatus)
}

function validateCellMLFilename(rawFile) {
  const componentFileIssues = importReadiness.value?.missingResources?.componentFileIssues
  if (!componentFileIssues?.length) return true

  const expectedFilenames = componentFileIssues.filter((issue) => issue.file).map((issue) => issue.file)

  if (expectedFilenames.length > 0 && !expectedFilenames.includes(rawFile.name)) {
    notify.error({
      title: 'Incorrect File Provided',
      message: `The configuration expects: "${expectedFilenames.join(', ')}". You provided "${
        rawFile.name
      }". This file will not be processed.`,
      duration: 6000,
    })
    return false
  }
  return true
}

async function stageValidatedFile(field, parsedData, filename) {
  if (!field.processUpload) return

  const data = parsedData

  if (field.processUpload === 'cellml') {
    const result = processCellMLData(data)
    if (result.type === 'success') {
      stagedFiles.value.mathFiles.push({
        filename,
        payload: result.components,
      })
    }
  } else if (field.processUpload === 'config') {
    stagedFiles.value.configFiles.push({
      filename,
      payload: data,
    })
  }
}

function notifyAfterStaging(field, filename, status) {
  if (!status) return

  if (field.processUpload === 'cellml') {
    const componentIssues = status.missingResources?.componentFileIssues ?? []
    const relevantIssue = componentIssues.find((issue) => issue.file === filename)

    if (relevantIssue) {
      let errorMsg = `File "${filename}" was staged but has issues.`
      if (relevantIssue.issue === 'component_not_in_file') {
        errorMsg = `"${filename}" does not contain the required components: ${relevantIssue.componentTypes.join(', ')}.`
      } else if (relevantIssue.issue === 'filename_mismatch') {
        errorMsg = `The components were found, but the file name must be exactly "${relevantIssue.expectedFile}" as defined in your config.`
      }
      notify.error({
        title: 'Import Requirement Not Met',
        message: errorMsg,
        duration: 6000,
      })
    } else if (status.needsComponentFile) {
      notify.warning({
        title: 'Partial Success',
        message: `"${filename}" is valid, but additional CellML components are still required.`,
      })
    } else {
      notify.success({
        title: 'CellML Ready',
        message: `${filename} staged successfully.`,
      })
    }
  } else if (field.processUpload === 'config') {
    if (status.needsConfigFile) {
      notify.warning({
        title: 'Config Staged',
        message: `"${filename}" added, but more configurations are still missing.`,
      })
    } else {
      notify.success({
        title: 'Success',
        message: 'All configurations provided.',
      })
    }
  }
}

const commitStagedFiles = () => {
  for (const { filename, payload } of stagedFiles.value.mathFiles) {
    libraryStore.addMathFile(filename, payload)
  }
  for (const { filename, payload } of stagedFiles.value.configFiles) {
    libraryStore.addConfigFile(filename, payload)
  }
}

const handleConfirm = async () => {
  isLoading.value = true
  loadingText.value = 'Importing modules...'

  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 50))

  commitStagedFiles()

  const importPayload = new Map()
  displayFields.value.forEach((field) => {
    const fieldFiles = toRaw(formState[field.key].files)
    if (fieldFiles.size === 0) return
    importPayload.set(field.key, new Map(fieldFiles))
  })

  trackEvent('import_action', {
    category: 'Import',
    action: 'import_file',
    label: props.config.title || 'Import File',
    file_type: 'various',
  })

  emit('confirm', importPayload, (progressText) => {
    loadingText.value = progressText
  })
}

const closeDialog = () => {
  if (isLoading.value) return
  resetForm()
  loadingText.value = 'Loading...'
  emit('update:modelValue', false)
}

defineExpose({
  finishLoading: () => {
    isLoading.value = false
    closeDialog()
  },
})
</script>

<style scoped>
.dialog-content {
  position: relative;
  min-height: 220px;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: var(--p-mask-background, rgba(0, 0, 0, 0.4));
  backdrop-filter: blur(2px);
}

.loading-text {
  color: var(--p-text-color);
  font-size: 0.95rem;
}

.field-container {
  margin-bottom: 0.75rem;
}

.upload-row {
  width: 100%;
}

.form-item {
  margin-bottom: 1rem;
}

.form-item.is-info {
  margin-bottom: 0.5rem;
}

.field-label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 600;
  margin-bottom: 0.4rem;
  color: var(--p-text-color);
}

.field-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin-top: 0.35rem;
}

.file-input-box {
  display: flex;
  align-items: stretch;
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--p-form-field-border-color, var(--p-content-border-color));
  border-radius: 6px;
  background-color: var(--p-form-field-background, var(--p-content-background));
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.file-input-box:focus-within {
  border-color: var(--p-primary-color);
  box-shadow: 0 0 0 1px var(--p-primary-color);
}

.file-input-box.is-valid {
  border-color: var(--p-green-500, #16a34a);
}

.file-input-box.is-valid:focus-within {
  box-shadow: 0 0 0 1px var(--p-green-500, rgba(22, 163, 74, 0.25));
}

.file-names-area {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  min-width: 0;
  overflow: hidden;
  cursor: default;
  flex-wrap: wrap;
}

.upload-trigger {
  flex-shrink: 0;
  border-left: 1px solid var(--p-form-field-border-color, var(--p-content-border-color));
  display: flex;
  align-items: center;
}

.hidden-file-input {
  display: none;
}

.browse-button {
  height: 100%;
  border: none;
  border-radius: 0;
  margin: 0;
  padding: 0 14px;
}

.empty-text {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  white-space: nowrap;
}

.file-tag {
  flex-shrink: 0;
}

.overflow-tag {
  flex-shrink: 0;
  cursor: pointer;
}

.tag-content {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.tag-content span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.tag-icon {
  font-size: 0.9rem;
  flex-shrink: 0;
}

.form-header {
  margin-top: 0.25rem;
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  text-align: right;
}

.required-asterisk {
  color: var(--p-red-500, #dc2626);
}

.validation-status {
  margin-top: 1rem;
}

.message-title {
  font-weight: 600;
  color: var(--p-text-color);
}

.message-content {
  margin-top: 0.25rem;
}

.missing-resources {
  margin: 0.5rem 0 0 0;
  padding-left: 1rem;
  color: var(--p-text-muted-color);
}

.missing-resources li {
  margin: 0.25rem 0;
}

.component-type-list {
  font-size: 0.8rem;
  color: var(--p-amber-500, #d97706);
}

.config-note {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: var(--p-amber-500, #d97706);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.is-loading-content {
  opacity: 0.2;
  pointer-events: none;
  filter: grayscale(40%);
  transition: opacity 0.2s ease, filter 0.2s ease;
}
</style>
