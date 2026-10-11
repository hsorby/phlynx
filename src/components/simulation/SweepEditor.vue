<template>
  <section class="sweep-editor" aria-label="Parameter sweep">
    <p class="sweep-hint">
      Run the model at each value of one parameter, and plot against it: solved once each, or with differential equations, a
      time course each, read as chosen below. Play runs it with the toolbar’s Sweep on. To step from a holding value and read
      the peak, use a protocol.
    </p>

    <div v-if="sweep" class="sweep-card" data-testid="sim-sweep-parameter">
      <div class="sweep-head">
        <span class="sweep-label" :title="label">
          <span class="sweep-component">{{ sweep.nodeName }}/</span><span class="sweep-name">{{ sweep.parameterName }}</span>
        </span>
        <span v-if="sweep.units" class="sweep-units">{{ sweep.units }}</span>
        <Button
          icon="pi pi-ellipsis-h"
          text
          rounded
          size="small"
          severity="secondary"
          :aria-label="`More for the ${sweep.parameterName} sweep`"
          aria-haspopup="true"
          @click="(event) => menu.toggle(event)"
        />
      </div>
      <div class="sweep-range">
        <div class="sweep-field">
          <label :for="`${id}-from`">From</label>
          <InputNumber
            :model-value="sweep.from"
            :input-id="`${id}-from`"
            :pt:pcInputText:root="{ 'data-testid': 'sim-sweep-from' }"
            :minFractionDigits="0"
            :maxFractionDigits="8"
            size="small"
            fluid
            @update:model-value="(from) => update({ from })"
          />
        </div>
        <div class="sweep-field">
          <label :for="`${id}-to`">To</label>
          <InputNumber
            :model-value="sweep.to"
            :input-id="`${id}-to`"
            :pt:pcInputText:root="{ 'data-testid': 'sim-sweep-to' }"
            :minFractionDigits="0"
            :maxFractionDigits="8"
            size="small"
            fluid
            @update:model-value="(to) => update({ to })"
          />
        </div>
        <div class="sweep-field">
          <label :for="`${id}-points`">Points</label>
          <InputNumber
            :model-value="sweep.points"
            :input-id="`${id}-points`"
            :pt:pcInputText:root="{ 'data-testid': 'sim-sweep-points' }"
            :min="2"
            :max="MAX_SWEEP_POINTS"
            :useGrouping="false"
            size="small"
            fluid
            @update:model-value="(points) => update({ points })"
          />
        </div>
      </div>
      <div class="sweep-field">
        <label :id="`${id}-readout`">Reading <span class="sweep-hint-inline">of each time course, between Start and End</span></label>
        <SelectButton
          :model-value="readout"
          :options="READOUTS"
          option-label="label"
          option-value="id"
          :allow-empty="false"
          size="small"
          :aria-labelledby="`${id}-readout`"
          data-testid="sim-sweep-readout"
          @update:model-value="(value) => update({ readout: value })"
        >
          <template #option="{ option }"><span :title="option.description">{{ option.label }}</span></template>
        </SelectButton>
      </div>
      <p v-if="cost" class="sweep-hint" data-testid="sim-sweep-cost">{{ cost }}</p>
      <Message v-if="problem" severity="warn" size="small">{{ problem }}</Message>
      <Message v-else-if="isLong" severity="warn" size="small" data-testid="sim-sweep-long">
        That’s a lot of time courses: fewer points, or a larger point interval, make the sweep quicker.
      </Message>
      <Message v-if="hasHiddenTransient" severity="secondary" size="small" data-testid="sim-sweep-transient">
        Each time course starts at the initial time, before the plots’ Start, so a {{ readoutLabel }} in the first moments
        isn’t read. To read the peak after a step from a holding value, use a protocol.
      </Message>
      <Message v-if="!problem" severity="secondary" size="small">
        Web OpenCOR can’t run sweeps, so an export solves or simulates the model once, at the parameter’s own value.
      </Message>
    </div>

    <p v-else-if="!isAdding" class="sweep-hint">No sweep yet.</p>

    <!-- Last, as Add slider is. The search shows when asked for, and tucks away after a pick. -->
    <div v-if="isAdding" ref="pickerEl" class="sweep-picker">
      <VariablePathPicker
        :index="index"
        :filter="(entry) => isSweepableEntry(entry, { unsupplied, variables: resultsStore.results?.variables, sweep })"
        :describe="describeSweepable"
        :placeholder="sweep ? 'Sweep another parameter…' : 'Sweep a parameter…'"
        aria-label="Choose a parameter to sweep"
        @pick="sweepEntry"
      />
      <Button
        icon="pi pi-times"
        text
        rounded
        size="small"
        severity="secondary"
        aria-label="Close the sweep search"
        @click="isAdding = false"
      />
    </div>
    <Button v-else-if="!sweep" label="Sweep a parameter" icon="pi pi-plus" text size="small" class="sweep-add-button" @click="startAdding" />

    <Menu ref="menu" :model="menuItems" popup />
  </section>
</template>

<script setup>
/**
 * The parameter sweep: one at a time, added from a search over the parameters a run can vary, with the
 * range it is solved over. Used by the Simulation tab, which saves each change, and by Simulation Settings,
 * which keeps it as a draft.
 */
import { computed, nextTick, ref, useId } from 'vue'
import { useVueFlow } from '@vue-flow/core'

import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Menu from 'primevue/menu'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'

