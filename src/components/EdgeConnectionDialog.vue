<template>
  <Dialog
    v-model:visible="visible"
    :style="{ width: '1200px', maxHeight: '92vh' }"
    :draggable="false"
    :closable="false"
    modal
    :appendTo="'body'"
    @hide="onClosed"
    @wheel.stop
  >
    <!-- Custom header -->
    <template #header>
      <div class="dialog-header">
        <div class="dialog-title">
          <span class="title-icon">⇌</span>
          <span>Connections</span>
        </div>

        <div class="node-names" v-if="sourceNode && targetNode">
          <Chip
            :label="sourceNode.data.name"
            style="background: color-mix(in srgb, var(--p-primary-color, #409eff) 15%, transparent); color: var(--p-primary-color, #409eff); border: 1px solid color-mix(in srgb, var(--p-primary-color, #409eff) 30%, transparent);"></Chip>
          <span class="arrow-sep">→</span>
          <Chip
            :label="targetNode.data.name"
            style="background: color-mix(in srgb, var(--p-secondary-color, #409eff) 15%, transparent); color: var(--p-secondary-color, #409eff); border: 1px solid color-mix(in srgb, var(--p-secondary-color, #409eff) 30%, transparent);"></Chip>
        </div>
      </div>
    </template>

    <div v-if="sourceNode && targetNode" class="root">
      <div class="connections-layout" :style="portGridStyle">
        <!-- Column headers -->
        <div class="col-headers">
          <div class="col-header-label source-side">
            <span class="side-label">SOURCE</span>
            <div class="col-subheaders port-grid">
              <span style="width: var(--port-col-type)" class="col-header">Type</span>
              <span style="width: var(--port-col-label)" class="col-header">Label</span>
              <span style="width: var(--port-col-variables)" class="col-header">Variables</span>
              <span style="width: var(--port-col-multiport)" class="col-header">Multiport</span>
              <span aria-hidden="true" style="width: var(--port-col-handle)"></span>
              <span aria-hidden="true" style="width: var(--port-col-action)"></span>
            </div>
          </div>
          <div class="mid-spacer" :style="{ minWidth: midGap, width: midGap }"></div>
          <div class="col-header-label target-side">
            <span class="side-label">TARGET</span>
            <div class="col-subheaders port-grid">
              <span aria-hidden="true" style="width: var(--port-col-handle)"></span>
              <span aria-hidden="true" style="width: var(--port-col-action)"></span>
              <span style="width: var(--port-col-type)" class="col-header">Type</span>
              <span style="width: var(--port-col-label)" class="col-header">Label</span>
              <span style="width: var(--port-col-variables)" class="col-header">Variables</span>
              <span style="width: var(--port-col-multiport)" class="col-header">Multiport</span>
            </div>
          </div>
        </div>

        <!-- VueFlow canvas -->
        <div ref="canvasEl" class="flow-canvas" @wheel.stop.prevent="onCanvasWheel">
          <div :style="{ height: canvasHeight + 'px', position: 'relative' }">
            <VueFlow
              :id="FLOW_IDS.EDGE"
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
              @connect-start="onConnectStart"
              @connect-end="onConnectEnd"
              @edge-update-start="onEdgeUpdateStart"
              @edge-update-end="onEdgeUpdateEnd"
              @node-click="onNodeClick"
            >
              <!-- Source port row -->
              <template #node-sourcePort="{ data }">
                <PortRow
                  side="source"
                  :port="data.port"
                  :variables="sourceNode.data.variables"
                  :is-connected="data.isConnected"
                  :is-taken-elsewhere="data.isTakenElsewhere"
                  :is-valid-target="validConnectUids.has(data.port._uid)"
                  :style="rowStyle(data.port._uid, 'source')"
                  @change="onPortConfigChange"
                  @start-drag="startDrag($event, data.port._uid, 'source')"
                  @delete="deletePort(data.port._uid, 'source')"
                />
              </template>

              <!-- Target port row -->
              <template #node-targetPort="{ data }">
                <PortRow
                  side="target"
                  :port="data.port"
                  :variables="targetNode.data.variables"
                  :is-connected="data.isConnected"
                  :is-taken-elsewhere="data.isTakenElsewhere"
                  :is-valid-target="validConnectUids.has(data.port._uid)"
                  :style="rowStyle(data.port._uid, 'target')"
                  @change="onPortConfigChange"
                  @start-drag="startDrag($event, data.port._uid, 'target')"
                  @delete="deletePort(data.port._uid, 'target')"
                />
              </template>

              <!-- Ghost port row -->
              <template #node-ghostPort="{ data }">
                <div class="port-row port-row--ghost" :style="{ width: nodeWidth }">
                  <template v-if="data.side === 'source'">
                    <div class="port-controls ghost-controls" @mousedown.stop>
                      <span class="ghost-label">
                        <i class="pi pi-plus"></i>
                        Add Port
                      </span>
                    </div>
                    <Handle
                      type="source"
                      id="out"
                      :position="Position.Right"
                      :class="[
                        'port-handle',
                        draggingFrom?.side === 'target' && draggingFrom?.uid !== 'ghost-tgt'
                          ? 'handle--valid-target'
                          : 'handle--free',
                      ]"
                    />
                  </template>
                  <template v-else>
                    <Handle
                      type="target"
                      id="in"
                      :position="Position.Left"
                      :class="[
                        'port-handle',
                        draggingFrom?.side === 'source' && draggingFrom?.uid !== 'ghost-src'
                          ? 'handle--valid-target'
                          : 'handle--free',
                      ]"
                    />
                    <div class="port-controls ghost-controls" @mousedown.stop>
                      <span class="ghost-label">
                        <i class="pi pi-plus"></i>
                        Add Port
                      </span>
                    </div>
                  </template>
                </div>
              </template>
            </VueFlow>
          </div>
        </div>
      </div>
      <!-- Legend -->
      <div class="bottom-bar">
        <div class="legend">
          <span class="legend-item"><span class="legend-dot dot-connected"></span>Connected</span>
          <span class="legend-item"><span class="legend-dot dot-taken"></span>Taken (single)</span>
          <span class="legend-item"><span class="legend-dot dot-taken-multi"></span>Taken (multiport)</span>
          <span class="legend-item"><span class="legend-dot dot-free"></span>Free</span>
        </div>
      </div>
    </div>

    <!-- Swap confirmation dialog -->
    <Dialog
      v-model:visible="swapDialog.visible"
      header="Port already connected"
      :style="{ width: '380px' }"
      :closable="false"
      :dismissableMask="false"
      :closeOnEscape="false"
      :modal="true"
      :appendTo="'self'"
    >
      <span>This port is already connected. What would you like to do?</span>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="resolveSwap('cancel')" />
        <Button label="Replace" severity="secondary" @click="resolveSwap('overwrite')" />
        <Button v-if="swapDialog.canSwap" label="Swap" @click="resolveSwap('swap')" />
      </template>
    </Dialog>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Cancel" severity="secondary" text @click="handleCancel" />
        <Button label="Done" @click="handleConfirm" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { VueFlow, Position, Handle, useVueFlow } from '@vue-flow/core'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { FLOW_IDS, ROW_H, NODE_W, MID_GAP, PAD } from '../utils/constants'
