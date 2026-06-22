<template>
  <el-dialog v-model="visible" :title="`Preview: ${moduleData?.moduleRef}`" width="800px" append-to-body>
    <el-tabs v-if="moduleData" v-model="activeTab" type="border-card">
      <el-tab-pane label="Variables & Units" name="variables">
        <el-table :data="moduleData?.variables" height="400" stripe>
          <el-table-column prop="name" label="Name" width="180" />
          <el-table-column prop="unit" label="Units" width="150" />
          <el-table-column prop="access" label="Accessability" />
          <el-table-column prop="type" label="Type">
            <template #default="{ row }">
              <el-tag size="small">{{ row.type }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="Ports" name="ports">
        <el-table
          ref="portTable"
          :data="moduleData?.ports"
          height="400"
          stripe
          style="width: 100%"
          :default-sort="{ prop: 'access', order: 'ascending' }"
        >
          <el-table-column prop="type" label="Type" width="200" sortable>
            <template #default="{ row }">
              <strong>{{ row.port_type }}</strong>
            </template>
          </el-table-column>

          <el-table-column prop="variables" label="Port Variable(s)">
            <template #default="{ row }">
              <div v-if="row.variables && row.variables.length">
                <el-tag v-for="v in row.variables" :key="v" size="small" style="margin-right: 4px">
                  {{ v }}
                </el-tag>
              </div>
              <span v-else class="text-gray">-</span>
            </template>
          </el-table-column>

          <el-table-column prop="multiport" label="Multiport" width="100">
            <template #default="{ row }">
              {{ row.multiport_type }}
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="visible = false">Close</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  moduleData: Object, // { moduleRef, variables, ports }
})

const emit = defineEmits(['update:modelValue'])

const portTable = ref(null)
const activeTab = ref('variables')

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

watch(visible, (newVal) => {
  if (newVal) {
    // Reset to first tab and top of table when opened
    activeTab.value = 'variables'
    if (portTable.value) {
      portTable.value.clearSort()
      portTable.value.setCurrentRow(null)
      // Note: I think .el-table__body-wrapper is the correct class for the scrollable div in Element Plus tables
      portTable.value.$el.querySelector('.el-table__body-wrapper').scrollTop = 0
      // Alternative if the above doesn't work:
      // nextTick(() => {
      // const wrapper = portTable.value?.$el.querySelector('.el-scrollbar__wrap')
      // if (wrapper) wrapper.scrollTop = 0
      // })
    }
  }
})

function getTypeTag(type) {
  switch (type) {
    case 'Input':
      return 'warning' // Orange for Entrance
    case 'Output':
      return 'success' // Green for Exit
    case 'General':
      return '' // Blue (default) for General
    default:
      return 'info'
  }
}
</script>
