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

          <!-- Ghost port row -->
          <template #node-ghostPort="{ data }">
            <div
              :class="['port-row', data.side === 'source' ? 'port-row--source' : 'port-row--target', 'port-row--ghost']"
              @click="activateGhost(data.side)"
            >
              <template v-if="data.side === 'source'">
                <div class ="port-controls ghost-controls" @mousedown.stop>
                  <span class="ghost-label">
                    <el-icon><Plus /></el-icon>
                    add port
                  </span>
                </div>
                <Handle
                  type="source" id="out"
                  :position="Position.Right"
                  class="port-handle handle--free"
                />
              </template>
              <template v-else>
                <Handle
                  type="target" id="in"
                  :position="Position.Left"
                  class="port-handle handle--free"
                />
                <div class ="port-controls ghost-controls" @mousedown.stop>
                  <span class="ghost-label">
                    <el-icon><Plus /></el-icon>
                    add port
                  </span>
                </div>
              </template>
            </div>
          </template>
        </VueFlow>
      </div>

      <!-- Legend -->
      <div class="bottom-bar">
        <div class="legend">
          <span class="legend-item"><span class="legend-dot dot-connected"></span>Connected</span>
          <span class="legend-item"><span class="legend-dot" style="background:#67c23a"></span>Multiport</span>
          <span class="legend-item"><span class="legend-dot dot-taken"></span>Taken elsewhere</span>
          <span class="legend-item"><span class="legend-dot dot-free"></span>Free</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="$emit('update:modelValue', false)">
          Done
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { VueFlow, Position, Handle, useVueFlow } from '@vue-flow/core'

// ─── Props / emits ────────────────────────────────────────────────────────────

