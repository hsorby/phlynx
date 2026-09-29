/**
 * An editing session over an instance's math: the XML, the text, the parameter rows and the
 * analysis linking them. Math editors report changes, and this is the one place they become rows
 * and undo history.
 */
import { computed, ref, shallowRef } from 'vue'

import { useLibraryStore } from '../stores/libraryStore'
import { analyzeMathXml } from '../services/math/analyzeMath'
import { modeFor, reconcileRows } from '../services/math/reconcileRows'
import { buildVariableDeclarations } from '../utils/variables'
import { areModelsEquivalent } from '../utils/cellml'
import { cleanName } from '../utils/identifiers'

/**
 * Checks whether two row lists hold the same set of names.
 *
 * @param {Array} rows
 * @param {Array} otherRows
 * @returns {boolean}
 */
function hasSameNames(rows, otherRows) {
  const names = new Set(otherRows.map((row) => row.name))
  return rows.length === otherRows.length && rows.every((row) => names.has(row.name))
}

/**
 * Creates a math editing session. A plugged-in editor emits `change` with
 * `{ source: 'init'|'edit'|'external', text, valid, xml }` and exposes `setText`, `flush` and
 * `getErrors`.
 *
 * @param {Object} options
 * @param {Object} options.history - The flow history store.
 * @param {import('vue').Ref} options.editorRef - The mounted math editor.
 * @param {import('vue').Ref<Array>} options.ports - Editable ports; variables removed from the math are removed from them.
 * @returns {Object} Session state, queries and actions.
 */