import { isSingleConnection } from '../utils/edges'
import { isCompatible } from '../utils/ports'
import { detachReactivity } from '../utils/reactivity'

import PortRow from './PortRow.vue'
import { useEdgeCouplings } from '../composables/useEdgeCouplings'
import { usePortDrag } from '../composables/usePortDrag'
import { useConnectionAutoscroll } from '../composables/useConnectionAutoscroll'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  sourceNode: { type: Object, required: true },
  targetNode: { type: Object, required: true },
  activeEdge: { type: Object, required: true },
  subgraph: { type: Map, required: true },
})

const PORT_COLUMN_MODEL = {
  handle: '20px',
  action: '32px',
  type: '60px',
  label: '125px',
  variables: '157px',
  multiport: '85px',
  gap: '8px',
  spacer: '0px',
  insetX: '9px',
}

const SIDE_CONFIG = {
  source: { prefix: 'src', x: 0, nodeType: 'sourcePort' },
  target: { prefix: 'tgt', x: NODE_W + MID_GAP, nodeType: 'targetPort' },
}

const contentWidth = `${NODE_W * 2 + MID_GAP}px`
const nodeWidth = `${NODE_W}px`
const midGap = `${MID_GAP}px`

const portGridStyle = {
  '--port-col-handle': PORT_COLUMN_MODEL.handle,
  '--port-col-action': PORT_COLUMN_MODEL.action,
  '--port-col-type': PORT_COLUMN_MODEL.type,
  '--port-col-label': PORT_COLUMN_MODEL.label,
  '--port-col-variables': PORT_COLUMN_MODEL.variables,
  '--port-col-multiport': PORT_COLUMN_MODEL.multiport,
  '--port-col-gap': PORT_COLUMN_MODEL.gap,
  '--port-col-spacer': PORT_COLUMN_MODEL.spacer,
}

