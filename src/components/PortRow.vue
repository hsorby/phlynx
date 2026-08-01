<template>
  <div :class="['port-row', `port-row--${side}`, rowClass, { 'row--valid-target': isValidTarget }]">
    <!-- Target Side Handle -->
    <Handle
      v-if="side === 'target'"
      type="target"
      id="in"
      :position="Position.Left"
      :class="['port-handle', handleClass, { 'handle--valid-target': isValidTarget }]"
    />

    <!-- Controls Container -->
    <div class="port-controls" @mousedown.stop>
      <!-- Left actions for Target Row -->
      <template v-if="side === 'target'">
        <span class="drag-handle" @mousedown.stop="$emit('start-drag', $event)">⠿</span>
        <Button icon="pi pi-trash" severity="danger" rounded text size="small" @click="$emit('delete')" />
      </template>

      <!-- Shared Configuration Fields -->
      <Select
        v-model="port.portType"
        :options="PORT_TYPE_OPTIONS"
        optionLabel="label"
        optionValue="value"
        class="w-16"
        @change="$emit('change')"
      />

      <InputText v-model="port.label" class="w-[170px]" @input="$emit('change')" />

      <Select
        v-model="port.variables"
        :options="variables"
        optionLabel="name"
        optionValue="name"
        multiple
        class="flex-1"
        @change="$emit('change')"
      />

      <Select
        v-model="port.multiportType"
        :options="MULTIPORT_OPTIONS"
        optionLabel="label"
        optionValue="value"
        class="w-20"
        @change="$emit('change')"
      />

      <!-- Right actions for Source Row -->
      <template v-if="side === 'source'">
        <span class="drag-handle" @mousedown.stop="$emit('start-drag', $event)">⠿</span>
        <Button icon="pi pi-trash" severity="danger" rounded text size="small" @click="$emit('delete')" />
      </template>
    </div>

    <!-- Source Side Handle -->
    <Handle
      v-if="side === 'source'"
      type="source"
      id="out"
      :position="Position.Right"
      :class="['port-handle', handleClass, { 'handle--valid-target': isValidTarget }]"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { Handle, Position } from '@vue-flow/core'
import { PORT_TYPE_OPTIONS, MULTIPORT_OPTIONS, NODE_W } from '../utils/constants'

const props = defineProps({
  side: {
    type: String,
    required: true,
    validator: (v) => ['source', 'target'].includes(v),
  },
  port: {
    type: Object,
    required: true,
  },
  variables: {
    type: Array,
    default: () => [],
  },
  isConnected: {
    type: Boolean,
    default: false,
  },
  isTakenElsewhere: {
    type: Boolean,
    default: false,
  },
  isValidTarget: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['change', 'start-drag', 'delete'])

const rowClass = computed(() => {
  if (props.isConnected) return 'row--connected'
  if (props.isTakenElsewhere) {
    return props.port.multiportType && props.port.multiportType !== 'None' ? 'row--taken-multi' : 'row--taken'
  }
  return 'row--free'
})

const handleClass = computed(() => {
  if (props.isConnected) return 'handle--connected'
  if (props.isTakenElsewhere) {
    return props.port.multiportType && props.port.multiportType !== 'None' ? 'handle--taken-multi' : 'handle--taken'
  }
  return 'handle--free'
})
</script>

<style scoped>
.port-row {
  height: 44px;
  display: flex;
  align-items: center;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
  background: #fff;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  position: relative;
}
.port-row--source,
.port-row--target {
  width: v-bind('NODE_W + "px"');
}
.port-controls {
  display: flex;
  gap: 8px;
  width: 100%;
  padding: 0 10px;
  pointer-events: auto;
}
.drag-handle {
  cursor: grab;
  color: #c0c4cc;
  font-size: 16px;
  padding: 0 4px;
  user-select: none;
  line-height: 1;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}
.drag-handle:hover {
  color: #409eff;
}
.drag-handle:active {
  cursor: grabbing;
}

/* Row states */
.row--connected {
  background: #ecf5ff;
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.12);
}
.row--taken {
  background: #fdf6ec;
  border: 1px dashed #e6a23c;
  opacity: 0.8;
}
.row--taken-multi {
  background: #ffffff;
  border-color: #dcdfe6;
  opacity: 1;
}
.row--free {
  opacity: 0.55;
}
.row--free:hover,
.row--free.row--valid-target {
  opacity: 1;
  border-color: #c0c4cc;
}

/* Handles */
.port-handle {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 2px solid white;
  transition: background 0.1s ease;
}
.handle--connected {
  background: #409eff;
}
.handle--taken {
  background: #e6a23c;
}
.handle--taken-multi {
  background: #ffffff;
  border: 2px solid #c0c4cc;
}
.handle--free {
  background: #c0c4cc;
}
.handle--valid-target {
  background: #67c23a !important;
  box-shadow: 0 0 0 3px rgba(103, 194, 58, 0.35);
}
</style>
