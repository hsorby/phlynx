<template>
  <Dialog
    :visible="modelValue"
    header="Simulation Settings"
    modal
    :draggable="false"
    @update:visible="
      (visible) => {
        if (!visible) closeDialog()
      }
    "
  >
    <div class="dialog-content">
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Cancel" severity="secondary" text @click="closeDialog" />
        <Button
          label="Save"
          severity="primary"
          @click="handleConfirm"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

import { notify } from '../utils/notify'

const props = defineProps({
  modelValue: Boolean,
  settings: {
    type: Object,
    required: true,
    default: () => ({ title: '', fields: [] }),
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const settingsPayload = ref({ ...props.settings })

// --- State Management ---

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
    }
  }
)

// --- Handlers ---
const handleConfirm = async () => {
  emit('confirm', settingsPayload, (progressText) => {
    loadingText.value = progressText
  })
}

const closeDialog = () => {
  emit('update:modelValue', false)
}


</script>

<style scoped>

</style>