const emit = defineEmits(['update:modelValue', 'confirm'])
const canvasEl = ref(null)
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const { updateEdge, getViewport, setViewport } = useVueFlow(FLOW_IDS.EDGE)

const swapDialog = ref({ visible: false, resolve: null })

function askSwapIntent(canSwap = false) {
  return new Promise((resolve) => {
    swapDialog.value = { visible: true, resolve, canSwap }
  })
}

function resolveSwap(intent) {
  swapDialog.value.visible = false
  swapDialog.value.resolve?.(intent)
}

function onNodeClick({ node }) {
  if (node.type === 'ghostPort') {
    activateGhost(node.data.side)
  }
}

const {
  localSrcPorts,
  localTgtPorts,
  localCouplings,
  localSubgraph,
  takenElsewhereUids,
  portLookup,
  srcByUid,
  tgtByUid,
  connectedSrcUids,
  connectedTgtUids,
  initLocalState,
  evictHandle,
  swapConnections,
  connectPorts,
  deletePort,
  activateGhost,
  onPortConfigChange,
} = useEdgeCouplings(props, askSwapIntent)

const { startDrag, rowStyle } = usePortDrag(localSrcPorts, localTgtPorts, canvasEl)

const { draggingFrom, onConnectStart, onConnectEnd, onEdgeUpdateEnd, onEdgeUpdateStart } = useConnectionAutoscroll(
  canvasEl,
  getViewport,
  setViewport
)

const canvasHeight = computed(
  () => (Math.max(localSrcPorts.value.length, localTgtPorts.value.length, 4) + 1) * ROW_H + PAD * 2
)

const flowNodes = computed(() => {
  const srcNodes = buildPortNodes(localSrcPorts.value, connectedSrcUids.value, 'source')
  const tgtNodes = buildPortNodes(localTgtPorts.value, connectedTgtUids.value, 'target')

  const nodes = [...srcNodes, ...tgtNodes]

  ;['source', 'target'].forEach((side) => {
    const config = SIDE_CONFIG[side]
    const ports = side === 'source' ? localSrcPorts.value : localTgtPorts.value
    nodes.push({
      id: `ghost-${config.prefix}`,
      type: 'ghostPort',
      position: { x: config.x, y: PAD + ports.length * ROW_H },
      data: { side },
    })
  })
  return nodes
})

const flowEdges = computed(() => {
  const edges = []

  for (const { srcUid, tgtUid } of localCouplings.value) {
    const sp = srcByUid(srcUid)
    const tp = tgtByUid(tgtUid)
    if (!sp || !tp) continue

    if (sp.label === tp.label && isCompatible(sp.portType, tp.portType)) {
      edges.push({
        id: `ce-${srcUid}-${tgtUid}`,
        source: `src-${srcUid}`,
        target: `tgt-${tgtUid}`,
        sourceHandle: 'out',
        targetHandle: 'in',
        updatable: true,
        style: {
          stroke: 'var(--p-primary-color, #409eff)',
          strokeWidth: 2.5,
        },
      })
    }
  }
  return edges
})

function buildPortNodes(ports, connectedUids, side) {
  const config = SIDE_CONFIG[side]
  return ports.map((p, i) => ({
    id: `${config.prefix}-${p._uid}`,
    type: config.nodeType,
    position: { x: config.x, y: PAD + i * ROW_H },
    data: {
      port: p,
      isConnected: connectedUids.has(p._uid),
      isTakenElsewhere: takenElsewhereUids.value.has(p._uid),
    },
  }))
}

