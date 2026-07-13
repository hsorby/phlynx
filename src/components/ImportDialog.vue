<template>
  <el-dialog
    :model-value="modelValue"
    :title="config.title || 'Import File'"
    width="500px"
    @closed="closeDialog"
    @update:model-value="closeDialog"
    :close-on-click-modal="!isLoading"
    :close-on-press-escape="!isLoading"
    :show-close="!isLoading"
  >
    <div
      v-loading="isLoading"
      :element-loading-text="loadingText"
      :element-loading-svg="phlynxspinner"
      element-loading-svg-view-box="0, 0, 100, 100"
      element-loading-background="var(--el-mask-color-extra-light)"
    >
      <el-form label-position="top" :class="{ 'is-loading-content': isLoading }">
        <div class="form-header" v-if="requiredFieldsCount > 0">
          <span class="required-asterisk">*</span> Indicates required field
        </div>
        <div v-for="field in displayFields" :key="field.key" class="field-container">
          <el-form-item class="form-item" :label="field.label" :required="field?.required ?? true" :class="{ 'is-info': field.limit }">
            <div class="upload-row">
              <div class="file-input-box" :class="{ 'is-valid': isFieldReady(field.key) }">
                <div class="file-names-area" @click.stop>
                  <span v-if="!formState[field.key]?.files || formState[field.key]?.files.size === 0" class="empty-text">
                    No file(s) selected
                  </span>
                  <template v-else>
                    <el-tag
                      v-for="[filename, fileData] in [...formState[field.key].files].slice(0, MAX_VISIBLE_TAGS)"
                      :key="filename"
                      :type="fileData.isValid ? 'success' : 'warning'"
                      closable
                      @close="removeFile(field.key, filename)"
                      size="small"
                      effect="light"
                      class="file-tag"
                    >
                      <span class="tag-content">
                        <el-icon v-if="fileData.isValid" class="tag-icon"><Check /></el-icon>
                        <el-icon v-else class="tag-icon"><Warning /></el-icon>
                        <span>{{ filename }}</span>
                      </span>
                    </el-tag>

                    <el-popover
                      v-if="formState[field.key].files.size > MAX_VISIBLE_TAGS"
                      placement="bottom-start"
                      :width="280"
                      trigger="click"
                    >
                      <template #reference>
                        <el-tag size="small" type="info" effect="plain" class="overflow-tag" @click.stop>
                          +{{ formState[field.key].files.size - MAX_VISIBLE_TAGS }} more
                        </el-tag>
                      </template>
                      <div class="overflow-popover">
                        <el-tag
                          v-for="[filename, fileData] in [...formState[field.key].files].slice(MAX_VISIBLE_TAGS)"
                          :key="filename"
                          :type="fileData.isValid ? 'success' : 'warning'"
                          closable
                          @close="removeFile(field.key, filename)"
                          size="small"
                          effect="light"
                          class="overflow-popover-tag"
                        >
                          <span class="tag-content">
                            <el-icon v-if="fileData.isValid" class="tag-icon"><Check /></el-icon>
                            <el-icon v-else class="tag-icon"><Warning /></el-icon>
                            <span>{{ filename }}</span>
                          </span>
                        </el-tag>
                      </div>
                    </el-popover>
                  </template>
                </div>

                <el-upload
                  ref="uploadRefs"
                  action="#"
                  multiple
                  :limit="field?.limit"
                  :show-file-list="false"
                  :auto-upload="false"
                  :on-exceed="() => handleExceed(field)"
                  :accept="field.accept"
                  :on-change="(file) => handleFileChange(file, field)"
                  class="upload-trigger"
                >
                  <el-button
                    :type="isFieldReady(field.key) ? 'success' : 'primary'"
                    class="browse-button"
                    plain
                  >
                    <el-icon class="in-button-icon"><Check v-if="isFieldReady(field.key)" /><Upload v-else /></el-icon>
                    Select
                  </el-button>
                </el-upload>

              </div>
            </div>
            <div v-if="field.limit" class="field-hint">
              <el-icon><InfoFilled /></el-icon>
              Up to {{ field.limit }} file{{ field.limit === 1 ? '' : 's' }} allowed
            </div>
          </el-form-item>
        </div>

        <div v-if="importReadiness && formState[IMPORT_KEYS.INSTANCE_ARRAY]?.readiness" class="validation-status">
          <el-alert
            v-if="importReadiness.resourcesAreLoaded"
            title="All Required Resources Available"
            type="success"
            :closable="false"
            show-icon
          >
            <template #default> All necessary components and configurations are available. </template>
          </el-alert>

          <el-alert v-else title="Additional Files Required" type="warning" :closable="false" show-icon>
            <template #default>
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
              <br />
              <div v-if="importReadiness.missingResources?.modules.size > 0" class="config-note">
                <strong>NOTE:</strong> CellML Component File(s) may be required after providing the configurations.
              </div>
            </template>
          </el-alert>
        </div>
      </el-form>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog" :disabled="isLoading">Cancel</el-button>
        <el-button
          type="primary"
          @click="handleConfirm"
          :disabled="!isFormValid || isLoading || !importReadiness?.resourcesAreLoaded"
          :loading="isLoading"
        >
          Import
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch, toRaw } from 'vue'
import { ElDialog, ElForm, ElFormItem, ElButton, ElUpload, ElAlert, ElIcon, ElTag, ElPopover } from 'element-plus'
import { Check, Warning, Upload, InfoFilled } from '@element-plus/icons-vue'