export function useMathSession({ history, editorRef, ports }) {
  const store = useLibraryStore()

  const isManaged = ref(true) // Simple Mode: the table owns the declarations
  const currentModel = ref('') // latest valid XML
  const currentCellmlText = ref('') // latest text, valid or not
  const originalModel = ref('')
  const parameterRows = ref([])
  const analysis = shallowRef(null)

  const mode = computed(() => modeFor(isManaged.value))
  // A mode switch always rebuilds the rows, so remember which mode built them.
  let rowsBuiltAsManaged = null

  /**
   * Replaces the rows and records the mode that built them.
   *
   * @param {Array} rows
   */
  function setRows(rows) {
    parameterRows.value = rows
    rowsBuiltAsManaged = isManaged.value
  }

  /** Declarations Simple Mode writes into the model. */
  const editorDefinitions = computed(() => buildVariableDeclarations(parameterRows.value))

  // Simple Mode reads units from the table; Advanced Mode asks the analysis of the text.
  const unresolvedInText = computed(() => new Set(isManaged.value ? [] : (analysis.value?.unresolved ?? [])))

  /**
   * Checks whether a row is missing its units.
   *
   * @param {Object} row
   * @returns {boolean}
   */
  const isMissingUnits = (row) => (isManaged.value ? !cleanName(row.units) : unresolvedInText.value.has(row.name))

  /**
   * Checks whether the math differs from what was loaded. The libcellml comparison only runs when
   * the XML text differs.
   *
   * @returns {boolean}
   */
  function isDirty() {
    if (currentModel.value === originalModel.value) return false
    return !areModelsEquivalent(originalModel.value, currentModel.value)
  }

  /**
   * Loads an instance's math and rows. A cache miss is analyzed in the worker, so the caller can
   * show a loading state meanwhile.
   *
   * @param {Object} options
   * @param {string} options.mathRef
   * @param {Array} options.rows - The instance's saved rows.
   * @param {boolean} options.managed - Whether to start in Simple Mode.
   * @returns {Promise<void>}
   */
  async function load({ mathRef, rows, managed }) {
    isManaged.value = managed
    const math = (mathRef && store.availableMath.get(mathRef)) || ''
    currentModel.value = math
    originalModel.value = math
    currentCellmlText.value = ''

    analysis.value = mathRef ? await store.ensureMathAnalysis(mathRef) : null
    setRows(reconcileRows(analysis.value, rows, { mode: mode.value }))
  }

  /**
   * Removes port variables that no longer exist in the rows.
   *
   * @param {Array} rows
   */
  function pruneMissingPortVariables(rows) {
    const names = new Set(rows.map((row) => row.name))
    for (const port of ports.value) {
      if (Array.isArray(port.variables)) port.variables = port.variables.filter((name) => names.has(name))
    }
  }

  // ── Editor events ──────────────────────────────────────────────────────────
  let pendingChange = Promise.resolve()

  /**
   * Queues an editor change so changes are handled one at a time, since recording history is async.
   *
   * @param {Object} change - The editor's `change` payload.
   */
  function handleEditorChange(change) {
    pendingChange = pendingChange
      .then(() => processEditorChange(change))
      .catch((error) => console.error('Failed to process math editor change', error))
  }

  /**
   * Flushes the editor's debounce and waits for every queued change.
   *
   * @returns {Promise<void>}
   */
  async function flushPendingChanges() {
    editorRef.value?.flush?.()
    await pendingChange
  }

  /**
   * Applies one editor change to the text, the analysis and the rows.
   *
   * @param {Object} change - The editor's `change` payload.
   * @returns {Promise<void>}
   */
  async function processEditorChange({ source, text, valid, xml }) {
    if (!valid) {
      if (source === 'edit') await handleInvalidEdit(text)
      else currentCellmlText.value = text
      return
    }

    const nextAnalysis = analyzeMathXml(xml)
    if (source === 'edit') return handleValidEdit(xml, text, nextAnalysis)

    // 'init' (editor mounted) or 'external' (mode, definitions or component name changed).
    currentCellmlText.value = text
    currentModel.value = xml
    if (source === 'init') originalModel.value = xml
    analysis.value = nextAnalysis

    const rows = reconcileRows(nextAnalysis, parameterRows.value, { mode: mode.value })
    // Keep the existing row objects unless the structure changed, so table inputs aren't reset.
    if (source === 'init' || rowsBuiltAsManaged !== isManaged.value || !hasSameNames(rows, parameterRows.value)) {
      setRows(rows)
      if (source === 'init') pruneMissingPortVariables(rows)
    }
  }

  /**
   * Restores a text state during undo or redo.
   *
   * @param {string} xml
   * @param {string} text
   * @param {import('../services/math/analyzeMath').MathAnalysis} textAnalysis
   * @returns {Promise<void>|undefined}
   */
  function applyTextState(xml, text, textAnalysis) {
    currentModel.value = xml
    currentCellmlText.value = text
    analysis.value = textAnalysis
    return editorRef.value?.setText(text)
  }

  /**
   * Records a valid edit as one undo step: the code, the rows it implies, and any port variables
   * it removed.
   *
   * @param {string} newXml
   * @param {string} newText
   * @param {import('../services/math/analyzeMath').MathAnalysis} newAnalysis
   * @returns {Promise<void>}
   */
  async function handleValidEdit(newXml, newText, newAnalysis) {
    const previousXml = currentModel.value
    const previousText = currentCellmlText.value
    const previousAnalysis = analysis.value
    if (previousXml === newXml) {
      currentCellmlText.value = newText
      return
    }

    const newRows = reconcileRows(newAnalysis, parameterRows.value, { mode: mode.value })
    const previousRows = parameterRows.value
    const validNames = new Set(newRows.map((row) => row.name))

    history.startBatch()
    try {
      await history.executeAndAddCommand({
        type: 'update-cellml-code',
        undo: async () => applyTextState(previousXml, previousText, previousAnalysis),
        redo: async () => applyTextState(newXml, newText, newAnalysis),
      })

      await history.executeAndAddCommand({
        type: 'update-parameter-rows',
        undo: async () => setRows(previousRows),
        redo: async () => setRows(newRows),
      })

      for (const port of ports.value) {
        if (!Array.isArray(port.variables)) continue
        const portVariables = port.variables
        if (portVariables.every((name) => validNames.has(name))) continue

        await history.executeAndAddCommand({
          type: 'remove-variable-from-port',
          undo: async () => {
            port.variables = portVariables
          },
          redo: async () => {
            port.variables = port.variables.filter((name) => validNames.has(name))
          },
        })
      }
    } finally {
      history.endBatch()
    }
  }

  /**
   * Records an edit that didn't parse, so undo and redo can still replay the raw text.
   *
   * @param {string} text
   * @returns {Promise<void>}
   */
  async function handleInvalidEdit(text) {
    const previousText = currentCellmlText.value
    if (previousText === text) return

    await history.executeAndAddCommand({
      type: 'update-cellml-text-only',
      undo: async () => {
        currentCellmlText.value = previousText
        await editorRef.value?.setText(previousText)
      },
      redo: async () => {
        currentCellmlText.value = text
        await editorRef.value?.setText(text)
      },
    })
  }

  return {
    // state
    isManaged,
    currentModel,
    parameterRows,
    editorDefinitions,
    // queries
    isMissingUnits,
    isDirty,
    // actions
    load,
    handleEditorChange,
    flushPendingChanges,
  }
}