function isValidConnection(connection) {
  if (connection.source === 'ghost-src' && connection.target === 'ghost-tgt') return false
  if (connection.source === 'ghost-src' || connection.target === 'ghost-tgt') return true
  const sUid = (connection.source || '').replace('src-', '')
  const tUid = (connection.target || '').replace('tgt-', '')
  const sp = srcByUid(sUid)
  const tp = tgtByUid(tUid)
  if (!sp || !tp || !sp.label || !tp.label) return false
  return sp.label === tp.label && isCompatible(sp.portType, tp.portType)
}

async function onConnect(connection) {
  const isGhostSrc = connection.source === 'ghost-src'
  const isGhostTgt = connection.target === 'ghost-tgt'

  if (isGhostSrc || isGhostTgt) {
    if (isGhostSrc) {
      const tUid = connection.target.replace('tgt-', '')
      const tp = tgtByUid(tUid)
      if (isSingleConnection(tp)) {
        let next = [...localCouplings.value]
        next = await evictHandle(tp, tUid, 'target', next)
        if (next === null) return
        localCouplings.value = next
      }
      activateGhost('source', tp)
      connection = { ...connection, source: `src-${localSrcPorts.value.at(-1)._uid}` }
    }
    if (isGhostTgt) {
      const sUid = connection.source.replace('src-', '')
      const sp = srcByUid(sUid)
      if (isSingleConnection(sp)) {
        let next = [...localCouplings.value]
        next = await evictHandle(sp, sUid, 'source', next)
        if (next === null) return
        localCouplings.value = next
      }
      activateGhost('target', sp)
      connection = { ...connection, target: `tgt-${localTgtPorts.value.at(-1)._uid}` }
    }
  }

  if (!isValidConnection(connection)) return

  const srcUid = (connection.source || '').replace('src-', '')
  const tgtUid = (connection.target || '').replace('tgt-', '')

  if (localCouplings.value.some((c) => c.srcUid === srcUid && c.tgtUid === tgtUid)) return

  const sp = srcByUid(srcUid)
  const tp = tgtByUid(tgtUid)

  let nextCouplings = [...localCouplings.value]

  nextCouplings = await evictHandle(tp, tgtUid, 'target', nextCouplings)
  if (nextCouplings === null) return
  nextCouplings = await evictHandle(sp, srcUid, 'source', nextCouplings)
  if (nextCouplings === null) return

  localCouplings.value = connectPorts(srcUid, tgtUid, nextCouplings)
}

async function onEdgeUpdate({ edge, connection }) {
  if (!connection?.source || !connection?.target) return
  if (!isValidConnection(connection)) return

  if (connection.source === 'ghost-src' || connection.target === 'ghost-tgt') {
    if (connection.source === 'ghost-src') {
      const tUid = connection.target.replace('tgt-', '')
      const tp = tgtByUid(tUid)
      if (isSingleConnection(tp)) {
        let next = localCouplings.value.filter(
          (c) => !(c.srcUid === edge.source.replace('src-', '') && c.tgtUid === edge.target.replace('tgt-', ''))
        )
        next = await evictHandle(tp, tUid, 'target', next)
        if (next === null) return
        localCouplings.value = next
      }
      activateGhost('source', tp)
      connection = { ...connection, source: `src-${localSrcPorts.value.at(-1)._uid}` }
    }
    if (connection.target === 'ghost-tgt') {
      const sUid = connection.source.replace('src-', '')
      const sp = srcByUid(sUid)
      if (isSingleConnection(sp)) {
        let next = localCouplings.value.filter(
          (c) => !(c.srcUid === edge.source.replace('src-', '') && c.tgtUid === edge.target.replace('tgt-', ''))
        )
        next = await evictHandle(sp, sUid, 'source', next)
        if (next === null) return
        localCouplings.value = next
      }
      activateGhost('target', sp)
      connection = { ...connection, target: `tgt-${localTgtPorts.value.at(-1)._uid}` }
    }
  }

  const newSrcUid = connection.source.replace('src-', '')
  const newTgtUid = connection.target.replace('tgt-', '')
  const oldSrcUid = edge.source.replace('src-', '')
  const oldTgtUid = edge.target.replace('tgt-', '')

  if (newSrcUid === oldSrcUid && newTgtUid === oldTgtUid) return

  const sp = srcByUid(newSrcUid)
  const tp = tgtByUid(newTgtUid)
  if (!sp || !tp) return

  let nextCouplings = localCouplings.value.filter((c) => !(c.srcUid === oldSrcUid && c.tgtUid === oldTgtUid))

  const isDuplicate = nextCouplings.some((c) => c.srcUid === newSrcUid && c.tgtUid === newTgtUid)

  if (isDuplicate && !isSingleConnection(tp) && !isSingleConnection(sp)) {
    return
  }

  nextCouplings = await swapConnections(tp, oldTgtUid, newTgtUid, 'target', nextCouplings)
  if (nextCouplings === null) return
  nextCouplings = await swapConnections(sp, oldSrcUid, newSrcUid, 'source', nextCouplings)
  if (nextCouplings === null) return

  nextCouplings = connectPorts(newSrcUid, newTgtUid, nextCouplings)
  localCouplings.value = nextCouplings
}