import { useLibraryStore } from '../stores/libraryStore'
import { useGtm } from '../composables/useGtm'
import { notify } from '../utils/notify'
import { IMPORT_KEYS, MAX_VISIBLE_TAGS } from '../utils/constants'
import { createDynamicFields, checkResourcesAreLoaded } from '../utils/import'
import { normaliseConfig } from '../utils/config'
import { processCellMLData } from '../utils/cellml'
import phlynxspinner from '/src/assets/phlynxspinner.svg?raw'

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
const uploadRefs = ref([])
const dynamicFields = ref([])
const importReadiness = ref(null)
const isLoading = ref(false)
const loadingText = ref('Loading...')
const stagedFiles = ref({
  mathFiles: [], // { filename: string, payload: object }
  configFiles: [], // { filename: string, payload: object }
})

function handleExceed(field) {
  nextTick(() => {
    notify.warning({
      title: 'Too Many Files',
      message: `The limit is ${field.limit}.`
    })
  })
}

// Handler for removing a file via the tag's close button
const removeFile = (fieldKey, filename) => {
  const fieldState = formState[fieldKey]
  if (fieldState && fieldState.files.has(filename)) {
    // Remove from local form state
    fieldState.files.delete(filename)

    // Remove from staged files if applicable
    stagedFiles.value.mathFiles = stagedFiles.value.mathFiles.filter(f => f.filename !== filename)
    stagedFiles.value.configFiles = stagedFiles.value.configFiles.filter(f => f.filename !== filename)
  
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

  // Clear the visual file list in the UI components
  if (uploadRefs.value) {
    uploadRefs.value.forEach((uploadInstance) => {
      uploadInstance?.clearFiles()
    })
  }
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
      if(!(availableMath.has(module.mathRef))) {
        module.isStub = true
      }
      if(!(availableModules.has(module.moduleRef))) {
        availableModules.set(module.moduleRef, module)
        if (!(availableCollections.has(module.mathRef))) {
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
      if(!(availableMath.has(mathRef))) {
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

  // Math field is ready if all required math have been supplied - TO DO - could be orange if all configs aren't yet provided
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

    return Array.from(fieldState.files.values()).every(file => file?.isValid)
  })
})

// --- Handlers ---
async function parseFile(field, rawFile) {
  if (field.requiresStore && libraryStore) {
    return field.parser(rawFile, libraryStore)
  }
  return field.parser(rawFile)
}

const handleFileChange = async (uploadFile, field) => {
  const rawFile = uploadFile.raw
  const filename = rawFile.name

  if (field.processUpload === 'cellml' && !validateCellMLFilename(rawFile)) {
    return
  }

  if (field.key === IMPORT_KEYS.INSTANCE_ARRAY) {
    const existingFiles = formState[IMPORT_KEYS.INSTANCE_ARRAY]?.files
    if (existingFiles?.size > 0 && !existingFiles.has(filename)) {
      resetForm(/* keepInstanceArray */ true)
    }
  }

  const state = formState[field.key]
  state.files.set(filename, { isValid: false, payload: null })

  // Parse and stage ----
  try {
    const parsed = await parseFile(field, rawFile)

    state.files.get(filename).payload = parsed?.data ?? []
    state.readiness = parsed?.completionStatus ?? null
    state.warnings = parsed?.completionStatus?.warnings ?? []

    if (field.processUpload) {
      stageValidatedFile(field, parsed, filename)
    }

    // Mark valid if staging successfully completes
    state.files.get(filename).isValid = true

    // Update readiness and UI ---
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

    // Surface any per-file warnings from the parser
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

  const expectedFilenames = componentFileIssues
    .filter((issue) => issue.file)
    .map((issue) => issue.file)

  if (expectedFilenames.length > 0 && !expectedFilenames.includes(rawFile.name)) {
    notify.error({
      title: 'Incorrect File Provided',
      message: `The configuration expects: "${expectedFilenames.join(', ')}". You provided "${rawFile.name}". This file will not be processed.`,
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

  // SMELL - to update once parameter imports are implemented
  if (formState[IMPORT_KEYS.PARAMETER]) {
    for (const [filename, data] of formState[IMPORT_KEYS.PARAMETER].files) {
      if (data.isValid) {
        libraryStore.addParameterFile(filename, data.payload)
      }
    }
  }

  const importPayload = new Map()
  displayFields.value.forEach((field) => {
    for (const [filename, data] of formState[field.key].files) {
      importPayload.set(filename, data)
    }
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
.field-container {
  margin-bottom: var(--el-spacing-small);
}

.upload-row {
  width: 100%;
}

.form-item {
  margin-bottom: 32;
}

.form-item.is-info {
  margin-bottom: 0;
}

.field-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-placeholder);
  margin-bottom: 4px;
}

.field-hint .el-icon {
  font-size: 12px;
}

.file-input-box {
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 32px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  background-color: var(--el-fill-color-blank);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.file-input-box:focus-within {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
}

.file-input-box.is-valid {
  border-color: var(--el-color-success);
}

.file-input-box.is-valid:focus-within {
  box-shadow: 0 0 0 1px var(--el-color-success-light-5);
}

.file-names-area {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  min-width: 0;
  margin-bottom: 0;
  overflow: hidden;
  cursor: default;
}

.upload-trigger {
  flex-shrink: 0;
  border-left: 1px solid var(--el-border-color);
}

.upload-trigger :deep(.el-upload) {
  display: flex;
  height: 100%;
}

.browse-button {
  height: 100%;
  border: none;
  border-radius: 0;
  margin: 0;
  padding: 0 14px;
}

.empty-text {
  color: var(--el-text-color-placeholder);
  font-size: var(--el-font-size-small);
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
  font-size: 14px;
  flex-shrink: 0;
}

.overflow-popover {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.overflow-popover-tag {
  width: 100%;
}

.overflow-popover-tag :deep(.el-tag__content) {
  flex: 1;
  min-width: 0;
}

.form-header {
  margin-top: var(--el-spacing-mini);
  margin-bottom: var(--el-spacing-base);
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
  text-align: right;
}

/* .validation-status {
  margin-top: var(--el-spacing-large);
  margin-bottom: var(--el-spacing-base);
} */

.required-asterisk {
  color: var(--el-color-danger);
}

.missing-resources {
  margin: var(--el-spacing-small) 0 0 0;
  padding-left: 20px;
  color: var(--el-text-color-regular);
}

.missing-resources li {
  margin: 4px 0;
}

.issue-list-container {
  margin-top: var(--el-spacing-mini, 4px);
}

.component-issue-item {
  font-size: var(--el-font-size-extra-small);
  margin: 2px 0;
  color: var(--el-color-warning);
}

.component-issue-item::first-letter {
  color: var(--el-color-warning);
}

.component-type-list {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-warning);
}

.config-note {
  margin-top: var(--el-spacing-base);
  font-size: var(--el-font-size-small);
  color: var(--el-color-warning);
}

.in-button-icon {
  margin-right: 7px;
}

.mismatch-warning {
  margin-top: var(--el-spacing-small);
  color: var(--el-color-warning);
  font-weight: bold;
  font-size: var(--el-font-size-small);
}

:deep(.el-alert__description) {
  margin-top: 5px;
  line-height: 1.6;
}

:deep(.el-loading-spinner svg) {
  width: 120px;
  height: 120px;
  animation: breathe 2s ease-in-out infinite !important;
  transform-origin: center;
}

:deep(.el-loading-spinner) {
  transform: translateY(-35%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

:deep(.el-loading-text) {
  color: var(--el-text-color-primary);
  font-size: var(--el-font-size-base);
  margin-top: var(--el-spacing-small);
}

.is-loading-content {
  opacity: 0.2;
  pointer-events: none;
  filter: grayscale(40%);
  transition: opacity var(--el-transition-duration), filter var(--el-transition-duration);
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(0.95);
  }

  50% {
    transform: scale(1.05);
  }
}
</style>