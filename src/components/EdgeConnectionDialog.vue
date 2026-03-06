<template>
  <el-dialog
    :model-value="modelValue"
    width="1200px"
    top="4vh"
    teleported
    :show-close="false"
    @closed="onClosed"
    @update:model-value="$emit('update:modelValue', $event)"
    @wheel.stop
  >
    <!-- Custom header -->
    <template #header>
      <div class="dialog-header">
        <div class="dialog-title">
          <span class="title-icon">⇌</span>
          <span>Port Connections</span>
        </div>
        <div class="node-names" v-if="sourceNode && targetNode">
          <span class="node-badge source-badge">{{ sourceNode.data.name }}</span>
          <span class="arrow-sep">→</span>
          <span class="node-badge target-badge">{{ targetNode.data.name }}</span>
        </div>
      </div>
    </template>

    <div v-if="sourceNode && targetNode" class="root">

      <!-- Column headers -->
      <div class="col-headers">
        <div class="col-header-label source-side">
          <span class="side-label">SOURCE</span>
          <div class="col-subheaders">
            <span style="width:64px">Type</span>
            <span style="width:170px">Label</span>
            <span style="flex:1">Variables</span>
            <span style="width:80px">Multi</span>
            <span style="width:28px"></span>
          </div>
        </div>
        <div class="mid-spacer"></div>
        <div class="col-header-label target-side">
          <span class="side-label">TARGET</span>
          <div class="col-subheaders">
            <span style="width:28px"></span>
            <span style="width:64px">Type</span>
            <span style="width:170px">Label</span>
            <span style="flex:1">Variables</span>
            <span style="width:80px">Multi</span>
          </div>
        </div>
      </div>

      <!-- VueFlow canvas -->
      <div class="flow-canvas" :style="{ height: canvasHeight + 'px' }">
        <VueFlow
          :id="FLOW_ID"
          :nodes="flowNodes"
          :edges="flowEdges"
          :nodes-draggable="false"
          :nodes-connectable="true"
          :elements-selectable="false"
          :pan-on-drag="false"
          :pan-on-scroll="false"
          :auto-pan-on-node-drag="false"
          :auto-pan-on-connect="false"
          :zoom-on-scroll="false"
          :zoom-on-pinch="false"
          :zoom-on-double-click="false"
          :edges-updatable="true"
          :auto-connect="false"
          :is-valid-connection="isValidConnection"
          @connect="onConnect"
          @edge-update="onEdgeUpdate"
          @edge-update-end="onEdgeUpdateEnd"
        >
          <!-- Source port row -->
          <template #node-sourcePort="{ data }">
            <div :class="['port-row', 'port-row--source', rowClass(data)]">
              <div class="port-controls" @mousedown.stop>
                <el-select v-model="data.port.portType" size="small" style="width:64px" @change="onPortConfigChange">
                  <el-option v-for="o in portTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <el-input v-model="data.port.label" size="small" style="width:170px" @input="onPortConfigChange" />
                <el-select v-model="data.port.option" multiple collapse-tags size="small" style="flex:1" @change="onPortConfigChange">
                  <el-option v-for="o in sourceNode.data.portOptions" :key="o.name" :label="o.name" :value="o.name" />
                </el-select>
                <el-select v-model="data.port.multiport" size="small" style="width:80px" @change="onPortConfigChange">
                  <el-option v-for="o in multiportOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <el-button type="danger" :icon="Delete" circle plain size="small" @click="deletePort(data.port._uid, 'source')" />
              </div>
              <Handle
                type="source"
                id="out"
                :position="Position.Right"
                :class="['port-handle', handleClass(data)]"
              />
            </div>
          </template>

          <!-- Target port row -->
          <template #node-targetPort="{ data }">
            <div :class="['port-row', 'port-row--target', rowClass(data)]">
              <Handle
                type="target"
                id="in"
                :position="Position.Left"
                :class="['port-handle', handleClass(data)]"
              />
              <div class="port-controls" @mousedown.stop>
                <el-button type="danger" :icon="Delete" circle plain size="small" @click="deletePort(data.port._uid, 'target')" />
                <el-select v-model="data.port.portType" size="small" style="width:64px" @change="onPortConfigChange">
                  <el-option v-for="o in portTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <el-input v-model="data.port.label" size="small" style="width:170px" @input="onPortConfigChange" />
                <el-select v-model="data.port.option" multiple collapse-tags size="small" style="flex:1" @change="onPortConfigChange">
                  <el-option v-for="o in targetNode.data.portOptions" :key="o.name" :label="o.name" :value="o.name" />
                </el-select>
                <el-select v-model="data.port.multiport" size="small" style="width:80px" @change="onPortConfigChange">
                  <el-option v-for="o in multiportOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </div>
            </div>
          </template>
        </VueFlow>
      </div>

      <!-- Legend + add-port controls -->
      <div class="bottom-bar">
        <div class="add-btns">
          <el-tooltip content="Add source port" placement="top">
            <el-button :icon="Plus" type="success" plain circle size="small" @click="addPort('source')" />
          </el-tooltip>
          <el-tooltip content="Add target port" placement="top">
            <el-button :icon="Plus" type="success" plain circle size="small" @click="addPort('target')" />
          </el-tooltip>
        </div>
        <div class="legend">
          <span class="legend-item"><span class="legend-dot dot-connected"></span>Connected</span>
          <span class="legend-item"><span class="legend-dot" style="background:#67c23a"></span>Multiport</span>
          <span class="legend-item"><span class="legend-dot dot-taken"></span>Taken elsewhere</span>
          <span class="legend-item"><span class="legend-dot dot-free"></span>Free</span>
        </div>
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="$emit('update:modelValue', false)">Cancel</el-button>
        <el-button type="primary" :disabled="!isDirty" @click="handleConfirm">Apply</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { VueFlow, Position, Handle } from '@vue-flow/core'