const props = defineProps({
  modelValue:  { type: Boolean, default: false },
  sourceNode:  Object,
  targetNode:  Object,
  activeEdge:  Object,       
  allEdges:    { type: Array, default: () => [] },
  allNodes:    { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

// ─── Constants ────────────────────────────────────────────────────────────────

const FLOW_ID  = 'edge-conn-flow'
const { updateEdge } = useVueFlow(FLOW_ID)

let edgeUpdateSuccessful = false
const ROW_H    = 52          // px per port row
const NODE_W   = 540         // px per column
const MID_GAP  = 75           // px between columns
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

const ghostSrcPort = ref(null)
const ghostTgtPort = ref(null)

// ─── Compatibility ─────────────────────────────────

const TARGET_COMPATIBLE = {
  entrance_ports: new Set(['general_ports']),
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
const localCouplings = ref([])

const flowNodes  = ref([])
const flowEdges  = ref([])

// UIDs consumed by other edges
const takenElsewhereUids = ref(new Set())

// Tracks the current coupling state of other edges that share our source/target
// node. Keyed by edge ID. When the user swaps a connection, the displaced port
// slot must be released from the foreign edge that previously owned it — we
// store the updated coupling here so handleConfirm can propagate it to BuilderView.
// Initialised from props.allEdges on resetLocal; mutated by swap operations.
const foreignEdgeCouplings = ref(new Map()) // Map<edgeId, Array<{sourcePortLabel, targetPortLabel}>>

// ─── Derived helpers ──────────────────────────────────────────────────────────

const canvasHeight = computed(() =>
  (Math.max(localSrcPorts.value.length, localTgtPorts.value.length, 4) + 1) * ROW_H + PAD * 2
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

  ghostSrcPort.value = {}
  ghostTgtPort.value = {}

  // Convert edge.data.couplings -> { srcUid, tgtUid } pairs by matching on
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

  // Snapshot the current coupling state of all OTHER edges that touch our
  // source or target node. These may be mutated by swaps during the session.
  const map = new Map()
  for (const edge of props.allEdges) {
    if (edge.id === props.activeEdge?.id) continue
    if (
      edge.source === props.sourceNode.id ||
      edge.target === props.sourceNode.id ||
      edge.source === props.targetNode.id ||
      edge.target === props.targetNode.id
    ) {
      map.set(edge.id, JSON.parse(JSON.stringify(edge.data?.couplings || [])))
    }
  }
  foreignEdgeCouplings.value = map

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
      // Check ACTIVE SOURCE node
      if (edge.source === props.sourceNode.id && isSingleConnection(sourcePortLabel)) {
        const match = localSrcPorts.value.find(p => p.label === sourcePortLabel.label && p.portType === sourcePortLabel.portType && JSON.stringify(p.option) === JSON.stringify(sourcePortLabel.option))
        if (match) taken.add(match._uid)
      }
      if (edge.target === props.sourceNode.id && isSingleConnection(targetPortLabel)) {
        const match = localSrcPorts.value.find(p => p.label === targetPortLabel.label && p.portType === targetPortLabel.portType && JSON.stringify(p.option) === JSON.stringify(targetPortLabel.option))
        if (match) taken.add(match._uid)
      }

      // Check ACTIVE TARGET node
      if (edge.source === props.targetNode.id && isSingleConnection(sourcePortLabel)) {
        const match = localTgtPorts.value.find(p => p.label === sourcePortLabel.label && p.portType === sourcePortLabel.portType && JSON.stringify(p.option) === JSON.stringify(sourcePortLabel.option))
        if (match) taken.add(match._uid)
      }
      if (edge.target === props.targetNode.id && isSingleConnection(targetPortLabel)) {
        const match = localTgtPorts.value.find(p => p.label === targetPortLabel.label && p.portType === targetPortLabel.portType && JSON.stringify(p.option) === JSON.stringify(targetPortLabel.option))
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

  if (ghostSrcPort.value) {
    flowNodes.value.push({
      id: 'ghost-src',
      type: 'ghostPort',
      position: { x: 0, y: PAD + localSrcPorts.value.length * ROW_H },
      data: { side: 'source' }
    })
  }
  if (ghostTgtPort.value) {
    flowNodes.value.push({
      id: 'ghost-tgt',
      type: 'ghostPort',
      position: { x: NODE_W + MID_GAP, y: PAD + localTgtPorts.value.length * ROW_H },
      data: { side: 'target' }
    })
  }
}

function refreshEdges() {
  const edges = []

  for (const { srcUid, tgtUid } of localCouplings.value) {
    const sp = srcByUid(srcUid)
    const tp = tgtByUid(tgtUid)
    if (!sp || !tp) continue

    const valid  = sp.label === tp.label && isCompatible(sp.portType, tp.portType)
    // If EITHER side is a multiport, style it as a dynamic multiport line
    const isMulti = !isSingleConnection(sp) || !isSingleConnection(tp)

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
    if (!node.data.port) continue // for ghost ports - could make more robust
    const uid = node.data.port._uid
    node.data.isConnected      = srcConn.has(uid) || tgtConn.has(uid)
    node.data.isTakenElsewhere = takenElsewhereUids.value.has(uid)
  }
}

// ─── Foreign edge coupling updates ───────────────────────────────────────────

// When a swap displaces a coupling that belongs to a foreign edge, release the slot.
// This mutates foreignEdgeCouplings so handleConfirm can propagate the change.
// When a swap displaces a coupling that belongs to a foreign edge (one we don't
// own), we must update that edge's coupling record so the slot is released.
function releaseForeignSlot(portLabel, side) {
  if (!portLabel) return null
  const targetNodeId = side === 'source' ? props.sourceNode.id : props.targetNode.id

  for (const [edgeId, couplings] of foreignEdgeCouplings.value) {
    const edge = props.allEdges.find(e => e.id === edgeId)
    if (!edge) continue

    const idx = couplings.findIndex(c => {
      const matchSource = edge.source === targetNodeId && 
                          c.sourcePortLabel.label === portLabel.label && 
                          c.sourcePortLabel.portType === portLabel.portType && 
                          JSON.stringify(c.sourcePortLabel.option) === JSON.stringify(portLabel.option)
                          
      const matchTarget = edge.target === targetNodeId && 
                          c.targetPortLabel.label === portLabel.label && 
                          c.targetPortLabel.portType === portLabel.portType && 
                          JSON.stringify(c.targetPortLabel.option) === JSON.stringify(portLabel.option)
                          
      return matchSource || matchTarget
    })
    
    if (idx !== -1) {
      const updated = [...couplings]
      const removedCoupling = updated.splice(idx, 1)[0]
      foreignEdgeCouplings.value.set(edgeId, updated)
      return { edgeId, removedCoupling, side } // Return the exact details of the evicted port
    }
  }
  return null
}

// ─── Connection validation ────────────────────────────────────────────────────

function isValidConnection(connection) {
  if (connection.source === 'ghost-src' || connection.target === 'ghost-tgt') return true
  const sUid = (connection.source || '').replace('src-', '')
  const tUid = (connection.target || '').replace('tgt-', '')
  
  const sp = srcByUid(sUid)
  const tp = tgtByUid(tUid)
  
  if (!sp || !tp || !sp.label || !tp.label) return false
  
  return sp.label === tp.label && isCompatible(sp.portType, tp.portType)
}

// ─── Interaction handlers ─────────────────────────────────────────────────────

function onConnect(params) {
  const isGhostSrc = params.source === 'ghost-src'
  const isGhostTgt = params.target === 'ghost-tgt'

  if (isGhostSrc || isGhostTgt) {
    if (isGhostSrc) {
      // Infer from the real target port
      const tUid = params.target.replace('tgt-', '')
      const tp = tgtByUid(tUid)
      activateGhost('source', tp)
      // Rewrite params to use the newly created port's node id
      params = { ...params, source: `src-${localSrcPorts.value.at(-1)._uid}` }
    }
    if (isGhostTgt) {
      // Infer from the real source port
      const sUid = params.source.replace('src-', '')
      const sp = srcByUid(sUid)
      activateGhost('target', sp)
      params = { ...params, target: `tgt-${localTgtPorts.value.at(-1)._uid}` }
    }
  }

  if (!isValidConnection(params)) return

  const srcUid = (params.source || '').replace('src-', '')
  const tgtUid = (params.target || '').replace('tgt-', '')
  const sp = srcByUid(srcUid)
  const tp = tgtByUid(tgtUid)

  if (localCouplings.value.some(c => c.srcUid === srcUid && c.tgtUid === tgtUid)) return

  let nextCouplings = [...localCouplings.value]
  let impactedSrcUid = null
  let impactedTgtUid = null
  let impactedForeign = []

  if (isSingleConnection(tp)) {
    const localConn = nextCouplings.find(c => c.tgtUid === tgtUid)
    if (localConn) {
      impactedSrcUid = localConn.srcUid
      nextCouplings = nextCouplings.filter(c => c !== localConn)
    } else if (takenElsewhereUids.value.has(tgtUid)) {
      const evicted = releaseForeignSlot(tp, 'target')
      if (evicted) impactedForeign.push(evicted)
    }
  }

  if (isSingleConnection(sp)) {
    const localConn = nextCouplings.find(c => c.srcUid === srcUid)
    if (localConn) {
      impactedTgtUid = localConn.tgtUid
      nextCouplings = nextCouplings.filter(c => c !== localConn)
    } else if (takenElsewhereUids.value.has(srcUid)) {
      const evicted = releaseForeignSlot(sp, 'source')
      if (evicted) impactedForeign.push(evicted)
    }
  }

  nextCouplings.push({ srcUid, tgtUid })
  localCouplings.value = nextCouplings

  calcTakenElsewhere()

  if (impactedSrcUid) autoConnectTargeted(impactedSrcUid, 'source')
  if (impactedTgtUid) autoConnectTargeted(impactedTgtUid, 'target')

  for (const foreign of impactedForeign) {
    autoConnectForeign(foreign)
  }

  calcTakenElsewhere()

  rebuildNodes()
  refreshEdges()
  applyChanges()
}

function onEdgeUpdate({ edge, connection }) {
  if (!connection?.source || !connection?.target) return
  if (!isValidConnection(connection)) return

  const newSrc = connection.source.replace('src-', '')
  const newTgt = connection.target.replace('tgt-', '')

  const oldSrc = edge.source.replace('src-', '')
  const oldTgt = edge.target.replace('tgt-', '')

  const current = localCouplings.value.find(
    c => c.srcUid === oldSrc && c.tgtUid === oldTgt
  )

  if (!current) return

  const existing = localCouplings.value.find(
    c => c.srcUid === newSrc && c.tgtUid === newTgt
  )

  if (existing && existing !== current) {


    existing.srcUid = current.srcUid
    existing.tgtUid = current.tgtUid

    current.srcUid = newSrc
    current.tgtUid = newTgt
  } else {
    current.srcUid = newSrc
    current.tgtUid = newTgt
  }

  edgeUpdateSuccessful = true

  rebuildNodes()
  refreshEdges()
  applyChanges()
}

// ─── Port editing ─────────────────────────────────────────────────────────────

function enforceSingleConnectionConstraints() {
  // 1. Clean up Source Ports
  for (const sp of localSrcPorts.value) {
    if (isSingleConnection(sp)) {
      if (takenElsewhereUids.value.has(sp._uid)) {
        localCouplings.value = localCouplings.value.filter(c => c.srcUid !== sp._uid)
      } else {
        const myCouplings = localCouplings.value.filter(c => c.srcUid === sp._uid)
        if (myCouplings.length > 1) {
          const keep = myCouplings[0]
          localCouplings.value = localCouplings.value.filter(c => c.srcUid !== sp._uid || c === keep)
        }
      }
    }
  }

  // 2. Clean up Target Ports
  for (const tp of localTgtPorts.value) {
    if (isSingleConnection(tp)) {
      if (takenElsewhereUids.value.has(tp._uid)) {
        localCouplings.value = localCouplings.value.filter(c => c.tgtUid !== tp._uid)
      } else {
        const myCouplings = localCouplings.value.filter(c => c.tgtUid === tp._uid)
        if (myCouplings.length > 1) {
          const keep = myCouplings[0]
          localCouplings.value = localCouplings.value.filter(c => c.tgtUid !== tp._uid || c === keep)
        }
      }
    }
  }
}

function onPortConfigChange() {
  enforceSingleConnectionConstraints() // Prune illegal connections if switched to 'None'
  autoConnect()                        // Instantly build valid connections if switched to 'True'
  rebuildNodes()
  refreshEdges()
  applyChanges()
}

// Auto-match: for each unconnected source port, find compatible unconnected target ports.
// to do: apply this on opening the dialog
function autoConnect() {
  for (const sp of localSrcPorts.value) {
    if (!sp.label || !sp.label.trim()) continue
    
    // Check if source is fully booked
    const srcUsedCount = localCouplings.value.filter(c => c.srcUid === sp._uid).length
    if (isSingleConnection(sp) && (srcUsedCount > 0 || takenElsewhereUids.value.has(sp._uid))) continue

    // Find all matching target labels
    const compatibleTargets = localTgtPorts.value.filter(tp => {
      if (tp.label !== sp.label || !isCompatible(sp.portType, tp.portType)) return false
      
      const tgtUsedCount = localCouplings.value.filter(c => c.tgtUid === tp._uid).length
      if (isSingleConnection(tp) && (tgtUsedCount > 0 || takenElsewhereUids.value.has(tp._uid))) return false
      if (localCouplings.value.some(c => c.srcUid === sp._uid && c.tgtUid === tp._uid)) return false
      return true
    })

    // Plug them in!
    for (const tp of compatibleTargets) {
      localCouplings.value.push({ srcUid: sp._uid, tgtUid: tp._uid })
      if (isSingleConnection(sp)) break // Move to the next source port
    }
  }
}

function autoConnectTargeted(uid, type) {
  if (type === 'source') {
    const sp = srcByUid(uid)
    if (!sp || !sp.label) return
    
    const match = localTgtPorts.value.find(tp => {
      if (tp.label !== sp.label || !isCompatible(sp.portType, tp.portType)) return false
      const isTaken = localCouplings.value.some(c => c.tgtUid === tp._uid) || takenElsewhereUids.value.has(tp._uid)
      return isSingleConnection(tp) ? !isTaken : true
    })
    
    if (match) {
      localCouplings.value = [...localCouplings.value, { srcUid: uid, tgtUid: match._uid }]
    }
  } else if (type === 'target') {
    const tp = tgtByUid(uid)
    if (!tp || !tp.label) return
    
    const match = localSrcPorts.value.find(sp => {
      if (sp.label !== tp.label || !isCompatible(sp.portType, tp.portType)) return false
      const isTaken = localCouplings.value.some(c => c.srcUid === sp._uid) || takenElsewhereUids.value.has(sp._uid)
      return isSingleConnection(sp) ? !isTaken : true
    })
    
    if (match) {
      localCouplings.value = [...localCouplings.value, { srcUid: match._uid, tgtUid: uid }]
    }
  }
}

function autoConnectForeign({ edgeId, removedCoupling, side }) {
  if (side === 'target') {
    const oldTargetLabel = removedCoupling.targetPortLabel
    const match = localTgtPorts.value.find(tp => {
      if (tp.label !== oldTargetLabel.label || tp.portType !== oldTargetLabel.portType) return false
      const isTakenLocally = localCouplings.value.some(c => c.tgtUid === tp._uid)
      const isTakenForeignly = takenElsewhereUids.value.has(tp._uid)
      return isSingleConnection(tp) ? (!isTakenLocally && !isTakenForeignly) : true
    })

    if (match) {
      const currentCouplings = foreignEdgeCouplings.value.get(edgeId) || []
      foreignEdgeCouplings.value.set(edgeId, [...currentCouplings, {
        sourcePortLabel: removedCoupling.sourcePortLabel,
        targetPortLabel: {
          portType: match.portType,
          label: match.label,
          option: JSON.parse(JSON.stringify(match.option)),
          multiport: match.multiport
        }
      }])
      calcTakenElsewhere() 
    }
  } else if (side === 'source') {
    const oldSourceLabel = removedCoupling.sourcePortLabel
    const match = localSrcPorts.value.find(sp => {
      if (sp.label !== oldSourceLabel.label || sp.portType !== oldSourceLabel.portType) return false
      const isTakenLocally = localCouplings.value.some(c => c.srcUid === sp._uid)
      const isTakenForeignly = takenElsewhereUids.value.has(sp._uid)
      return isSingleConnection(sp) ? (!isTakenLocally && !isTakenForeignly) : true
    })

    if (match) {
      const currentCouplings = foreignEdgeCouplings.value.get(edgeId) || []
      foreignEdgeCouplings.value.set(edgeId, [...currentCouplings, {
        sourcePortLabel: {
          portType: match.portType,
          label: match.label,
          option: JSON.parse(JSON.stringify(match.option)),
          multiport: match.multiport
        },
        targetPortLabel: removedCoupling.targetPortLabel
      }])
      calcTakenElsewhere() 
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
  rebuildNodes()
  refreshEdges()
  applyChanges()
}

function addPort(side) {
  const uid = `new_${side}_${Date.now()}`
  const entry = { _uid: uid, portType: 'general_ports', label: '', option: [], multiport: 'None' }
  if (side === 'source') localSrcPorts.value.push(entry)
  else                   localTgtPorts.value.push(entry)
  rebuildNodes()
  refreshEdges()
  applyChanges()
}

function activateGhost(side, inferFrom = null) {
  const uid = `new_${side}_${Date.now()}`

  let portType = 'general_ports'

  // side refers to the side that the ghost node is being added
  if (side === 'target') {
    portType = inferFrom?.portType === 'exit_ports' ? 'entrance_ports' : 'general_ports'
  } else if (side === 'source') {
    portType = inferFrom?.portType === 'entrance_ports' ? 'exit_ports' : 'general_ports'
  } else {
    return // should trigger error
  }

  const entry = {
    _uid: uid,
    portType: portType,
    label:    inferFrom?.label    ?? '',
    option:   [],           
    multiport: inferFrom?.multiport ?? 'None',
  }
  if (side === 'source') {
    localSrcPorts.value.push(entry)
    ghostSrcPort.value = {}
  } else {
    localTgtPorts.value.push(entry)
    ghostTgtPort.value = {}
  }
  rebuildNodes()
  refreshEdges()
  applyChanges()
}

// ─── Confirm / save ───────────────────────────────────────────────────────────

function applyChanges() {
  emit('confirm', {
    sourceNodeId: props.sourceNode.id,
    targetNodeId: props.targetNode.id,
    sourcePortLabels: JSON.parse(JSON.stringify(localSrcPorts.value)),
    targetPortLabels: JSON.parse(JSON.stringify(localTgtPorts.value)),
    couplings: localCouplings.value.map(c => {
       const sp = srcByUid(c.srcUid)
       const tp = tgtByUid(c.tgtUid)
       return {
         sourcePortLabel: { portType: sp.portType, label: sp.label, option: sp.option, multiport: sp.multiport },
         targetPortLabel: { portType: tp.portType, label: tp.label, option: tp.option, multiport: tp.multiport }
       }
    }),
  })
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

/* -- Ghost ports -- */
:deep(.port-row--ghost) {
  background: transparent;
  border: 1.5px dashed #dcdfe6;
  opacity: 1;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: border-color 0.15s, background 0.15s;
}
:deep(.port-row--ghost:hover) {
  border-color: #409eff;
  background: #ecf5ff;
}
.ghost-label {
  display: flex;
  align-items: center;
  justify-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: #c0c4cc;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  pointer-events: none;
  user-select: none;
  transition: color 0.15s;
}
:deep(.port-row--ghost:hover) .ghost-label {
  color: #409eff;
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