const validConnectUids = computed(() => {
  if (!draggingFrom.value) return new Set()
  const { uid, side } = draggingFrom.value
  const isGhost = uid === 'ghost-src' || uid === 'ghost-tgt'
  const candidates = side === 'source' ? localTgtPorts.value : localSrcPorts.value
  if (isGhost) return new Set(candidates.map((p) => p._uid))
  const port = portLookup.value.get(uid)?.port
  if (!port) return new Set()
  return new Set(
    candidates
      .filter((p) => {
        if (!p.label || !port.label) return false
        if (p.label !== port.label) return false
        const [srcType, tgtType] = side === 'source' ? [port.portType, p.portType] : [p.portType, port.portType]
        return isCompatible(srcType, tgtType)
      })
      .map((p) => p._uid)
  )
})

function onCanvasWheel(event) {
  if (draggingFrom.value) return
  canvasEl.value.scrollTop += event.deltaY
}

function buildPayload() {
  const foreignCouplings = {}
  const activeEdgeId = props.activeEdge?.id

  for (const [edgeId, localEdge] of localSubgraph.value) {
    if (edgeId === activeEdgeId) continue
    const originalCouplings = props.subgraph?.get(edgeId)?.data?.couplings || []
    const localCouplingsArr = localEdge?.data?.couplings || []
    if (JSON.stringify(originalCouplings) !== JSON.stringify(localCouplingsArr)) {
      foreignCouplings[edgeId] = localCouplingsArr
    }
  }

  return {
    sourceNodeId: props.sourceNode.id,
    targetNodeId: props.targetNode.id,
    sourcePorts: detachReactivity(localSrcPorts.value),
    targetPorts: detachReactivity(localTgtPorts.value),
    couplings: localCouplings.value.map((c) => {
      const sp = srcByUid(c.srcUid)
      const tp = tgtByUid(c.tgtUid)
      return {
        sourcePort: {
          portType: sp.portType,
          label: sp.label,
          variables: sp.variables,
          multiportType: sp.multiportType,
        },
        targetPort: {
          portType: tp.portType,
          label: tp.label,
          variables: tp.variables,
          multiportType: tp.multiportType,
        },
      }
    }),
    foreignCouplings,
  }
}

function handleConfirm() {
  emit('confirm', buildPayload())
  emit('update:modelValue', false)
}

function handleCancel() {
  emit('update:modelValue', false)
}

function onClosed() {}

watch(
  () => props.modelValue,
  (v) => {
    if (v) initLocalState()
  }
)
</script>

