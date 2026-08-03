<template>
  <ConfirmDialog group="app-confirm">
    <template #container="{ message, acceptCallback, rejectCallback }">
      <div
        class="w-[min(92vw,420px)] rounded-lg border border-surface-200 bg-surface-0 p-6 shadow-lg dark:border-surface-700 dark:bg-surface-900"
      >
        <div class="flex items-start gap-3">
          <i :class="['text-2xl leading-none', getIcon(message.severity)]" />

          <div class="min-w-0 flex-1">
            <div class="text-lg font-semibold text-surface-900 dark:text-surface-0">
              {{ message.header }}
            </div>

            <div class="mt-2 whitespace-pre-wrap text-sm text-surface-700 dark:text-surface-300">
              {{ message.message }}
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <Button
            v-if="message.rejectLabel"
            :label="message.rejectLabel"
            severity="secondary"
            outlined
            @click="rejectCallback"
          />

          <Button
            :label="message.acceptLabel || 'OK'"
            :severity="getButtonSeverity(message.severity)"
            @click="acceptCallback"
          />
        </div>
      </div>
    </template>
  </ConfirmDialog>
</template>

<script setup lang="ts">
import ConfirmDialog from 'primevue/confirmdialog'
import Button from 'primevue/button'

function getIcon(severity?: string) {
  switch (severity) {
    case 'error':
      return 'pi pi-times-circle text-red-500'

    case 'warning':
      return 'pi pi-exclamation-triangle text-orange-500'

    case 'success':
      return 'pi pi-check-circle text-green-500'

    default:
      return 'pi pi-info-circle text-blue-500'
  }
}

function getButtonSeverity(severity?: string) {
  switch (severity) {
    case 'error':
      return 'danger'

    case 'warning':
      return 'warning'

    case 'success':
      return 'success'

    default:
      return 'primary'
  }
}
</script>