// ─── Props / emits ────────────────────────────────────────────────────────────

const props = defineProps({
  modelValue:  { type: Boolean, default: false },
  sourceNode:  Object,
  targetNode:  Object,
  activeEdge:  Object,       // the edge that was double-clicked
  allEdges:    { type: Array, default: () => [] },
  allNodes:    { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

// ─── Constants ────────────────────────────────────────────────────────────────

const FLOW_ID  = 'edge-conn-flow'
const ROW_H    = 52          // px per port row
const NODE_W   = 540         // px per column
const MID_GAP  = 140         // px between columns
const PAD      = 10          // top/bottom canvas padding

const portTypeOptions = [
  { value: 'general_ports',  label: 'G' },
  { value: 'entrance_ports', label: 'I' },
  { value: 'exit_ports',     label: 'O' },
]
const multiportOptions = [
  { value: 'True',  label: 'True'  },
  { value: 'Sum',   label: 'Sum'   },
  { value: 'None',  label: 'None'  },
]

// ─── Compatibility (mirrors portCouplings.js) ─────────────────────────────────

const TARGET_COMPATIBLE = {
  exit_ports:    new Set(['entrance_ports', 'general_ports']),
  general_ports: new Set(['entrance_ports', 'exit_ports', 'general_ports']),
}

function isCompatible(srcType, tgtType) {
  return TARGET_COMPATIBLE[srcType]?.has(tgtType) ?? false
}

function isSingleConnection(portLabel) {
  return !portLabel.multiport || portLabel.multiport === 'None'
}

// ─── State ────────────────────────────────────────────────────────────────────

// Deep copies of the node's portLabels, each stamped with a stable _uid.
const localSrcPorts = ref([])
const localTgtPorts = ref([])

// The active couplings for this edge.
// Each entry: { srcUid: string, tgtUid: string }
// (We use _uid instead of object refs so Vue reactivity stays simple.)
const localCouplings = ref([])

const isDirty    = ref(false)
const flowNodes  = ref([])
const flowEdges  = ref([])

// UIDs consumed by *other* edges (so we can mark them yellow/taken).
const takenElsewhereUids = ref(new Set())

// ─── Derived helpers ──────────────────────────────────────────────────────────

const canvasHeight = computed(() =>
  Math.max(localSrcPorts.value.length, localTgtPorts.value.length, 4) * ROW_H + PAD * 2
)

function srcByUid(uid) { return localSrcPorts.value.find(p => p._uid === uid) }
function tgtByUid(uid) { return localTgtPorts.value.find(p => p._uid === uid) }

function connectedSrcUids() { return new Set(localCouplings.value.map(c => c.srcUid)) }
function connectedTgtUids() { return new Set(localCouplings.value.map(c => c.tgtUid)) }

function rowClass(data) {
  if (data.isConnected)     return 'row--connected'
  if (data.isTakenElsewhere) return 'row--taken'
  return 'row--free'
}
function handleClass(data) {
  if (data.isConnected)      return 'handle--connected'
  if (data.isTakenElsewhere) return 'handle--taken'
  return 'handle--free'
}

// ─── Initialisation ───────────────────────────────────────────────────────────

function stamp(nodeId, labels) {
  return (labels || []).map((p, i) => ({
    ...p,
    _uid: p._uid || `${nodeId}_p${i}_${Date.now()}`,
  }))
}

function resetLocal() {
  localSrcPorts.value = stamp(
    props.sourceNode.id,
    JSON.parse(JSON.stringify(props.sourceNode?.data?.portLabels || []))
  )
  localTgtPorts.value = stamp(
    props.targetNode.id,
    JSON.parse(JSON.stringify(props.targetNode?.data?.portLabels || []))
  )

  // Convert edge.data.couplings → { srcUid, tgtUid } pairs by matching on
  // option array identity (the unique fingerprint per slot).
  const rawCouplings = props.activeEdge?.data?.couplings || []
  localCouplings.value = rawCouplings.flatMap(({ sourcePortLabel, targetPortLabel }) => {
    const src = localSrcPorts.value.find(p =>
      p.label === sourcePortLabel.label &&
      p.portType === sourcePortLabel.portType &&
      JSON.stringify(p.option) === JSON.stringify(sourcePortLabel.option)
    )
    const tgt = localTgtPorts.value.find(p =>
      p.label === targetPortLabel.label &&
      p.portType === targetPortLabel.portType &&
      JSON.stringify(p.option) === JSON.stringify(targetPortLabel.option)
    )
    return src && tgt ? [{ srcUid: src._uid, tgtUid: tgt._uid }] : []
  })

  isDirty.value = false
  calcTakenElsewhere()
  rebuildNodes()
  refreshEdges()
}

// ─── Globally-taken calculation ───────────────────────────────────────────────
// Scans all other edges' couplings to find which port label slots are consumed.

function calcTakenElsewhere() {
  const taken = new Set()
  for (const edge of props.allEdges) {
    if (edge.id === props.activeEdge?.id) continue
    for (const { sourcePortLabel, targetPortLabel } of (edge.data?.couplings || [])) {
      if (isSingleConnection(sourcePortLabel)) {
        // Match against our local port list by option fingerprint
        const match = localSrcPorts.value.find(p =>
          p.label === sourcePortLabel.label &&
          p.portType === sourcePortLabel.portType &&
          JSON.stringify(p.option) === JSON.stringify(sourcePortLabel.option)
        )
        if (match) taken.add(match._uid)
      }
      if (isSingleConnection(targetPortLabel)) {
        const match = localTgtPorts.value.find(p =>
          p.label === targetPortLabel.label &&
          p.portType === targetPortLabel.portType &&
          JSON.stringify(p.option) === JSON.stringify(targetPortLabel.option)
        )
        if (match) taken.add(match._uid)
      }
    }
  }
  takenElsewhereUids.value = taken
}

// ─── VueFlow node / edge builders ─────────────────────────────────────────────

function rebuildNodes() {
  const srcConnected  = connectedSrcUids()
  const tgtConnected  = connectedTgtUids()

  const srcNodes = localSrcPorts.value.map((p, i) => ({
    id:       `src-${p._uid}`,
    type:     'sourcePort',
    position: { x: 0, y: PAD + i * ROW_H },
    data: {
      port:             p,
      isConnected:      srcConnected.has(p._uid),
      isTakenElsewhere: takenElsewhereUids.value.has(p._uid),
    },
  }))

  const tgtNodes = localTgtPorts.value.map((p, i) => ({
    id:       `tgt-${p._uid}`,
    type:     'targetPort',
    position: { x: NODE_W + MID_GAP, y: PAD + i * ROW_H },
    data: {
      port:             p,
      isConnected:      tgtConnected.has(p._uid),
      isTakenElsewhere: takenElsewhereUids.value.has(p._uid),
    },
  }))

  flowNodes.value = [...srcNodes, ...tgtNodes]
}

function refreshEdges() {
  const edges = []

  for (const { srcUid, tgtUid } of localCouplings.value) {
    const sp = srcByUid(srcUid)
    const tp = tgtByUid(tgtUid)
    if (!sp || !tp) continue

    const valid  = sp.label === tp.label && isCompatible(sp.portType, tp.portType)
    const isMulti = sp.multiport === 'True' || sp.multiport === 'Sum'

    edges.push({
      id:           `ce-${srcUid}-${tgtUid}`,
      source:       `src-${srcUid}`,
      target:       `tgt-${tgtUid}`,
      sourceHandle: 'out',
      targetHandle: 'in',
      updatable:    true,
      style: {
        stroke:          !valid ? '#f56c6c' : isMulti ? '#67c23a' : '#409eff',
        strokeWidth:     2.5,
        strokeDasharray: isMulti ? '6,4' : '0',
      },
    })
  }

  flowEdges.value = edges

  // Sync isConnected flags on nodes
  const srcConn = connectedSrcUids()
  const tgtConn = connectedTgtUids()
  for (const node of flowNodes.value) {
    const uid = node.data.port._uid
    node.data.isConnected      = srcConn.has(uid) || tgtConn.has(uid)
    node.data.isTakenElsewhere = takenElsewhereUids.value.has(uid)
  }
}

// ─── Connection validation ────────────────────────────────────────────────────

function isValidConnection(conn) {
  const srcUid = conn.source.replace('src-', '')
  const tgtUid = conn.target.replace('tgt-', '')
  const sp = srcByUid(srcUid)
  const tp = tgtByUid(tgtUid)
  if (!sp || !tp) return false
  if (!sp.label || !tp.label || sp.label !== tp.label) return false
  return isCompatible(sp.portType, tp.portType)
}

// ─── Interaction handlers ─────────────────────────────────────────────────────

// New connection drawn from a free handle
function onConnect(params) {
  const srcUid = params.source.replace('src-', '')
  const tgtUid = params.target.replace('tgt-', '')

  // isValidConnection guarantees label and portType compatibility, so any
  // displaced coupling can always be swapped — no need to check or remove it.
  const draggingIdx = localCouplings.value.findIndex(c => c.srcUid === srcUid)
  const victimIdx   = localCouplings.value.findIndex(c => c.tgtUid === tgtUid && c.srcUid !== srcUid)

  // If the target was already taken, give its source the dragging source's old target.
  if (victimIdx !== -1 && draggingIdx !== -1) {
    localCouplings.value[victimIdx] = { srcUid: localCouplings.value[victimIdx].srcUid, tgtUid: localCouplings.value[draggingIdx].tgtUid }
  } else if (victimIdx !== -1) {
    localCouplings.value[victimIdx] = { srcUid, tgtUid }
  }

  if (draggingIdx !== -1) {
    localCouplings.value[draggingIdx] = { srcUid, tgtUid }
  } else {
    localCouplings.value.push({ srcUid, tgtUid })
  }

  isDirty.value = true
  rebuildNodes()
  refreshEdges()
}

// Existing edge handle dragged to a new endpoint
function onEdgeUpdate({ edge, connection }) {
  const oldSrcUid = edge.source.replace('src-', '')
  const oldTgtUid = edge.target.replace('tgt-', '')
  const newSrcUid = connection.source.replace('src-', '')
  const newTgtUid = connection.target.replace('tgt-', '')

  const dragIdx = localCouplings.value.findIndex(
    c => c.srcUid === oldSrcUid && c.tgtUid === oldTgtUid
  )
  if (dragIdx === -1) return

  // isValidConnection guarantees compatibility, so the displaced coupling can
  // always take the dragged edge's vacated endpoint — no compatibility check needed.
  const victimIdx = localCouplings.value.findIndex(c =>
    c.srcUid !== oldSrcUid &&
    c.tgtUid !== oldTgtUid &&
    (c.tgtUid === newTgtUid || c.srcUid === newSrcUid)
  )

  if (victimIdx !== -1) {
    // Give the victim the endpoint we're vacating
    localCouplings.value[victimIdx] = newTgtUid !== oldTgtUid
      ? { srcUid: localCouplings.value[victimIdx].srcUid, tgtUid: oldTgtUid }
      : { srcUid: oldSrcUid, tgtUid: localCouplings.value[victimIdx].tgtUid }
  }

  localCouplings.value[dragIdx] = { srcUid: newSrcUid, tgtUid: newTgtUid }

  isDirty.value = true
  rebuildNodes()
  refreshEdges()
}

// Snap-back if edge dropped on canvas background
function onEdgeUpdateEnd() {
  nextTick(refreshEdges)
}

// ─── Port editing ─────────────────────────────────────────────────────────────

function onPortConfigChange() {
  isDirty.value = true
  autoConnect()
  rebuildNodes()
  refreshEdges()
}

// Auto-match: for each unconnected source port, find a compatible unconnected
// target port and add the coupling. Runs after any port edit so that fixing a
// label or portType immediately wires up the connection.
function autoConnect() {
  const usedSrcUids = new Set(localCouplings.value.map(c => c.srcUid))
  const usedTgtUids = new Set(localCouplings.value.map(c => c.tgtUid))

  for (const sp of localSrcPorts.value) {
    if (usedSrcUids.has(sp._uid)) continue
    if (!sp.label || !sp.label.trim()) continue

    const tp = localTgtPorts.value.find(p =>
      !usedTgtUids.has(p._uid) &&
      p.label === sp.label &&
      isCompatible(sp.portType, p.portType)
    )

    if (tp) {
      localCouplings.value.push({ srcUid: sp._uid, tgtUid: tp._uid })
      usedSrcUids.add(sp._uid)
      usedTgtUids.add(tp._uid)
    }
  }
}

function deletePort(uid, side) {
  if (side === 'source') {
    localSrcPorts.value = localSrcPorts.value.filter(p => p._uid !== uid)
    localCouplings.value = localCouplings.value.filter(c => c.srcUid !== uid)
  } else {
    localTgtPorts.value = localTgtPorts.value.filter(p => p._uid !== uid)
    localCouplings.value = localCouplings.value.filter(c => c.tgtUid !== uid)
  }
  isDirty.value = true
  rebuildNodes()
  refreshEdges()
}

function addPort(side) {
  const uid = `new_${side}_${Date.now()}`
  const entry = { _uid: uid, portType: 'general_ports', label: '', option: [], multiport: 'None' }
  if (side === 'source') localSrcPorts.value.push(entry)
  else                   localTgtPorts.value.push(entry)
  isDirty.value = true
  rebuildNodes()
  refreshEdges()
}

// ─── Confirm / save ───────────────────────────────────────────────────────────

function handleConfirm() {
  // Reconstruct couplings in the { sourcePortLabel, targetPortLabel } format
  // that resolvePortCouplings produces, so BuilderView can write directly to
  // edge.data.couplings without re-running any coupling logic.
  const couplings = localCouplings.value.flatMap(({ srcUid, tgtUid }) => {
    const sp = srcByUid(srcUid)
    const tp = tgtByUid(tgtUid)
    if (!sp || !tp) return []
    const { _uid: _s, ...sourcePortLabel } = sp
    const { _uid: _t, ...targetPortLabel } = tp
    return [{ sourcePortLabel, targetPortLabel }]
  })

  emit('confirm', {
    sourceNodeId:   props.sourceNode.id,
    targetNodeId:   props.targetNode.id,
    sourcePortLabels: localSrcPorts.value.map(({ _uid, ...p }) => p),
    targetPortLabels: localTgtPorts.value.map(({ _uid, ...p }) => p),
    couplings,
  })
  emit('update:modelValue', false)
}

function onClosed() {
  emit('update:modelValue', false)
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

import { watch } from 'vue'
watch(() => props.modelValue, (v) => { if (v) resetLocal() })
</script>

<style scoped>
/* ── Dialog header ── */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}
.dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: -0.3px;
}
.title-icon {
  font-size: 20px;
  color: #e6a23c;
}
.node-names {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.node-badge {
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.3px;
}
.source-badge {
  background: #ecf5ff;
  color: #409eff;
  border: 1px solid #b3d8ff;
}
.target-badge {
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #c2e7b0;
}
.arrow-sep {
  color: #c0c4cc;
  font-size: 16px;
}

/* ── Root layout ── */
.root {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Column headers ── */
.col-headers {
  display: flex;
  align-items: flex-start;
  gap: 0;
  padding: 0 2px;
}
.col-header-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: v-bind('NODE_W + "px"');
}
.mid-spacer {
  width: v-bind('MID_GAP + "px"');
}
.side-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: #909399;
  text-transform: uppercase;
  padding-left: 2px;
}
.col-subheaders {
  display: flex;
  gap: 8px;
  padding: 6px 10px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px 4px 0 0;
  font-size: 11px;
  font-weight: 700;
  color: #909399;
  letter-spacing: 0.3px;
}

/* ── Canvas ── */
.flow-canvas {
  border: 1px solid #dcdfe6;
  border-radius: 0 0 4px 4px;
  background: #fafafa;
  position: relative;
  overflow: hidden;
}

/* ── Port row nodes ── */
:deep(.port-row) {
  display: flex;
  align-items: center;
  height: 44px;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
  background: #fff;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  position: relative;
}
:deep(.port-row--source) {
  width: v-bind('NODE_W + "px"');
}
:deep(.port-row--target) {
  width: v-bind('NODE_W + "px"');
}

/* Connected on this edge = blue highlight */
:deep(.row--connected) {
  background: #ecf5ff;
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.12);
}

/* Taken by another edge = amber dashed */
:deep(.row--taken) {
  background: #fdf6ec;
  border: 1px dashed #e6a23c;
  opacity: 0.8;
}

/* Free / unconnected = faded */
:deep(.row--free) {
  opacity: 0.55;
}
:deep(.row--free:hover) {
  opacity: 1;
  border-color: #c0c4cc;
}

:deep(.port-controls) {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 10px;
  pointer-events: auto;
}

/* ── Handles ── */
:deep(.port-handle) {
  width: 11px !important;
  height: 11px !important;
  border-radius: 50% !important;
  border: 2px solid white !important;
  transition: transform 0.1s ease, background 0.1s ease;
}
:deep(.handle--connected) {
  background: #409eff !important;
}
:deep(.handle--taken) {
  background: #e6a23c !important;
}
:deep(.handle--free) {
  background: #c0c4cc !important;
}
:deep(.vue-flow__handle-valid) {
  background: #67c23a !important;
  transform: scale(1.4) !important;
}
:deep(.vue-flow__handle-connecting) {
  background: #409eff !important;
  transform: scale(1.2) !important;
}

/* ── Bottom bar ── */
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 0;
}
.add-btns {
  display: flex;
  gap: 8px;
}
.legend {
  display: flex;
  gap: 16px;
  align-items: center;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #909399;
}
.legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
}
.dot-connected { background: #409eff; }
.dot-taken     { background: #e6a23c; border: 1px dashed #e6a23c; }
.dot-free      { background: #c0c4cc; }

/* ── Footer ── */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>