<style scoped>
/* ── Dialog header ── */
.dialog-header {
  width: 100%;
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
  color: var(--p-text-color, #ffffff);
  letter-spacing: -0.3px;
}
.title-icon {
  font-size: 20px;
  color: var(--p-warn-color, #e6a23c);
}
.node-names {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  margin-left: auto;
}
.node-badge {
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.3px;
}
.source-badge {
  background: color-mix(in srgb, var(--p-primary-color, #409eff) 15%, transparent);
  color: var(--p-primary-color, #409eff);
  border: 1px solid color-mix(in srgb, var(--p-primary-color, #409eff) 30%, transparent);
}
.target-badge {
  background: color-mix(in srgb, var(--p-green-500, #67c23a) 15%, transparent);
  color: var(--p-green-500, #67c23a);
  border: 1px solid color-mix(in srgb, var(--p-green-500, #67c23a) 30%, transparent);
}
.arrow-sep {
  color: var(--p-text-muted-color, #909399);
  font-size: 16px;
}

/* ── Root layout ── */
.root {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.connections-layout {
  width: v-bind(contentWidth);
  margin: 0 auto;
  --port-box-sizing: border-box;
  --port-inset-x: 10px;
}

/* ── Column headers ── */
.col-header {
  padding: 0 5px;
}
.col-headers {
  display: flex;
  align-items: flex-start;
  gap: 0;
  width: 100%;
  box-sizing: border-box;
}
.col-header-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: v-bind(nodeWidth);
}
.side-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: var(--p-text-muted-color, #909399);
  padding-left: 2px;
}
.col-subheaders {
  display: flex;
  gap: 8px;
  padding: 6px var(--port-inset-x);
  background: color-mix(in srgb, var(--p-text-color, #fff) 4%, var(--p-content-background, #18181b));
  border: 1px solid var(--p-content-border-color, #27272a);
  border-radius: 4px 4px 0 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--p-text-muted-color, #909399);
  letter-spacing: 0.3px;
  box-sizing: var(--port-box-sizing);
}

/* ── Canvas ── */
.flow-canvas {
  border: 1px solid var(--p-content-border-color, #27272a);
  border-radius: 0 0 4px 4px;
  background: color-mix(in srgb, var(--p-text-color, #fff) 2%, var(--p-content-background, #18181b));
  max-height: 65vh;
  overflow-y: auto;
  overflow-x: hidden;
}

/* -- Ghost ports -- */
.port-row {
  height: 44px;
  display: flex;
  align-items: center;
}
:deep(.port-row--ghost) {
  background: transparent;
  border: 1.5px dashed var(--p-content-border-color, #3f3f46);
  opacity: 1;
  cursor: pointer;
  gap: 6px;
  box-sizing: border-box;
  transition: border-color 0.15s, background 0.15s;
}
:deep(.port-row--ghost:hover) {
  border-color: var(--p-primary-color, #409eff);
  background: color-mix(in srgb, var(--p-primary-color, #409eff) 12%, transparent);
}
.ghost-label {
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color, #a1a1aa);
  letter-spacing: 0.5px;
  pointer-events: none;
  user-select: none;
  transition: color 0.15s;
}
:deep(.ghost-controls) {
  justify-content: center;
  align-items: center;
  display: flex;
  width: 100%;
}
:deep(.port-row--ghost:hover) .ghost-label {
  color: var(--p-primary-color, #409eff);
}

/* ── Handles ── */
:deep(.port-handle) {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 2px solid var(--p-content-background, #18181b);
  transition: background 0.1s ease;
  position: absolute !important;
  top: 50% !important;
  z-index: 10;
}

:deep(.vue-flow__handle-left) {
  left: 0 !important;
  transform: translate(-50%, -50%) !important;
}

:deep(.vue-flow__handle-right) {
  right: 0 !important;
  transform: translate(50%, -50%) !important;
}

:deep(.vue-flow__handle-valid),
:deep(.handle--valid-target) {
  background: var(--p-green-500, #67c23a) !important;
  box-shadow: 0 0 0 3px rgba(103, 194, 58, 0.35);
}

/* ── Bottom bar ── */
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 0;
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
  color: var(--p-text-muted-color, #a1a1aa);
}
.legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
}
.dot-connected {
  background: var(--p-primary-color, #409eff);
}
.dot-taken {
  background: var(--p-warn-color, #e6a23c);
  border: 1px dashed var(--p-warn-color, #e6a23c);
}
.dot-taken-multi {
  background: var(--p-content-background, #18181b);
  border: 1px solid var(--p-content-border-color, #52525b);
}
.dot-free {
  background: var(--p-text-muted-color, #71717a);
}

/* ── Footer ── */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
