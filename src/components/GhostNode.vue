<template>
  <div class="ghost-node" :style="nodeStyle">
    <Card class="ghost-card" shadow="hover" style="height: 100%; box-sizing: border-box">
      <template #title>
        <div class="module-name">
          <span class="ghost-icon">👻</span>
          <span class="label truncate">Next: {{ targetNode?.data?.name || 'Unknown' }}</span>
        </div>
      </template>
      <!-- non-editable label showing CellML component and source file (no white box) -->
      <template #subtitle>
        <div class="module-label">
          <span class="label truncate">{{ ghostLabel }}</span>
        </div>
      </template>
      <!-- <button debug>Debug</button>  -->
    </Card>

    <template v-for="handle in targetHandles" :key="handle.uid" class="handle">
      <Handle
        :id="getHandleId(handle)"
        :position="handlePosition(handle.side)"
        :style="getHandleStyle(handle, targetHandles)"
        class="port-handle"
      />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

import Card from 'primevue/card'

import { useVueFlow, Handle } from '@vue-flow/core'
import { getHandleId, getHandleStyle, handlePosition } from '../utils/handles'

const props = defineProps(['id', 'data'])
const { findNode } = useVueFlow()

const ghostLabel = computed(() => {
  return `${props.data.mathRef.split(':')[1]} [${props.data.mathRef.split(':')[0]}]`
})

function debug() {
  console.log(targetNode)
}

const targetNode = computed(() => {
  if (!props.data.targetNodeId) return null
  return findNode(props.data.targetNodeId)
})

const targetHandles = computed(() => {
  return targetNode.value?.data?.handles || []
})

const nodeStyle = computed(() => {
  const node = targetNode.value

  // If we can't find dimensions yet, fallback or let content dictate size
  if (!node || !node.dimensions) {
    return {}
  }

  return {
    width: `${node.dimensions.width}px`,
    height: `${node.dimensions.height}px`,
  }
})
</script>

<style scoped>
/* Visual styling to make it look "Ghostly" */
.ghost-card {
  --p-card-color: #1f2937;
  outline: 2px dashed #ccc;
  outline-offset: -1px;
  background: rgba(255, 255, 255, 0.5);
  opacity: 0.8;
  border-radius: 8px;
  overflow: hidden;
}
.ghost-icon {
  font-size: 1.5em;
  margin-right: 5px;
}
.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  max-width: 90%; /* Prevent text from breaking the layout */
  vertical-align: middle;
}
</style>

<style lang="scss" scoped>
@import '../assets/vueflownode.css';
@import '../assets/vueflowhandle.css';
</style>