import VariablePathPicker from './VariablePathPicker.vue'
import { resolveBoundaryValues } from '../../services/export/boundaryValues'
import { createSweep, findSweepProblem, isSweepableEntry, MAX_SWEEP_POINTS, sweepLabel, sweepReadout } from '../../services/simulation/sweep'
import { READOUTS } from '../../services/simulation/sweepReadouts'
import { buildVariableIndex } from '../../services/simulation/variableIndex'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSimulationResultsStore } from '../../stores/simulationResultsStore'
import { useSimulationSettingsStore } from '../../stores/simulationSettingsStore'
import { FLOW_IDS } from '../../utils/constants'

const props = defineProps({
  // Every node in the workspace: any of their parameters can be swept.
  nodes: { type: Array, default: () => [] },
})
// The sweep, or null for none (see services/simulation/sweep.js).
const sweep = defineModel('sweep', { type: Object, default: null })

const libraryStore = useLibraryStore()
const resultsStore = useSimulationResultsStore()
const { edges } = useVueFlow(FLOW_IDS.MAIN)
const id = useId()

const label = computed(() => (sweep.value ? sweepLabel(sweep.value) : ''))
const problem = computed(() => (sweep.value ? findSweepProblem(sweep.value) : null))
const settingsStore = useSimulationSettingsStore()

const readout = computed(() => sweepReadout(sweep.value))
const readoutLabel = computed(() => READOUTS.find(({ id }) => id === readout.value).label.toLowerCase())
// The last run's model, once known: without ODEs, each value is solved once rather than run as a time course.
const isSteadyState = computed(() => !!resultsStore.results?.isSteadyState)
// Past this many time courses, the sweep says it will be slow.
const LONG_SWEEP_RUNS = 200
const isLong = computed(() => !isSteadyState.value && Number.isInteger(sweep.value?.points) && sweep.value.points > LONG_SWEEP_RUNS)

// How many solves or time courses the sweep runs, and about how long they take, going by the last run's.
const cost = computed(() => {
  const points = sweep.value?.points
  if (!Number.isInteger(points) || points < 2) return null
  const runs = `${points} ${isSteadyState.value ? 'solves' : 'time courses'}`
  const results = resultsStore.results
  const solves = results?.isSweep ? results.voi.values.length : 1
  const perSolveMs = results && !results.isStopped && solves ? results.elapsedMs / solves : null
  if (!perSolveMs || results.isSteadyState !== isSteadyState.value) return `${runs}.`
  const seconds = (perSolveMs * points) / 1000
  return `${runs}, ${seconds < 1 ? 'under a second' : `about ${seconds < 90 ? `${Math.round(seconds)} s` : `${Math.round(seconds / 60)} min`}`}.`
})

// A time course that starts before the plots do, to settle, can't be read in its first moments, where a peak may be.
const hasHiddenTransient = computed(() => {
  const { initialPoint, startingPoint } = settingsStore.simulationSettings
  return !isSteadyState.value && readout.value !== 'end' && initialPoint < startingPoint
})

const pickerEl = ref(null)
// The search opens from the Sweep a parameter button or the sweep's menu, never on its own.
const isAdding = ref(false)

// Given the last run's mapping, so the picker can leave out what that run computed (see isSweepableEntry).
const index = computed(() =>
  isAdding.value ? buildVariableIndex(props.nodes, { scopeNodeIds: resultsStore.scopeNodeIds, mapping: resultsStore.mapping }) : []
)
// The boundary conditions nothing connected supplies, whose own values a sweep can vary.
const unsupplied = computed(() => (isAdding.value ? resolveBoundaryValues(props.nodes, edges.value).unsupplied : new Set()))

/**
 * Notes whether a parameter was in the last run, and what the model makes the same as it.
 *
 * @param {Object} entry
 * @returns {string|null}
 */
function describeSweepable(entry) {
  const notes = []
  if (!entry.inScope) notes.push('Not in the last run')
  if (entry.equivalents.length) notes.push(`≡ ${entry.equivalents.join(', ')}`)
  return notes.length ? notes.join(' · ') : null
}

/** Shows the sweep search and puts the cursor in it. */
async function startAdding() {
  isAdding.value = true
  await nextTick()
  pickerEl.value?.querySelector('input')?.focus()
}

/**
 * Sweeps a picked parameter, over a range around its value.
 *
 * @param {Object} entry - From the variable index.
 */
function sweepEntry(entry) {
  const node = props.nodes.find((candidate) => candidate.id === entry.nodeId)
  const row = node?.data?.variables?.find((candidate) => candidate.name === entry.rowName)
  if (!node || !row) return
  sweep.value = createSweep(node, row, libraryStore.getGlobalConstant)
  isAdding.value = false
}

/**
 * Changes the sweep's range, or its reading.
 *
 * @param {{from?: number, to?: number, points?: number, readout?: string}} patch
 */
function update(patch) {
  sweep.value = { ...sweep.value, ...patch }
}

const menu = ref(null)
const menuItems = [
  { label: 'Change parameter…', icon: 'pi pi-search', command: () => startAdding() },
  { separator: true },
  {
    label: 'Stop sweeping',
    icon: 'pi pi-trash',
    command: () => {
      sweep.value = null
      isAdding.value = false
    },
  },
]
</script>

<style scoped>
.sweep-editor {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sweep-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.sweep-hint-inline {
  font-weight: 400;
}

.sweep-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sweep-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 0.8125rem;
}

.sweep-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sweep-name {
  font-weight: 600;
  color: var(--p-text-color);
}

.sweep-component,
.sweep-units {
  color: var(--p-text-muted-color);
}

.sweep-units {
  flex-shrink: 0;
}

.sweep-range {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.sweep-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.sweep-field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.sweep-picker {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sweep-picker > :first-child {
  flex: 1;
  min-width: 0;
}

.sweep-add-button {
  align-self: flex-start;
}

/* Narrow: the range's fields stack. */
@container (max-width: 300px) {
  .sweep-range {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
