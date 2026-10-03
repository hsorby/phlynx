<template>
  <Dialog
    :visible="modelValue"
    modal
    :dismissableMask="true"
    header="Settings"
    :style="{ width: '45rem' }"
    :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
    :closable="true"
    @update:visible="(visible) => !visible && closeDialog()"
  >
    <section class="settings-section">
      <h4>Units</h4>
      <div class="field">
        <label for="unit-display">Show units suggestions in</label>
        <Select
          v-model="draftUnitDisplay"
          inputId="unit-display"
          :options="UNIT_DISPLAY_OPTIONS"
          optionLabel="label"
          optionValue="value"
          fluid
        />
        <small class="subtle">
          Shown beside each suggestion. Built-in units follow each definition as written; nothing is worked out from
          base units.
        </small>
      </div>
    </section>

    <!-- DIALOG FOOTER -->
    <template #footer>
      <div class="flex justify-end gap-2 mt-4">
        <Button label="Cancel" text severity="secondary" @click="closeDialog" />
        <Button label="Save Changes" @click="saveChanges" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Dialog, Button, Select } from 'primevue'

import { useUnitDisplay } from '../composables/useUnitDisplay'

const props = defineProps({
  modelValue: Boolean,
})

const emit = defineEmits(['update:modelValue'])

const UNIT_DISPLAY_OPTIONS = [
  { value: 'builtIn', label: 'CellML built-in units — mV = 10⁻³ V' },
  { value: 'base', label: 'SI base units — mV = 10⁻³ kg·m²·s⁻³·A⁻¹' },
]

const { unitDisplay, setUnitDisplay } = useUnitDisplay()

// Edits wait for Save; each open starts from the saved settings.
const draftUnitDisplay = ref(unitDisplay.value)
watch(
  () => props.modelValue,
  (open) => {
    if (open) draftUnitDisplay.value = unitDisplay.value
  }
)

const closeDialog = () => {
  emit('update:modelValue', false)
}

function saveChanges() {
  setUnitDisplay(draftUnitDisplay.value)
  closeDialog()
}
</script>

<style scoped>
.settings-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  font-size: 12px;
  font-weight: 600;
}
.subtle {
  font-size: 12px;
  color: var(--p-text-muted-color, #909399);
}
</style>
