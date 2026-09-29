// @vitest-environment happy-dom
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { CellMLTextGenerator, CellMLTextParser, applyVariableDefinitions } from 'cellml-text-editor'

import { useMathSession } from '../../../src/composables/useMathSession.js'
import { useFlowHistoryStore } from '../../../src/stores/historyStore.js'
import { useLibraryStore } from '../../../src/stores/libraryStore.js'

const MATH_REF = 'file:decay'
const XML = `<model xmlns="http://www.cellml.org/cellml/2.0#" name="decay">
  <component name="decay">
    <variable name="t" units="second" interface="public_and_private"/>
    <variable name="x" units="metre" initial_value="x0"/>
    <variable name="x0" units="metre" initial_value="1"/>
    <variable name="k" units="per_second" initial_value="0.5"/>
    <math xmlns="http://www.w3.org/1998/Math/MathML">
      <apply><eq/>
        <apply><diff/><bvar><ci>t</ci></bvar><ci>x</ci></apply>
        <apply><times/><apply><minus/><ci>k</ci></apply><ci>x</ci></apply>
      </apply>
    </math>
  </component>
</model>`

const byName = (rows) => Object.fromEntries(rows.map((row) => [row.name, row]))

/** Stands in for CellMLTextEditor: parses text the way it does and reports `change` events. */
function fakeEditor(session) {
  const editor = {
    text: '',
    lastXml: XML,
    report(source, text, simple) {
      const parser = new CellMLTextParser({ simplified: simple })
      const result = parser.parse(text, {
        baseXml: editor.lastXml,
        componentName: 'decay',
        finalise: simple ? (doc) => applyVariableDefinitions(doc, session.editorDefinitions.value) : undefined,
      })
      const valid = result.errors.length === 0 && !!result.xml
      if (valid) editor.lastXml = result.xml
      session.handleEditorChange({ source, text, valid, xml: valid ? result.xml : null })
      return session.flushPendingChanges()
    },
    setText: async (text) => {
      editor.text = text
    },
    flush: () => {},
  }
  return editor
}

describe('useMathSession', () => {
  let session, editorRef, history

  beforeEach(async () => {
    setActivePinia(createPinia())
    useLibraryStore().addMath(MATH_REF, XML)
    history = useFlowHistoryStore()
    editorRef = ref(null)
    session = useMathSession({ history, editorRef, ports: ref([{ label: 'p', variables: ['x', 'k'] }]) })
    editorRef.value = fakeEditor(session)
    await session.load({ mathRef: MATH_REF, rows: [], managed: true })
  })

  it('builds rows from the cached analysis on open, with units applied', () => {
    const rows = byName(session.parameterRows.value)
    expect(rows.x).toMatchObject({ stateRole: 'state', initialiser: 'x0', units: 'metre' })
    expect(rows.x0.value).toBe('1')
    expect(rows.k).toMatchObject({ value: '0.5', units: 'per_second', type: 'constant' })
    expect(session.parameterRows.value.filter(session.isMissingUnits)).toEqual([])
  })

  it('reports no missing units after the simple-mode editor round-trips the definitions', async () => {
    const simpleText = new CellMLTextGenerator({ simplified: true }).generate(XML)
    await editorRef.value.report('init', simpleText, true)
    expect(session.parameterRows.value.filter(session.isMissingUnits)).toEqual([])
    expect(session.isDirty()).toBe(false)
  })

  it('flags a row whose units are cleared', () => {
    byName(session.parameterRows.value).k.units = ''
    expect(session.parameterRows.value.filter(session.isMissingUnits).map((r) => r.name)).toEqual(['k'])
  })

  it('turns a valid edit into rows and port changes that undo together', async () => {
    const generator = new CellMLTextGenerator({ simplified: true })
    const simpleText = generator.generate(XML)
    await editorRef.value.report('init', simpleText, true)

    const edited = simpleText.replace(/\bk\b/g, 'rate')
    expect(edited).not.toBe(simpleText)
    await editorRef.value.report('edit', edited, true)

    const names = session.parameterRows.value.map((r) => r.name)
    expect(names).toContain('rate')
    expect(names).not.toContain('k')

    await history.undo()
    expect(session.parameterRows.value.map((r) => r.name)).toContain('k')
  })

  it('rebuilds rows for Advanced Mode, where the text owns initial values', async () => {
    session.isManaged.value = false
    const advancedText = new CellMLTextGenerator({ simplified: false }).generate(XML)
    await editorRef.value.report('external', advancedText, false)

    const rows = byName(session.parameterRows.value)
    expect(rows.k.textInit).toBe('0.5')
    expect(rows.x.stateRole).toBe('state')
  })

  it('keeps the row set (and so row order and focus) when an initialiser is renamed in the table', async () => {
    const simpleText = new CellMLTextGenerator({ simplified: true }).generate(XML)
    await editorRef.value.report('init', simpleText, true)
    const rows = session.parameterRows.value
    const initialiser = rows.find((row) => row.name === 'x0')

    // What ParameterTable.commitRename does.
    initialiser.name = 'x_start'
    rows.find((row) => row.name === 'x').initialiser = 'x_start'
    await editorRef.value.report('external', simpleText, true)

    expect(session.parameterRows.value).toBe(rows)
    expect(session.parameterRows.value.map((row) => row.name)).not.toContain('x0')
    expect(editorRef.value.lastXml).toContain('initial_value="x_start"')
  })
})
